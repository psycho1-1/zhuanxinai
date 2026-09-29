import { accountLearner, accountsEnabled } from '@/server/account';
import { getDatabase } from '@/db/index';
import { ensureProfile } from '@/server/evidence/store';
import { isSameOrigin } from '@/server/request-origin';
import { readInput } from '@/server/studio/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' } });
}

export async function GET(request: Request) {
  if (!accountsEnabled()) return json({ studentName: '' });
  const learner = await accountLearner(request);
  if (!learner) return json({ error: '请先登录。' }, 401);
  const db = getDatabase();
  await ensureProfile(db, learner);
  const row = await db.prepare('SELECT student_name FROM evidence_profiles WHERE id=?').bind(learner).first<{ student_name: string }>();
  return json({ studentName: row?.student_name ?? '', accountId: learner });
}

export async function PUT(request: Request) {
  if (!accountsEnabled()) return json({ error: '账号功能未启用。' }, 403);
  if (!isSameOrigin(request)) return json({ error: '请从本网站保存姓名。' }, 403);
  const learner = await accountLearner(request);
  if (!learner) return json({ error: '请先登录。' }, 401);
  let body: { studentName?: unknown };
  try { body = await readInput(request, 2048); } catch { return json({ error: '请求格式不正确。' }, 400); }
  const name = typeof body.studentName === 'string' ? body.studentName.trim() : '';
  if (!name || name.length > 30 || /[<>]/.test(name)) return json({ error: '请输入 1 到 30 个字符的学生姓名。' }, 400);
  const db = getDatabase();
  await ensureProfile(db, learner);
  await db.prepare('UPDATE evidence_profiles SET student_name=? WHERE id=?').bind(name, learner).run();
  return json({ studentName: name, accountId: learner });
}
