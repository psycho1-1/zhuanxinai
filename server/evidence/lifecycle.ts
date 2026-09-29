import {
  DAY,
  MODEL_VERSION,
  type Observation,
} from '../../lib/evidence-contract.ts';
import { emptySummary, foldEvents } from './model.ts';
import { EvidenceError, command, assertStatement } from './store.ts';
const owned = [
  'tutor_messages',
  'tutor_conversations',
  'learning_journeys',
  'attempts',
  'evidence_events',
  'evidence_presentations',
  'evidence_commands',
  'evidence_snapshots',
  'evidence_baselines',
  'tutor_reservations',
] as const;
export async function purgeDeleted(db: D1Database, learner: string) {
  const marker = await db
    .prepare('SELECT requested_at FROM evidence_deletions WHERE learner=?')
    .bind(learner)
    .first();
  if (!marker) throw new EvidenceError('DELETION_NOT_REQUESTED');
  for (let round = 0; round < 4; round++) {
    await db.batch(
      owned.map((table) =>
        db
          .prepare(
            `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE learner=? LIMIT 500)`,
          )
          .bind(learner),
      ),
    );
    const counts = await db.batch(
      owned.map((table) =>
        db
          .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE learner=?`)
          .bind(learner),
      ),
    );
    if (counts.every((r) => Number((r.results[0] as { n: number }).n) === 0)) {
      await db.batch([
        db
          .prepare('DELETE FROM tutor_limits WHERE bucket IN (?,?)')
          .bind(`minute:${learner}`, `day:${learner}`),
        db
          .prepare(
            'UPDATE evidence_deletions SET completed_at=? WHERE learner=?',
          )
          .bind(Date.now(), learner),
      ]);
      return {
        deleted: true,
        status: 'complete',
        scope: '本应用数据库；托管备份及用户自行下载的文件有独立保留周期。',
      };
    }
  }
  return { deleted: false, status: 'pending' };
}
export async function deleteProfile(db: D1Database, learner: string) {
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        'INSERT INTO evidence_deletions (learner,requested_at) VALUES (?,?) ON CONFLICT(learner) DO NOTHING',
      )
      .bind(learner, now),
    db
      .prepare(
        'INSERT INTO evidence_profiles (id,created_at,deleted_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET deleted_at=excluded.deleted_at,recovery_hash=NULL',
      )
      .bind(learner, now, now),
  ]);
  return purgeDeleted(db, learner);
}
export async function compact(
  db: D1Database,
  learner: string,
  now = Date.now(),
) {
  const row = await db
    .prepare('SELECT summary FROM evidence_baselines WHERE learner=?')
    .bind(learner)
    .first<{ summary: string }>();
  const base = row ? JSON.parse(row.summary) : emptySummary();
  const old = await db
    .prepare(
      'SELECT * FROM evidence_events WHERE learner=? AND seq>? AND created_at<? ORDER BY seq LIMIT 500',
    )
    .bind(learner, base.throughSeq, now - 30 * DAY)
    .all<Observation>();
  if (!old.results.length) return { compacted: 0 };
  // Never jump over a newer event: a sequence prefix is required for deterministic replay.
  const limit = old.results.at(-1)!.seq;
  const recentGap = await db
    .prepare(
      'SELECT seq FROM evidence_events WHERE learner=? AND seq>? AND seq<=? AND created_at>=? LIMIT 1',
    )
    .bind(learner, base.throughSeq, limit, now - 30 * DAY)
    .first();
  if (recentGap) throw new EvidenceError('NON_PREFIX_RETENTION');
  const summary = foldEvents(base, old.results);
  const cmd = crypto.randomUUID();
  await command(
    db,
    learner,
    cmd,
    { op: 'compact', from: base.throughSeq, to: summary.throughSeq },
    [
      assertStatement(
        db,
        learner,
        cmd,
        'COALESCE((SELECT through_seq FROM evidence_baselines WHERE learner=?),0)=?',
        [learner, base.throughSeq],
      ),
      db
        .prepare(
          `INSERT INTO evidence_baselines (learner,model_version,through_seq,summary,created_at) VALUES (?,?,?,?,?) ON CONFLICT(learner) DO UPDATE SET model_version=excluded.model_version,through_seq=excluded.through_seq,summary=excluded.summary,created_at=excluded.created_at`,
        )
        .bind(
          learner,
          MODEL_VERSION,
          summary.throughSeq,
          JSON.stringify(summary),
          now,
        ),
      db
        .prepare('DELETE FROM evidence_events WHERE learner=? AND seq<=?')
        .bind(learner, summary.throughSeq),
      db
        .prepare(
          "UPDATE evidence_presentations SET status='expired' WHERE learner=? AND status='active' AND created_at<?",
        )
        .bind(learner, now - 30 * DAY),
      db
        .prepare(
          "DELETE FROM evidence_presentations WHERE learner=? AND status!='active' AND created_at<?",
        )
        .bind(learner, now - 30 * DAY),
      db
        .prepare(
          'DELETE FROM evidence_commands WHERE learner=? AND created_at<?',
        )
        .bind(learner, now - 30 * DAY),
    ],
    {
      compacted: old.results.length,
      throughSeq: summary.throughSeq,
      modelVersion: MODEL_VERSION,
    },
  );
  return { compacted: old.results.length, throughSeq: summary.throughSeq };
}
export async function maintenance(db: D1Database, now = Date.now()) {
  const deleted = await db
    .prepare(
      'SELECT learner FROM evidence_deletions WHERE completed_at IS NULL LIMIT 20',
    )
    .all<{ learner: string }>();
  for (const row of deleted.results) await purgeDeleted(db, row.learner);
  const profiles = await db
    .prepare(
      `SELECT DISTINCT e.learner FROM evidence_events e JOIN evidence_profiles p ON p.id=e.learner WHERE p.deleted_at IS NULL AND e.created_at<? LIMIT 20`,
    )
    .bind(now - 30 * DAY)
    .all<{ learner: string }>();
  const results = [];
  for (const row of profiles.results)
    results.push(await compact(db, row.learner, now));
  await db
    .prepare('DELETE FROM tutor_reservations WHERE created_at<?')
    .bind(now - 30 * DAY)
    .run();
  return {
    profiles: results.length,
    compacted: results.reduce((n, r) => n + r.compacted, 0),
    deletions: deleted.results.length,
  };
}
// Run before restoring service from a backup, using the separately saved deletion manifest.
export async function replayDeletions(
  db: D1Database,
  manifest: { learner: string; requestedAt: number }[],
) {
  for (const row of manifest) await deleteProfile(db, row.learner);
  return { replayed: manifest.length };
}
