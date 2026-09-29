import { env } from '@/db/runtime';
import { getDatabase } from '@/db';
import { journeyReady as ready } from '@/server/journey/readiness';
import {
  EvidenceError,
  learnerCookie,
  UUID,
  digest,
  ensureProfile,
  receipt,
} from '@/server/evidence/store';
import {
  readJourney,
  changeJourney,
  tutorContext,
  journeyInput,
} from '@/server/journey/service';
import { view, type JourneyAction } from '@/server/journey/engine';
import { isSameOrigin } from '@/server/request-origin';
import {
  askTutor,
  tutorReady,
  validateTutorInput,
  quotaStatement,
  quotaDenied,
} from '@/server/tutor';
const config = env as typeof env & { EVIDENCE_MODE?: string };
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const messages: Record<string, string> = {
  SESSION_CHANGED: '学习档案已切换，请刷新后继续当前档案。',
  INVALID_SESSION: '请刷新页面，重新读取学习档案。',
  STALE_ACTIVITY: '学习进度已在另一处更新，请刷新进度后继续。',
  COMMAND_CONFLICT: '这次操作已用于不同内容，请刷新进度。',
  PROFILE_DELETED: '当前学习档案已删除，请返回课程重新开始。',
  SESSION_REQUIRED: '请先返回课程，恢复学习档案。',
  REVIEW_NOT_DUE: '复习还没有到时间，可以先学习其他课程。',
  INVALID_ANSWER: '请输入有效数字、分数，或选择一个选项。',
  ANSWER_FIRST: '先完成或跳过当前题目。',
  ALREADY_ANSWERED: '这道题已保存，请继续下一步。',
};
function failure(e: unknown) {
  if (e instanceof EvidenceError)
    return json(
      { error: messages[e.message] ?? e.message, code: e.message },
      e.status,
    );
  console.error('Learning journey unavailable');
  return json({ error: '暂时无法保存，请保留当前输入后重试。' }, 503);
}
export async function GET(request: Request) {
  if (!ready(request, config)) return json({ available: false });
  try {
    const learner = await learnerCookie(request);
    if (!learner) throw new EvidenceError('SESSION_REQUIRED', 401);
    return json(
      view(await readJourney(getDatabase(), learner), tutorReady(config)),
    );
  } catch (e) {
    return failure(e);
  }
}
async function body(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new EvidenceError('JSON_REQUIRED', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new EvidenceError('INVALID_INPUT', 400);
  const chunks: Uint8Array[] = [];
  let n = 0;
  while (true) {
    const c = await reader.read();
    if (c.done) break;
    n += c.value.length;
    if (n > 24000) {
      await reader.cancel();
      throw new EvidenceError('INPUT_TOO_LARGE', 413);
    }
    chunks.push(c.value);
  }
  const bytes = new Uint8Array(n);
  let i = 0;
  for (const c of chunks) {
    bytes.set(c, i);
    i += c.length;
  }
  try {
    const b = JSON.parse(new TextDecoder().decode(bytes));
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error();
    return b as Record<string, unknown>;
  } catch {
    throw new EvidenceError('INVALID_INPUT', 400);
  }
}
export async function POST(request: Request) {
  try {
    if (!ready(request, config)) throw new EvidenceError('NOT_READY', 403);
    if (!isSameOrigin(request))
      throw new EvidenceError('ORIGIN_DENIED', 403);
    const learner = await learnerCookie(request);
    if (!learner) throw new EvidenceError('SESSION_REQUIRED', 401);
    const b = await body(request);
    if (
      typeof b.commandId !== 'string' ||
      !UUID.test(b.commandId) ||
      !Number.isInteger(b.revision) ||
      Number(b.revision) < 0
    )
      throw new EvidenceError('INVALID_INPUT', 400);
    if (typeof b.sessionId !== 'string' || !UUID.test(b.sessionId))
      throw new EvidenceError('INVALID_SESSION', 400);
    const base = {
        commandId: b.commandId,
        revision: Number(b.revision),
        sessionId: b.sessionId,
      },
      db = getDatabase();
    if (b.action === 'tutor') {
      const input = validateTutorInput({
        questionId: 'absolute',
        message: b.message,
        history: b.history ?? [],
      });
      if (!input) throw new EvidenceError('INVALID_INPUT', 400);
      const before = await readJourney(db, learner);
      if (before.sessionId !== base.sessionId)
        throw new EvidenceError('SESSION_CHANGED', 409);
      const intro = b.intent === 'intro';
      const change = {
        ...base,
        action: 'help' as const,
        kind: intro ? 'tutor-intro' : 'tutor',
        requestHash: await digest(JSON.stringify(input)),
      };
      // Even a repeated stage introduction must reject a reused command with different content.
      await receipt(
        db,
        learner,
        base.commandId,
        await digest(JSON.stringify(journeyInput(change))),
      );
      if (
        intro &&
        (before.narrated ?? []).includes(`${before.phase}:${before.cycle}`)
      )
        return json({
          view: view(before, tutorReady(config)),
          reply: view(before).teacherMessage,
          source: 'course',
          notice: '本阶段的学习安排已保留。',
        });
      const reservation = `journey:${learner}:${b.commandId}`;
      const extra = tutorReady(config)
        ? [
            db
              .prepare(
                "INSERT INTO tutor_reservations (id,learner,status,created_at) VALUES (?,?,'reserved',?)",
              )
              .bind(reservation, learner, Date.now()),
            quotaStatement(db, learner),
          ]
        : [];
      let result;
      try {
        result = await changeJourney(db, learner, change, extra);
      } catch (e) {
        if (!quotaDenied(e)) throw e;
        result = await changeJourney(db, learner, change);
        return json({
          ...result,
          reply: result.help ?? result.view.teacherMessage,
          source: 'course',
          notice: 'AI 名额暂时用完，已提供课程引导。',
        });
      }
      result.view.providerAvailable = tutorReady(config);
      const fallback = {
        ...result,
        reply: result.help ?? result.view.teacherMessage,
        source: 'course',
      };
      if (!tutorReady(config))
        return json({
          ...fallback,
          notice: '当前使用课程引导，学习流程可以继续。',
        });
      if (before.revision !== base.revision)
        return json({
          ...fallback,
          notice: '这次请求已处理，不会重复调用 AI。',
        });
      const claim = await db
        .prepare(
          "UPDATE tutor_reservations SET status='sent' WHERE id=? AND status='reserved' AND EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL) RETURNING id",
        )
        .bind(reservation, learner)
        .all();
      if (!claim.results.length)
        return json({
          ...fallback,
          notice: '这次请求已处理，已提供课程引导。',
        });
      try {
        const reply = await askTutor(config, tutorContext(before), input);
        await db
          .prepare("UPDATE tutor_reservations SET status='complete' WHERE id=?")
          .bind(reservation)
          .run();
        await ensureProfile(db, learner);
        return json({ ...result, reply, source: 'model' });
      } catch {
        await db
          .prepare("UPDATE tutor_reservations SET status='unknown' WHERE id=?")
          .bind(reservation)
          .run();
        await ensureProfile(db, learner);
        return json({
          ...fallback,
          notice: 'AI 暂时未能回答，先按课程引导继续。',
        });
      }
    }
    if (
      ![
        'continue',
        'answer',
        'skip',
        'dismiss',
        'pause',
        'review',
        'help',
      ].includes(String(b.action))
    )
      throw new EvidenceError('INVALID_STEP', 400);
    if (
      (b.action === 'answer' || b.answer !== undefined) &&
      (typeof b.answer !== 'string' || b.answer.length > 120)
    )
      throw new EvidenceError('INVALID_ANSWER', 400);
    if (b.action === 'help' && !['hint', 'alternate'].includes(String(b.kind)))
      throw new EvidenceError('INVALID_INPUT', 400);
    const result = await changeJourney(db, learner, {
      ...base,
      action: b.action as JourneyAction | 'help',
      answer: b.answer as string | undefined,
      kind: b.kind as string | undefined,
    });
    result.view.providerAvailable = tutorReady(config);
    return json(result);
  } catch (e) {
    return failure(e);
  }
}
