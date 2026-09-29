import {
  DAY,
  MODEL_VERSION,
  type Topic,
  type Purpose,
} from '../../lib/evidence-contract.ts';
import { gradeAnswer, parseAnswer } from '../../lib/grading.ts';
import {
  catalog,
  items,
  getItem,
  publicItem,
  assessment,
  CONTENT_VERSION,
} from './catalog.ts';
import { skillStates } from './model.ts';
import {
  addEvent,
  assertStatement,
  command,
  digest,
  ensureProfile,
  EvidenceError,
  importLegacy,
  loadSummary,
  receipt,
  saveSnapshot,
} from './store.ts';
export type Presentation = {
  id: string;
  learner: string;
  item_id: string;
  item_version: number;
  topic: Topic;
  purpose: Purpose;
  family_id: string;
  status: string;
  assistance: number;
  created_at: number;
};
export async function presentation(
  db: D1Database,
  learner: string,
  id: string,
) {
  const p = await db
    .prepare('SELECT * FROM evidence_presentations WHERE id=? AND learner=?')
    .bind(id, learner)
    .first<Presentation>();
  if (!p) throw new EvidenceError('ACTIVITY_NOT_FOUND', 404);
  const item = getItem(p.item_id, p.item_version);
  if (!item) throw new EvidenceError('CONTENT_VERSION_UNAVAILABLE');
  return { p, item };
}
function active(db: D1Database, learner: string, id: string, cmd: string) {
  return assertStatement(
    db,
    learner,
    cmd,
    "EXISTS(SELECT 1 FROM evidence_presentations WHERE id=? AND learner=? AND status='active')",
    [id, learner],
  );
}
const finishEventResponse = (
  db: D1Database,
  learner: string,
  cmd: string,
  kind: string,
) =>
  db
    .prepare(
      `UPDATE evidence_commands SET response=(SELECT json_set(payload,'$.eventSeq',seq) FROM evidence_events WHERE learner=? AND command_id=? AND kind=?) WHERE learner=? AND command_id=?`,
    )
    .bind(learner, cmd, kind, learner, cmd);
