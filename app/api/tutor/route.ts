import { env } from '@/db/runtime';
import { getDatabase } from '@/db';
import { lessons } from '@/lib/curriculum';
import { questions } from '@/server/questions';
import { ensureProfile, learnerCookie } from '@/server/evidence/store';
import { isSameOrigin } from '@/server/request-origin';
import {
  askTutor,
  reserveTutorBudget,
  tutorInstructions,
  tutorReady,
  validateTutorInput,
} from '@/server/tutor';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
export function GET() {
  return json({ available: tutorReady(env), provider: 'DeepSeek' });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return json({ error: '请从本网站提问。' }, 403);
  const learner = await learnerCookie(request);
  if (
    !learner ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      learner,
    )
  )
    return json({ error: '请刷新页面，恢复学习身份后再提问。' }, 401);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return json({ error: '请求格式不正确。' }, 415);
  if (!tutorReady(env))
    return json(
      { error: 'AI 老师尚未启用，请先使用课程提示和视频讲解。' },
      503,
    );
  try {
    // 实际读取时限制字节数，不能仅相信 Content-Length。
    const reader = request.body?.getReader();
    if (!reader) return json({ error: '请填写问题。' }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24000) {
        await reader.cancel();
        return json({ error: '内容太长，请缩短后重试。' }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return json({ error: '请求格式不正确。' }, 400);
    }
    const input = validateTutorInput(parsed);
    if (!input)
      return json(
        { error: '请填写 600 字以内的问题，或清空对话后重试。' },
        400,
      );
    const question = questions.find((q) => q.id === input.questionId);
    const lesson = lessons.find((l) => l.id === question?.lessonId);
    if (!question || !lesson)
      return json({ error: '题目不存在，请返回课程。' }, 404);
    const db = getDatabase();
    await ensureProfile(db,learner);
    const attempt = await db
      .prepare(
        'SELECT answer, correct FROM attempts WHERE learner = ? AND question_id = ? ORDER BY id DESC LIMIT 1',
      )
      .bind(learner, question.id)
      .first<{ answer: string; correct: number }>();
    if (!(await reserveTutorBudget(db, learner)))
      return json(
        {
          error:
            '提问较频繁，或今日 AI 名额已用完。请稍后再试，也可以继续看视频和做题。',
        },
        429,
      );
    const reply = await askTutor(
      env,
      tutorInstructions(lesson, question, attempt),
      input,
    );
    await ensureProfile(db,learner);
    return json({ reply });
  } catch {
    console.error('Tutor request failed');
    return json({ error: 'AI 暂时没有回答。问题已保留，请稍后再试。' }, 503);
  }
}
