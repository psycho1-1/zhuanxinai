import {
  MODEL_VERSION,
  type EvidenceSummary,
  type Observation,
} from '../../lib/evidence-contract.ts';
import { emptySummary, foldEvents } from './model.ts';
import { accountsEnabled, accountLearner } from '../account.ts';
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class EvidenceError extends Error {
  status: number;
  constructor(code: string, status = 409) {
    super(code);
    this.status = status;
  }
}
export async function digest(value: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(hash), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('');
}
export async function learnerCookie(request: Request) {
  if (accountsEnabled()) return accountLearner(request);
  const id = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('zhixu_learner='))
    ?.slice(14);
  return id && UUID.test(id) ? id : null;
}
export function cookieHeader(request: Request, id: string) {
  return `zhixu_learner=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function ensureProfile(db: D1Database, learner: string) {
  await db
    .prepare(
      'INSERT INTO evidence_profiles (id,created_at) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM evidence_deletions WHERE learner=?) ON CONFLICT(id) DO NOTHING',
    )
    .bind(learner, Date.now(), learner)
    .run();
  const p = await db
    .prepare(
      'SELECT id,recovery_hash,deleted_at FROM evidence_profiles WHERE id=? AND NOT EXISTS(SELECT 1 FROM evidence_deletions WHERE learner=?)',
    )
    .bind(learner, learner)
    .first<{
      id: string;
      recovery_hash: string | null;
      deleted_at: number | null;
    }>();
  if (!p || p.deleted_at !== null)
    throw new EvidenceError('PROFILE_DELETED', 401);
  return p;
}
export function assertStatement(
  db: D1Database,
  learner: string,
  commandId: string,
  condition: string,
  values: unknown[] = [],
) {
  return db
    .prepare(
      `UPDATE evidence_commands SET guard=CASE WHEN (${condition}) THEN 1 ELSE 0 END WHERE learner=? AND command_id=?`,
    )
    .bind(...values, learner, commandId);
}
export async function receipt(
  db: D1Database,
  learner: string,
  commandId: string,
  hash: string,
) {
  const found = await db
    .prepare(
      'SELECT hash,response FROM evidence_commands WHERE learner=? AND command_id=? AND EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL)',
    )
    .bind(learner, commandId, learner)
    .first<{ hash: string; response: string }>();
  if (found && found.hash !== hash) throw new EvidenceError('COMMAND_CONFLICT');
  return found ? JSON.parse(found.response) : null;
}
export async function command(
  db: D1Database,
  learner: string,
  commandId: string,
  input: unknown,
  statements: D1PreparedStatement[],
  response: unknown,
) {
  if (!UUID.test(commandId)) throw new EvidenceError('INVALID_COMMAND', 400);
  const hash = await digest(JSON.stringify(input));
  const previous = await receipt(db, learner, commandId, hash);
  if (previous) return previous;
  try {
    await db.batch([
      db
        .prepare(
          'INSERT INTO evidence_commands (learner,command_id,hash,response,created_at) VALUES (?,?,?,?,?)',
        )
        .bind(learner, commandId, hash, JSON.stringify(response), Date.now()),
      assertStatement(
        db,
        learner,
        commandId,
        'EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL)',
        [learner],
      ),
      ...statements,
    ]);
  } catch (error) {
    const recovered = await receipt(db, learner, commandId, hash);
    if (recovered) return recovered;
    if (
      String(error).includes('evidence_command_guard') ||
      String(error).includes('UNIQUE constraint')
    )
      throw new EvidenceError('STALE_ACTIVITY');
    throw error;
  }
  return await receipt(db, learner, commandId, hash);
}
export function addEvent(
  db: D1Database,
  learner: string,
  commandId: string,
  kind: string,
  topic: string,
  presentationId: string | null,
  payload: unknown,
  now = Date.now(),
) {
  return db
    .prepare(
      'INSERT INTO evidence_events (learner,command_id,kind,topic,presentation_id,payload,created_at) VALUES (?,?,?,?,?,?,?)',
    )
    .bind(
      learner,
      commandId,
      kind,
      topic,
      presentationId,
      JSON.stringify(payload),
      now,
    );
}
export async function loadSummary(
  db: D1Database,
  learner: string,
  until = Number.MAX_SAFE_INTEGER,
): Promise<EvidenceSummary> {
  let summary = emptySummary();
  // Capture a finite high-water mark; new submissions are folded by the next read.
  const head = await db
    .prepare(
      'SELECT MAX(COALESCE((SELECT MAX(seq) FROM evidence_events WHERE learner=?),0),COALESCE((SELECT through_seq FROM evidence_baselines WHERE learner=?),0)) AS seq',
    )
    .bind(learner, learner)
    .first<{ seq: number }>();
  const target = Math.min(until, head?.seq ?? 0);
  for (let page = 0; page < 100; page++) {
    // Read the baseline and its tail atomically: retention cannot delete the tail
    // between these two reads and silently drop evidence.
    const [baselines, rows] = await db.batch([
      db
        .prepare('SELECT summary FROM evidence_baselines WHERE learner=?')
        .bind(learner),
      db
        .prepare(
          'SELECT * FROM evidence_events WHERE learner=? AND seq>MAX(?,COALESCE((SELECT through_seq FROM evidence_baselines WHERE learner=?),0)) AND seq<=? ORDER BY seq LIMIT 500',
        )
        .bind(learner, summary.throughSeq, learner, target),
    ]);
    const saved = baselines.results[0] as { summary: string } | undefined;
    if (saved) {
      const base = JSON.parse(saved.summary) as EvidenceSummary;
      if (base.throughSeq > summary.throughSeq) summary = base;
    }
    summary = foldEvents(summary, rows.results as unknown as Observation[]);
    if (rows.results.length < 500 || summary.throughSeq >= target)
      return summary;
  }
  throw new EvidenceError('STATE_PENDING', 202);
}
export async function saveSnapshot(
  db: D1Database,
  learner: string,
  s: EvidenceSummary,
) {
  await db
    .prepare(`INSERT INTO evidence_snapshots (learner,model_version,through_seq,summary,updated_at)
    SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL)
    ON CONFLICT(learner) DO UPDATE SET through_seq=excluded.through_seq,summary=excluded.summary,updated_at=excluded.updated_at
    WHERE evidence_snapshots.model_version=excluded.model_version AND evidence_snapshots.through_seq<excluded.through_seq`)
    .bind(
      learner,
      MODEL_VERSION,
      s.throughSeq,
      JSON.stringify(s),
      Date.now(),
      learner,
    )
    .run();
}
// Legacy events deliberately carry no inferred hint usage, duration, or diagnosis.
export async function importLegacy(db: D1Database, learner: string) {
  await db.batch([
    db
      .prepare(`INSERT OR IGNORE INTO evidence_events (learner,command_id,kind,topic,payload,created_at)
    SELECT learner,'legacy:'||id,'legacy','legacy',json_object('legacyAttemptId',id,'itemId',question_id,'correct',correct,'assistance','unknown','originalCreatedAt',created_at),?
    FROM attempts WHERE learner=? AND EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL)
    AND id>(SELECT legacy_through FROM evidence_profiles WHERE id=?)
    AND NOT EXISTS(SELECT 1 FROM evidence_events e WHERE e.learner=attempts.learner AND e.command_id='legacy:'||attempts.id)
    ORDER BY id LIMIT 100`)
      .bind(Date.now(), learner, learner, learner),
    db
      .prepare(
        `UPDATE evidence_profiles SET legacy_through=MAX(legacy_through,COALESCE((SELECT MAX(id) FROM (SELECT id FROM attempts WHERE learner=? AND id>(SELECT legacy_through FROM evidence_profiles WHERE id=?) ORDER BY id LIMIT 100)),0)) WHERE id=? AND deleted_at IS NULL`,
      )
      .bind(learner, learner, learner),
  ]);
}
