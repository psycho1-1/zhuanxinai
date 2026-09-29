import { getDatabase } from '@/db';
import { lessons } from '@/lib/curriculum';
import { gradeAnswer } from '@/lib/grading';
import { calculateProgress, type LatestAnswer } from '@/lib/progress';
import { questions, publicQuestions } from '@/server/questions';
import { ensureProfile, EvidenceError } from '@/server/evidence/store';
import { isSameOrigin } from '@/server/request-origin';
import { accountsEnabled, accountLearner } from '@/server/account';
import { totalsQuery, daysQuery } from '@/server/learning-stats';

const cookieName = 'zhixu_learner';
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function learnerFrom(request: Request) {
  if (accountsEnabled()) return accountLearner(request);
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  return value && uuid.test(value) ? value : null;
}
function json(body: unknown, status = 200, cookie?: string) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}
function fail(error: unknown) {
  console.error(
    'Learning API failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  return json({ error: '暂时无法保存或读取学习记录，请稍后重试。' }, 503);
}
export async function GET(request: Request) {
  try {
    let learner = await learnerFrom(request);
    if (!learner && accountsEnabled()) return json({ error: '请先登录。' }, 401);
    learner ??= crypto.randomUUID();
    const db = getDatabase();
    try {await ensureProfile(db,learner);}catch(error){if(accountsEnabled() || !(error instanceof EvidenceError))throw error;learner=crypto.randomUUID();await ensureProfile(db,learner);}
    const latestResult = await db
      .prepare(`SELECT a.question_id AS questionId, a.answer, a.correct, a.created_at AS createdAt,
   EXISTS(SELECT 1 FROM attempts w WHERE w.learner = a.learner AND w.question_id = a.question_id AND w.correct = 0) AS everWrong
   FROM attempts a WHERE a.learner = ? AND a.id = (SELECT MAX(b.id) FROM attempts b WHERE b.learner = a.learner AND b.question_id = a.question_id)`)
      .bind(learner)
      .all<LatestAnswer>();
    const totals = await db
      .prepare(totalsQuery)
      .bind(learner)
      .first();
    const days = await db
      .prepare(
        daysQuery,
      )
      .bind(learner)
      .all();
    const latest = latestResult.results;
    return json(
      {
        questions: publicQuestions,
        latest,
        progress: calculateProgress(
          lessons.map((l) => l.id),
          publicQuestions,
          latest,
        ),
        totals,
        days: days.results,
      },
      200,
      `${cookieName}=${learner}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request))
      return json({ error: '请从本网站提交答案。' }, 403);
    const learner = await learnerFrom(request);
    if (!learner)
      return json({ error: '学习身份已过期，请刷新页面后重试。' }, 401);
    if (
      !(request.headers.get('content-type') ?? '').includes('application/json')
    )
      return json({ error: '请求格式不正确。' }, 415);
    const raw = await request.text();
    if (raw.length > 1024) return json({ error: '答案内容过长。' }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: '请求格式不正确。' }, 400);
    }
    if (
      !body ||
      typeof body.answer !== 'string' ||
      typeof body.questionId !== 'string' ||
      typeof body.requestId !== 'string' ||
      !uuid.test(body.requestId)
    )
      return json({ error: '请填写有效答案后提交。' }, 400);
    const question = questions.find((q) => q.id === body.questionId);
    if (!question) return json({ error: '这道题不存在，请返回课程。' }, 404);
    if (
      question.options &&
      !question.options.some((_, i) => body.answer === String(i + 1))
    )
      return json({ error: '请选择一个有效选项。' }, 400);
    const graded = gradeAnswer(body.answer, question.answer);
    if (!graded.valid)
      return json(
        { error: '请输入一个数字或分数，例如 −3、0.5 或 1/2，不需要单位。' },
        400,
      );
    const db = getDatabase();
    try{await ensureProfile(db,learner);}catch(error){if(error instanceof EvidenceError)return json({error:'此学习档案已删除，请刷新后创建新档案。'},401);throw error;}
    // 请求 ID 是幂等键：网络重试不会生成重复答题记录。
    await db.batch([db.prepare(
        `INSERT INTO attempts (learner, request_id, question_id, answer, correct, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL) ON CONFLICT(learner, request_id) DO NOTHING`,
      )
      .bind(
        learner,
        body.requestId,
        question.id,
        body.answer.trim(),
        graded.correct ? 1 : 0,
        new Date().toISOString(),
        learner,
      ),db.prepare(`INSERT OR IGNORE INTO evidence_events (learner,command_id,kind,topic,payload,created_at)
        SELECT learner,'legacy:'||id,'legacy','legacy',json_object('legacyAttemptId',id,'itemId',question_id,'correct',correct,'assistance','unknown'),CAST(strftime('%s',created_at) AS INTEGER)*1000 FROM attempts WHERE learner=? AND request_id=? AND EXISTS(SELECT 1 FROM evidence_profiles WHERE id=? AND deleted_at IS NULL)`).bind(learner,body.requestId,learner)]);
    const saved = await db
      .prepare(
        'SELECT question_id AS questionId, answer, correct FROM attempts WHERE learner = ? AND request_id = ?',
      )
      .bind(learner, body.requestId)
      .first<{ questionId: string; answer: string; correct: number }>();
    if (
      !saved ||
      saved.questionId !== question.id ||
      saved.answer !== body.answer.trim()
    )
      return json({ error: '这次提交已处理，请重新打开练习后再试。' }, 409);
    return json({
      correct: saved.correct === 1,
      answer: question.answer,
      explanation: question.explanation,
    });
  } catch (error) {
    return fail(error);
  }
}
