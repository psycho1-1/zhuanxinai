import type {
  CourseAction,
  CourseMessage,
  CourseReply,
  CourseThread,
  CourseTutorContext,
} from '../../lib/course-tutor-contract.ts';
import { CourseError } from './context.ts';
import { digest, UUID } from '../evidence/store.ts';
import { quotaStatement } from '../tutor.ts';
export const TURN_TTL = 60000;
type Row = {
  id: string;
  learner: string;
  lesson_id: string;
  resource_id: string;
  context_version: string;
  context_snapshot: string;
  revision: number;
  pending_request_id: string | null;
  pending_at: number | null;
  deleted_at: number | null;
};
export async function owned(
  db: D1Database,
  learner: string,
  id: string,
): Promise<Row> {
  const c = await db
    .prepare(`SELECT * FROM tutor_conversations WHERE id=? AND learner=? AND deleted_at IS NULL
    AND EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM evidence_deletions WHERE learner=?)`)
    .bind(id, learner, learner, learner)
    .first<Row>();
  if (!c) throw new CourseError('CONVERSATION_NOT_FOUND', 404);
  return c;
}
export async function listConversations(
  db: D1Database,
  learner: string,
  lessonId: string,
) {
  return (
    await db
      .prepare(
        'SELECT id,lesson_id AS lessonId,resource_id AS resourceId,revision FROM tutor_conversations WHERE learner=? AND lesson_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 30',
      )
      .bind(learner, lessonId)
      .all()
  ).results;
}
export async function openConversation(
  db: D1Database,
  learner: string,
  context: CourseTutorContext,
) {
  const id = crypto.randomUUID(),
    now = Date.now();
  await db
    .prepare(`INSERT INTO tutor_conversations(id,learner,lesson_id,resource_id,context_version,context_snapshot,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM evidence_deletions WHERE learner=?) ON CONFLICT DO NOTHING`)
    .bind(
      id,
      learner,
      context.lesson.id,
      context.resource.id,
      context.version,
      JSON.stringify(context),
      now,
      now,
      learner,
      learner,
    )
    .run();
  const c = await db
    .prepare(
      'SELECT id FROM tutor_conversations WHERE learner=? AND lesson_id=? AND resource_id=? AND deleted_at IS NULL',
    )
    .bind(learner, context.lesson.id, context.resource.id)
    .first<{ id: string }>();
  if (!c) throw new CourseError('SESSION_REQUIRED', 401);
  return thread(db, learner, c.id);
}
export async function expire(
  db: D1Database,
  learner: string,
  id: string,
  now = Date.now(),
) {
  await db.batch([
    db
      .prepare(`UPDATE tutor_reservations SET status='unknown' WHERE learner=? AND status='sent'
      AND id IN (SELECT 'course:' || conversation_id || ':' || request_id FROM tutor_messages
        WHERE conversation_id=? AND learner=? AND status='pending' AND created_at<=?)`)
      .bind(learner, id, learner, now - TURN_TTL),
    db
      .prepare(`UPDATE tutor_messages SET status='unknown' WHERE conversation_id=? AND learner=? AND status='pending'
      AND created_at<=?`)
      .bind(id, learner, now - TURN_TTL),
    db
      .prepare(
        `UPDATE tutor_conversations SET pending_request_id=NULL,pending_at=NULL WHERE id=? AND learner=? AND pending_at<=?`,
      )
      .bind(id, learner, now - TURN_TTL),
  ]);
}
export async function thread(
  db: D1Database,
  learner: string,
  id: string,
  before = Number.MAX_SAFE_INTEGER,
): Promise<CourseThread> {
  await owned(db, learner, id);
  await expire(db, learner, id);
  const c = await owned(db, learner, id);
  const rows = (
    await db
      .prepare(
        'SELECT * FROM tutor_messages WHERE conversation_id=? AND learner=? AND seq<? ORDER BY seq DESC LIMIT 61',
      )
      .bind(id, learner, before)
      .all<{
        seq: number;
        id: string;
        request_id: string;
        role: 'user' | 'assistant';
        content: string;
        action: CourseAction;
        status: CourseMessage['status'];
        reply: string | null;
        created_at: number;
      }>()
  ).results;
  return {
    conversation: {
      id: c.id,
      lessonId: c.lesson_id,
      resourceId: c.resource_id,
      revision: c.revision,
    },
    hasMore: rows.length > 60,
    messages: rows
      .slice(0, 60)
      .reverse()
      .map((m) => ({
        seq: m.seq,
        id: m.id,
        requestId: m.request_id,
        role: m.role,
        content: m.content,
        action: m.action,
        status: m.status,
        reply: m.reply ? JSON.parse(m.reply) : null,
        createdAt: m.created_at,
      })),
  };
}
export async function turnReceipt(
  db: D1Database,
  learner: string,
  id: string,
  requestId: string,
  hash: string,
) {
  await owned(db, learner, id);
  const row = await db
    .prepare(
      "SELECT request_hash FROM tutor_messages WHERE conversation_id=? AND learner=? AND request_id=? AND role='user'",
    )
    .bind(id, learner, requestId)
    .first<{ request_hash: string }>();
  if (row && row.request_hash !== hash)
    throw new CourseError('REQUEST_CONFLICT', 409);
  return row ? thread(db, learner, id) : null;
}
// This condition is read inside the same transaction that acquires the course reply slot.
export const noAssessment = `NOT EXISTS(SELECT 1 FROM evidence_presentations WHERE learner=? AND status='active' AND purpose IN ('pretest','immediate','delayed'))
  AND NOT EXISTS(SELECT 1 FROM learning_journeys WHERE learner=? AND json_extract(state,'$.phase') IN ('verify','review'))`;
