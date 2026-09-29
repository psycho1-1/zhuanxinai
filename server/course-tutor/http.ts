import { env } from '../../db/runtime';
import { getDatabase } from '../../db/index.ts';
import {
  learnerCookie,
  ensureProfile,
  EvidenceError,
} from '../evidence/store.ts';
import { tutorReady } from '../tutor.ts';
import { courseContext, CourseError } from './context.ts';
import {
  listConversations,
  openConversation,
  thread,
  deleteConversation,
} from './store.ts';
import { sendCourseMessage, validateInput } from './service.ts';
import { isSameOrigin } from '../request-origin';
const errors: Record<string, string> = {
  INVALID_INPUT: '请求内容不正确，请刷新后重试。',
  INVALID_REQUEST: '请求编号不正确。',
  INVALID_CONTEXT: '请选择课程。',
  CONTEXT_NOT_FOUND: '课程不存在。',
  RESOURCE_MISMATCH: '视频资源已变化，请刷新课程。',
  CONTEXT_CHANGED: '课程内容已更新，请删除旧会话后重新开始。',
  CONVERSATION_NOT_FOUND: '会话已删除或不属于当前学习档案。',
  SESSION_REQUIRED: '请返回课程恢复学习身份。',
  REQUEST_CONFLICT: '此请求编号已用于其他内容。',
  BUSY_OR_STALE:
    '对话仍在处理中、已在另一处更新，或正在进行独立检查。请刷新对话，完成检查后再提问。',
};
async function body(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new CourseError('INVALID_INPUT', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new CourseError('INVALID_INPUT');
  let n = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const c = await reader.read();
    if (c.done) break;
    n += c.value.length;
    if (n > 8000) {
      await reader.cancel();
      throw new CourseError('INVALID_INPUT', 413);
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
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new CourseError('INVALID_INPUT');
  }
}
export async function handleCourse(
  request: Request,
  action: 'context' | 'conversations' | 'conversation' | 'messages',
  id?: string,
) {
  const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    if (
      request.method !== 'GET' &&
      !isSameOrigin(request)
    )
      throw new CourseError('INVALID_INPUT', 403);
    const learner = await learnerCookie(request);
    if (!learner) throw new CourseError('SESSION_REQUIRED', 401);
    const db = getDatabase();
    await ensureProfile(db, learner);
    const url = new URL(request.url);
    if (action === 'context')
      return json({
        context: courseContext(
          url.searchParams.get('lessonId'),
          url.searchParams.get('resourceId') ?? undefined,
        ),
        available: tutorReady(env),
      });
    if (action === 'conversations') {
      if (request.method === 'GET') {
        const c = courseContext(url.searchParams.get('lessonId'));
        return json({
          conversations: await listConversations(db, learner, c.lesson.id),
        });
      }
      const b = await body(request);
      if (
        !b ||
        Array.isArray(b) ||
        typeof b !== 'object' ||
        Object.keys(b).some((k) => !['lessonId', 'resourceId'].includes(k))
      )
        throw new CourseError('INVALID_INPUT');
      return json(
        await openConversation(
          db,
          learner,
          courseContext(b.lessonId, b.resourceId),
        ),
      );
    }
    if (!id) throw new CourseError('CONVERSATION_NOT_FOUND', 404);
    if (action === 'conversation') {
      if (request.method === 'DELETE')
        return json(await deleteConversation(db, learner, id));
      const before = url.searchParams.get('before');
      if (
        before !== null &&
        (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)))
      )
        throw new CourseError('INVALID_INPUT');
      return json(
        await thread(
          db,
          learner,
          id,
          before === null ? undefined : Number(before),
        ),
      );
    }
    return json(
      await sendCourseMessage(
        db,
        learner,
        id,
        validateInput(await body(request)),
        env,
      ),
    );
  } catch (e) {
    if (e instanceof CourseError)
      return json(
        { error: errors[e.code] ?? '暂时无法处理。', code: e.code },
        e.status,
      );
    if (e instanceof EvidenceError)
      return json(
        { error: '学习档案不可用，请返回课程。', code: 'SESSION_REQUIRED' },
        401,
      );
    console.error('Course tutor unavailable');
    return json(
      {
        error: '暂时无法保存或读取对话，请保留输入后重试。',
        code: 'STORAGE_UNAVAILABLE',
      },
      503,
    );
  }
}
