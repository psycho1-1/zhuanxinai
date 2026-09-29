import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
let cookie = '';
async function get() {
  const r = await fetch(`${base}/api/learning`, {
    headers: cookie ? { cookie } : {},
  });
  assert.equal(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
  return r.json();
}
async function post(
  questionId,
  answer,
  requestId = crypto.randomUUID(),
  origin = base,
) {
  const r = await fetch(`${base}/api/learning`, {
    method: 'POST',
    headers: { cookie, origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, answer, requestId }),
  });
  return {
    status: r.status,
    body: r.headers.get('content-type')?.includes('application/json')
      ? await r.json()
      : await r.text(),
  };
}
let data = await get();
assert.equal(data.totals.attempts, 0);
assert.equal(data.questions.length, 205);
assert.equal('answer' in data.questions[0], false);
const id = crypto.randomUUID();
assert.equal((await post('absolute-1', '-8', id)).body.correct, false);
assert.equal((await post('absolute-1', '-8', id)).status, 200);
data = await get();
assert.equal(data.totals.attempts, 1);
assert.equal(data.latest[0].everWrong, 1);
assert.equal((await post('absolute-1', '8', id)).status, 409);
assert.equal((await post('absolute-1', '8')).body.correct, true);
data = await get();
assert.equal(data.latest[0].correct, 1);
assert.equal(data.latest[0].everWrong, 1);
assert.equal(data.totals.attempts, 2);
assert.equal((await post('absolute-5', '1/2')).body.correct, true);
const before = (await get()).totals.attempts;
assert.equal((await post('absolute-1', '1/0')).status, 400);
assert.equal((await post('missing', '3')).status, 404);
assert.equal(
  (
    await post(
      'absolute-1',
      '8',
      crypto.randomUUID(),
      'https://example.invalid',
    )
  ).status,
  403,
);
assert.equal((await get()).totals.attempts, before);
await post('absolute-2', '0');
await post('absolute-3', '5');
await post('absolute-4', '6');
data = await get();
assert.equal(
  data.progress.find((p) => p.lessonId === 'absolute').status,
  '基础掌握',
);
assert.equal(data.totals.today, data.totals.attempts);
assert.ok(data.days.some((d) => d.count > 0));
// 选择题同样保存错题与订正，非法选项不得进入学习记录。
assert.equal((await post('signed-numbers-3', '99')).status, 400);
assert.equal((await post('signed-numbers-3', '1')).body.correct, false);
assert.equal((await post('signed-numbers-3', '3')).body.correct, true);
const choices = await get();
assert.equal(
  choices.latest.find((q) => q.questionId === 'signed-numbers-3').everWrong,
  1,
);
assert.equal(
  choices.questions.find((q) => q.id === 'signed-numbers-3').options.length,
  3,
);
cookie = '';
const other = await get();
assert.equal(other.totals.attempts, 0);
assert.equal(other.latest.length, 0);
console.log(
  'PASS: 判题、分数、持久记录、重复提交、错题订正、掌握度、非法输入、跨来源拒绝、匿名身份隔离。',
);