export async function beginTurn(
  db: D1Database,
  learner: string,
  id: string,
  input: {
    requestId: string;
    message: string;
    action: CourseAction;
    revision: number;
  },
  useModel: boolean,
  now = Date.now(),
) {
  if (!UUID.test(input.requestId)) throw new CourseError('INVALID_REQUEST');
  const hash = await digest(
    JSON.stringify({
      message: input.message,
      action: input.action,
      revision: input.revision,
    }),
  );
  const prior = await turnReceipt(db, learner, id, input.requestId, hash);
  if (prior) return { fresh: false, thread: prior };
  await expire(db, learner, id, now);
  const statements = [
    db
      .prepare(`UPDATE tutor_conversations SET revision=CASE WHEN deleted_at IS NULL AND revision=? AND pending_request_id IS NULL
      AND EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM evidence_deletions WHERE learner=?) AND (${noAssessment})
      THEN revision+1 ELSE NULL END,pending_request_id=?,pending_at=?,updated_at=? WHERE id=? AND learner=?`)
      .bind(
        input.revision,
        learner,
        learner,
        learner,
        learner,
        input.requestId,
        now,
        now,
        id,
        learner,
      ),
    ...(['user', 'assistant'] as const).map((role) =>
      db
        .prepare(`INSERT INTO tutor_messages(id,learner,conversation_id,request_id,request_hash,role,content,action,status,created_at)
      VALUES (?,CASE WHEN EXISTS(SELECT 1 FROM tutor_conversations WHERE id=? AND learner=? AND deleted_at IS NULL AND pending_request_id=?) THEN ? ELSE NULL END,?,?,?,?,?,?, 'pending',?)`)
        .bind(
          crypto.randomUUID(),
          id,
          learner,
          input.requestId,
          learner,
          id,
          input.requestId,
          hash,
          role,
          role === 'user' ? input.message : '',
          input.action,
          now,
        ),
    ),
    ...(useModel
      ? [
          db
            .prepare(
              "INSERT INTO tutor_reservations(id,learner,status,created_at) VALUES (?,?,'sent',?)",
            )
            .bind(`course:${id}:${input.requestId}`, learner, now),
          quotaStatement(db, learner, now),
        ]
      : []),
  ];
  try {
    await db.batch(statements);
  } catch (error) {
    const saved = await turnReceipt(db, learner, id, input.requestId, hash);
    if (saved) return { fresh: false, thread: saved };
    if (String(error).includes('tutor_conversations.revision'))
      throw new CourseError('BUSY_OR_STALE', 409);
    throw error;
  }
  return { fresh: true, thread: await thread(db, learner, id) };
}
export async function finishTurn(
  db: D1Database,
  learner: string,
  id: string,
  requestId: string,
  reply: CourseReply,
  status: 'completed' | 'failed' | 'unknown' = 'completed',
) {
  await owned(db, learner, id);
  await expire(db, learner, id);
  await db.batch([
    db
      .prepare(`UPDATE tutor_messages SET status=?,content=CASE WHEN role='assistant' THEN ? ELSE content END,
      reply=CASE WHEN role='assistant' THEN ? ELSE NULL END
      WHERE conversation_id=? AND learner=? AND request_id=? AND status='pending'
      AND EXISTS(SELECT 1 FROM tutor_conversations WHERE id=? AND learner=? AND deleted_at IS NULL AND pending_request_id=?
        AND EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM evidence_deletions WHERE learner=?))`)
      .bind(
        status,
        reply.text,
        JSON.stringify(reply),
        id,
        learner,
        requestId,
        id,
        learner,
        requestId,
        learner,
        learner,
      ),
    db
      .prepare(
        'UPDATE tutor_conversations SET pending_request_id=NULL,pending_at=NULL,updated_at=? WHERE id=? AND learner=? AND pending_request_id=?',
      )
      .bind(Date.now(), id, learner, requestId),
    db
      .prepare(
        "UPDATE tutor_reservations SET status=? WHERE id=? AND learner=? AND status='sent'",
      )
      .bind(status, `course:${id}:${requestId}`, learner),
  ]);
  return thread(db, learner, id);
}
export async function deleteConversation(
  db: D1Database,
  learner: string,
  id: string,
) {
  await owned(db, learner, id);
  await db.batch([
    db
      .prepare(`UPDATE tutor_reservations SET status='unknown' WHERE learner=? AND status='sent'
      AND id IN (SELECT 'course:' || conversation_id || ':' || request_id FROM tutor_messages WHERE conversation_id=? AND learner=?)`)
      .bind(learner, id, learner),
    db
      .prepare(
        "UPDATE tutor_conversations SET deleted_at=?,context_snapshot='',pending_request_id=NULL,pending_at=NULL WHERE id=? AND learner=?",
      )
      .bind(Date.now(), id, learner),
    db
      .prepare(
        'DELETE FROM tutor_messages WHERE conversation_id=? AND learner=?',
      )
      .bind(id, learner),
  ]);
  return { deleted: true };
}
