import assert from 'node:assert/strict';
import { itemById } from '../server/journey/content.ts';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const cookies = [];
async function profile() {
  const r = await fetch(base + '/api/learning');
  const c = r.headers.get('set-cookie').split(';')[0];
  cookies.push(c);
  return c;
}
async function get(cookie) {
  const r = await fetch(base + '/api/journey', { headers: { cookie } });
  assert.equal(r.status, 200);
  return r.json();
}
async function post(cookie, body) {
  const r = await fetch(base + '/api/journey', {
    method: 'POST',
    headers: { cookie, origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, ...(await r.json()) };
}
const cmd = (v, action, extra = {}) => ({
  commandId: crypto.randomUUID(),
  revision: v.revision,
  sessionId: v.sessionId,
  action,
  ...extra,
});
async function act(cookie, v, action, extra = {}) {
  const r = await post(cookie, cmd(v, action, extra));
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.view;
}
try {
  const c = await profile(),
    other = await profile();
  let v = await get(c);
  assert.equal(v.available, true);
  assert.equal(v.phase, 'learn');
  assert.equal((await post(other, cmd(v, 'continue'))).status, 409);
  assert.equal(
    v.providerAvailable,
    false,
    'Run this test with AI_TUTOR_ENABLED=false; no paid requests are made',
  );
  v = await act(c, v, 'continue');
  const b = cmd(v, 'answer', { answer: '-8' });
  const [a, retry] = await Promise.all([post(c, b), post(c, b)]);
  assert.equal(a.status, 200);
  assert.equal(retry.view.revision, a.view.revision);
  assert.equal((await post(c, { ...b, answer: '8' })).status, 409);
  v = a.view;
  assert.equal((await get(other)).homework.completed, 0);
  for (let n = 1; n < 5; n++) {
    v = await act(c, v, 'continue');
    v = await act(c, v, 'answer', {
      answer: String(itemById(v.current.id).answer),
    });
  }
  assert.equal(v.phase, 'analysis');
  const introCommand = cmd(v, 'tutor', {
    message: '接下来怎么学？',
    intent: 'intro',
  });
  const intro = await post(c, introCommand);
  assert.equal(intro.status, 200);
  assert.equal(
    (await post(c, { ...introCommand, message: '不同内容' })).status,
    409,
  );
  const again = await post(
    c,
    cmd(intro.view, 'tutor', { message: '接下来怎么学？', intent: 'intro' }),
  );
  assert.equal(again.status, 200);
  assert.equal(again.view.revision, intro.view.revision);
  v = again.view;
  assert.match(v.reason, /第 1 题/);
  assert.equal(v.homework.correct, 4);
  v = await act(c, v, 'continue');
  assert.equal(v.phase, 'diagnose');
  v = await act(c, v, 'answer', { answer: '-5' });
  v = await act(c, v, 'continue');
  v = await act(c, v, 'answer', { answer: '1' });
  v = await act(c, v, 'continue');
  assert.equal(v.phase, 'remedy');
  assert.equal((await get(c)).current.id, v.current.id);
  const ask = cmd(v, 'tutor', { message: '为什么距离没有负号？', history: [] });
  const help = await post(c, ask);
  assert.equal(help.status, 200);
  assert.equal(help.source, 'course');
  assert.ok(help.reply);
  assert.equal((await post(c, ask)).view.revision, help.view.revision);
  assert.equal((await post(c, { ...ask, message: 'different' })).status, 409);
  v = help.view;
  for (let n = 0; n < 20 && v.phase !== 'complete'; n++)
    v = await act(
      c,
      v,
      v.answered ? 'continue' : 'answer',
      v.answered ? {} : { answer: String(itemById(v.current.id).answer) },
    );
  assert.equal(v.status, 'independent');
  assert.equal(v.verification.independentCorrect, 3);
  assert.equal((await post(c, cmd(v, 'review'))).status, 400);
  const old = await fetch(base + '/api/learning', {
    headers: { cookie: c },
  }).then((r) => r.json());
  assert.equal(old.totals.attempts, 5);
  const deleted = await fetch(base + '/api/v2/me', {
    method: 'DELETE',
    headers: { cookie: c, origin: base },
  });
  assert.equal(deleted.status, 200);
  assert.equal((await post(c, cmd(v, 'continue'))).status, 401);
  console.log(
    'PASS: 实际课程接口自动分析、针对性补练、AI固定回退、幂等及并发、刷新恢复、隔离、旧进度同步和删除。',
  );
} finally {
  for (const cookie of cookies)
    await fetch(base + '/api/v2/me', {
      method: 'DELETE',
      headers: { cookie, origin: base },
    });
}