export async function state(db: D1Database, learner: string) {
  const profile = await ensureProfile(db, learner);
  await importLegacy(db, learner);
  const s = await loadSummary(db, learner);
  await saveSnapshot(db, learner, s);
  const activeP = await db
    .prepare(
      "SELECT * FROM evidence_presentations WHERE learner=? AND status='active'",
    )
    .bind(learner)
    .first<Presentation>();
  const item = activeP ? getItem(activeP.item_id, activeP.item_version) : null;
  return {
    profileLabel: `学习档案 ${learner.slice(-6)}`,
    hasRecovery: !!profile.recovery_hash,
    states: skillStates(s),
    throughSeq: s.throughSeq,
    modelVersion: MODEL_VERSION,
    contentVersion: CONTENT_VERSION,
    skills: catalog.skills,
    reviewStatus: catalog.review.status,
    active:
      activeP && item
        ? { presentationId: activeP.id, item: publicItem(item) }
        : null,
  };
}
export async function next(
  db: D1Database,
  learner: string,
  b: { commandId: string; topic: Topic; purpose?: Purpose },
) {
  const input = { op: 'next', topic: b.topic, purpose: b.purpose ?? 'auto' };
  const old = await receipt(
    db,
    learner,
    b.commandId,
    await digest(JSON.stringify(input)),
  );
  if (old) return old;
  const s = await loadSummary(db, learner);
  const t = s.topics[b.topic];
  if (!t) throw new EvidenceError('INVALID_TOPIC', 400);
  let purpose =
    b.purpose ??
    (t.diagnostics < 3 && !t.dismissed ? 'diagnostic' : 'practice');
  if (purpose === 'diagnostic' && (t.diagnostics >= 3 || t.dismissed))
    purpose = 'practice';
  if (
    purpose === 'delayed' &&
    (!t.independentAt || Date.now() < t.independentAt + 7 * DAY)
  )
    throw new EvidenceError('REVIEW_NOT_DUE', 409);
  const pool = items.filter(
    (i) =>
      i.topic === b.topic &&
      i.purpose === purpose &&
      !t.seenItems.includes(i.id),
  );
  // A teaching-family exposure cannot be relabelled as novel transfer by issuing a fresh ID.
  const item = assessment(purpose)
    ? pool.find((i) => !t.taughtFamilies.includes(i.familyId))
    : pool[0];
  const explanation =
    purpose === 'diagnostic'
      ? `用第 ${t.diagnostics + 1} 个问题了解你的做法；最多三个问题，也可以跳过。`
      : assessment(purpose)
        ? `用未接受本轮教学帮助的题目检查${purpose === 'delayed' ? '七天后的记忆' : '独立表现'}。`
        : '先练习当前方法，再选择独立新题。';
  const out = item
    ? {
        decisionId: b.commandId,
        presentationId: crypto.randomUUID(),
        item: publicItem(item),
        reason: explanation,
        throughSeq: s.throughSeq,
        policyVersion: MODEL_VERSION,
      }
    : {
        decisionId: b.commandId,
        presentationId: null,
        item: null,
        reason:
          '当前没有合适的未见题目。可以返回课程，或选择其他学习活动；不会重复刷同题来提高独立证据。',
        throughSeq: s.throughSeq,
        policyVersion: MODEL_VERSION,
        fallback: 'fixed-course',
      };
  const statements = [
    // Coordinate with the course-only reply slot without changing assistance semantics.
    ...(item && assessment(purpose) ? [assertStatement(db, learner, b.commandId,
      'NOT EXISTS(SELECT 1 FROM tutor_conversations WHERE learner=? AND deleted_at IS NULL AND pending_request_id IS NOT NULL AND pending_at>?)',
      [learner, Date.now()-60000])] : []),
    assertStatement(
      db,
      learner,
      b.commandId,
      "NOT EXISTS(SELECT 1 FROM evidence_presentations WHERE learner=? AND status='active')",
      [learner],
    ),
    assertStatement(
      db,
      learner,
      b.commandId,
      'MAX(COALESCE((SELECT MAX(seq) FROM evidence_events WHERE learner=?),0),COALESCE((SELECT through_seq FROM evidence_baselines WHERE learner=?),0))=?',
      [learner, learner, s.throughSeq],
    ),
    addEvent(db, learner, b.commandId, 'recommended', b.topic, null, {
      ...out,
      item: item ? { id: item.id, version: item.version } : null,
      candidateIds: pool.map((i) => i.id),
    }),
  ];
  if (item && out.presentationId)
    statements.push(
      db
        .prepare(
          `INSERT INTO evidence_presentations (id,learner,item_id,item_version,topic,purpose,family_id,created_at) VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(
          out.presentationId,
          learner,
          item.id,
          item.version,
          item.topic,
          item.purpose,
          item.familyId,
          Date.now(),
        ),
      addEvent(
        db,
        learner,
        b.commandId,
        'issued',
        b.topic,
        out.presentationId,
        {
          itemId: item.id,
          itemVersion: item.version,
          purpose: item.purpose,
          familyId: item.familyId,
        },
      ),
    );
  return command(db, learner, b.commandId, input, statements, out);
}
export async function attempt(
  db: D1Database,
  learner: string,
  b: {
    commandId: string;
    presentationId: string;
    answer: string;
    clientElapsedMs?: number;
  },
) {
  const { p, item } = await presentation(db, learner, b.presentationId);
  if (item.options && !item.options.some((_, i) => b.answer === String(i + 1)))
    throw new EvidenceError('INVALID_ANSWER', 400);
  const graded = gradeAnswer(b.answer, item.answer);
  if (!graded.valid) throw new EvidenceError('INVALID_ANSWER', 400);
  const input = {
    op: 'attempt',
    presentationId: p.id,
    answer: b.answer.trim(),
  };
  const now = Date.now();
  const independent = assessment(item.purpose);
  const summary = await loadSummary(db, learner);
  const seenTeaching = summary.topics[item.topic].taughtFamilies.includes(
    item.familyId,
  );
  // Snapshot-free assistance check inside the same SQL transaction as the accepted answer.
  const sql = db
    .prepare(`INSERT INTO evidence_events (learner,command_id,kind,topic,presentation_id,payload,created_at)
    SELECT ?,?,'answered',?,id,json_object('itemId',item_id,'itemVersion',item_version,'familyId',family_id,'purpose',purpose,
    'correct',json(?),'submittedAnswer',?,'graderVersion','numeric-1','contentVersion',?,'evidenceClass',CASE WHEN assistance=0 AND ?=1 AND ?=0 AND NOT EXISTS(
      SELECT 1 FROM evidence_events e WHERE e.learner=? AND e.kind='assistance' AND json_extract(e.payload,'$.familyId')=family_id)
      AND NOT EXISTS(SELECT 1 FROM evidence_events e WHERE e.learner=? AND e.kind='answered' AND json_extract(e.payload,'$.itemId')=item_id)
      THEN 'independent' ELSE 'assisted_or_familiar' END,'cause',?, 'feedback',?, 'answer',?, 'clientElapsedMs',?),?
    FROM evidence_presentations WHERE id=? AND learner=? AND status='active'`)
    .bind(
      learner,
      b.commandId,
      item.topic,
      JSON.stringify(graded.correct),
      b.answer.trim(),
      CONTENT_VERSION,
      independent ? 1 : 0,
      seenTeaching ? 1 : 0,
      learner,
      learner,
      graded.correct
        ? null
        : (item.errorMap?.[String(parseAnswer(b.answer))] ?? null),
      independent
        ? graded.correct
          ? '已记录这次作答。'
          : '已记录，我们会结合其他作答再判断。'
        : item.explanation,
      independent ? null : item.answer,
      b.clientElapsedMs ?? null,
      now,
      p.id,
      learner,
    );
  const out = await command(
    db,
    learner,
    b.commandId,
    input,
    [
      active(db, learner, p.id, b.commandId),
      sql,
      assertStatement(
        db,
        learner,
        b.commandId,
        "EXISTS(SELECT 1 FROM evidence_events WHERE learner=? AND command_id=? AND kind='answered')",
        [learner, b.commandId],
      ),
      db
        .prepare(
          "UPDATE evidence_presentations SET status='answered' WHERE id=? AND learner=?",
        )
        .bind(p.id, learner),
      finishEventResponse(db, learner, b.commandId, 'answered'),
    ],
    {},
  );
  try {
    await saveSnapshot(db, learner, await loadSummary(db, learner));
    return { ...out, stateStatus: 'ready' };
  } catch {
    return { ...out, stateStatus: 'updating' };
  }
}
export async function assistance(
  db: D1Database,
  learner: string,
  b: {
    commandId: string;
    presentationId: string;
    kind: 'hint' | 'solution' | 'alternate' | 'tutor';
  },
) {
  const { p, item } = await presentation(db, learner, b.presentationId);
  const intervention = catalog.interventions.find(
    (x) => x.topic === item.topic,
  );
  const text =
    b.kind === 'solution'
      ? item.explanation
      : b.kind === 'alternate'
        ? (intervention?.alternateText ?? item.hint)
        : item.hint;
  const out = {
    assistanceId: b.commandId,
    content: text,
    independenceAffected: true,
    source: 'draft-content',
  };
  return command(
    db,
    learner,
    b.commandId,
    { op: 'help', presentationId: p.id, kind: b.kind },
    [
      db
        .prepare(
          'UPDATE evidence_presentations SET assistance=MAX(assistance,?) WHERE id=? AND learner=?',
        )
        .bind(b.kind === 'solution' ? 2 : 1, p.id, learner),
      addEvent(db, learner, b.commandId, 'assistance', item.topic, p.id, {
        familyId: item.familyId,
        itemId: item.id,
        kind: b.kind,
        interventionId: intervention?.id ?? null,
        contentVersion: CONTENT_VERSION,
      }),
    ],
    out,
  );
}
export async function skip(
  db: D1Database,
  learner: string,
  b: { commandId: string; presentationId: string; dismiss?: boolean },
) {
  const { p } = await presentation(db, learner, b.presentationId);
  return command(
    db,
    learner,
    b.commandId,
    { op: 'skip', presentationId: p.id, dismiss: !!b.dismiss },
    [
      active(db, learner, p.id, b.commandId),
      db
        .prepare(
          "UPDATE evidence_presentations SET status='skipped' WHERE id=? AND learner=?",
        )
        .bind(p.id, learner),
      addEvent(
        db,
        learner,
        b.commandId,
        b.dismiss ? 'dismissed' : 'skipped',
        p.topic,
        p.id,
        { reason: b.dismiss ? 'learner_disagreed' : 'learner_skipped' },
      ),
    ],
    { skipped: true, countsAsWrong: false },
  );
}
export async function createProfile(
  db: D1Database,
  learner: string,
  b: { commandId: string },
) {
  const input = { op: 'new-profile' };
  const hash = await digest(JSON.stringify(input));
  const previous = await receipt(db, learner, b.commandId, hash);
  if (previous) return previous;
  const profileId = crypto.randomUUID(),
    now = Date.now();
  const response = { created: true, profileId };
  return command(
    db,
    learner,
    b.commandId,
    input,
    [
      db
        .prepare('INSERT INTO evidence_profiles (id,created_at) VALUES (?,?)')
        .bind(profileId, now),
      // A response can lose its body after its cookie has been applied. Retain the
      // same receipt in the new session so either cookie retries the same switch.
      db
        .prepare(
          'INSERT INTO evidence_commands (learner,command_id,hash,response,created_at) VALUES (?,?,?,?,?)',
        )
        .bind(profileId, b.commandId, hash, JSON.stringify(response), now),
    ],
    response,
  );
}

export async function createRecovery(
  db: D1Database,
  learner: string,
  b: { commandId: string },
) {
  // Recovery secrets are returned once and never persisted in command responses.
  if (
    await receipt(
      db,
      learner,
      b.commandId,
      await digest(JSON.stringify({ op: 'recovery' })),
    )
  )
    throw new EvidenceError('RECOVERY_ALREADY_DELIVERED');
  const code = crypto.randomUUID() + crypto.randomUUID();
  const hash = await digest(code);
  await command(
    db,
    learner,
    b.commandId,
    { op: 'recovery' },
    [
      db
        .prepare('UPDATE evidence_profiles SET recovery_hash=? WHERE id=?')
        .bind(hash, learner),
    ],
    { created: true },
  );
  const saved = await ensureProfile(db, learner);
  if (saved.recovery_hash !== hash)
    throw new EvidenceError('RECOVERY_ALREADY_DELIVERED');
  return {
    recoveryCode: code,
    note: '只显示这一次，请保存到自己安全的位置；持有码即可恢复此档案。',
  };
}
