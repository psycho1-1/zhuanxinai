import assert from 'node:assert/strict';
import { items } from '../server/evidence/catalog.ts';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
assert.ok(
  ['localhost', '127.0.0.1'].includes(new URL(base).hostname),
  'Only run destructive test profiles locally',
);
const sessions = new Set();
async function request(
  path,
  method = 'GET',
  body,
  session = '',
  origin = base,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      origin,
      ...(session ? { cookie: session } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method !== 'GET' && body ? { body: JSON.stringify(body) } : {}),
  });
  const cookie = r.headers.get('set-cookie')?.split(';')[0] ?? session;
  if (cookie && cookie !== 'zhixu_learner=') sessions.add(cookie);
  return {
    status: r.status,
    body: r.headers.get('content-type')?.includes('application/json')
      ? await r.json()
      : await r.text(),
    cookie,
  };
}
const post = (path, body, cookie) =>
  request('/api/v2/' + path, 'POST', body, cookie);
const uuid = () => crypto.randomUUID();
const right = (p) => String(items.find((i) => i.id === p.item.id).answer);
try {
  assert.equal((await request('/api/v2/status')).body.available, true);
  const a = await request('/api/v2/state'),
    cookie = a.cookie;
  assert.equal(a.body.states[0].status, '未评估');
  const next = { commandId: uuid(), topic: 'absolute', purpose: 'pretest' };
  const p = (await post('next', next, cookie)).body;
  assert.equal('answer' in p.item, false);
  assert.equal(
    (await post('next', next, cookie)).body.presentationId,
    p.presentationId,
  );
  const b = await request('/api/v2/state');
  assert.equal(
    (
      await post(
        'attempts',
        {
          commandId: uuid(),
          presentationId: p.presentationId,
          answer: right(p),
        },
        b.cookie,
      )
    ).status,
    404,
  );
  const help = {
    commandId: uuid(),
    presentationId: p.presentationId,
    kind: 'hint',
  };
  assert.equal((await post('assistance', help, cookie)).status, 200);
  const submission = {
    commandId: uuid(),
    presentationId: p.presentationId,
    answer: right(p),
  };
  const responses = await Promise.all([
    post('attempts', submission, cookie),
    post('attempts', submission, cookie),
  ]);
  assert.equal(responses[0].status, 200);
  assert.equal(responses[1].status, 200);
  assert.equal(responses[0].body.eventSeq, responses[1].body.eventSeq);
  assert.equal(responses[0].body.evidenceClass, 'assisted_or_familiar');
  assert.equal(
    (await post('attempts', { ...submission, answer: '987' }, cookie)).status,
    409,
  );
  const issued = await Promise.all([
    post(
      'next',
      { commandId: uuid(), topic: 'addition', purpose: 'pretest' },
      cookie,
    ),
    post(
      'next',
      { commandId: uuid(), topic: 'addition', purpose: 'pretest' },
      cookie,
    ),
  ]);
  assert.deepEqual(
    issued.map((r) => r.status).sort((a, b) => a - b),
    [200, 409],
  );
  const active = issued.find((r) => r.status === 200).body;
  assert.equal(
    (
      await post(
        'skip',
        { commandId: uuid(), presentationId: active.presentationId },
        cookie,
      )
    ).body.countsAsWrong,
    false,
  );
  const code = await post(
    'profile',
    { action: 'recovery', commandId: uuid() },
    cookie,
  );
  assert.equal(code.status, 200);
  const restored = await post(
    'profile',
    {
      action: 'restore',
      recoveryCode: code.body.recoveryCode,
      commandId: uuid(),
    },
    b.cookie,
  );
  assert.equal(restored.cookie, cookie);
  assert.equal(
    (
      await request(
        '/api/v2/next',
        'POST',
        next,
        cookie,
        'https://other.invalid',
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        'next',
        { commandId: uuid(), topic: 'absolute', purpose: 'delayed' },
        cookie,
      )
    ).status,
    409,
  );
  // Exercise the old API with this same evidence profile, then deletion.
  assert.equal(
    (
      await request(
        '/api/learning',
        'POST',
        { questionId: 'absolute-1', answer: '8', requestId: uuid() },
        cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request('/api/v2/me', 'DELETE', undefined, cookie)).body.deleted,
    true,
  );
  assert.equal(
    (
      await request(
        '/api/learning',
        'POST',
        { questionId: 'absolute-1', answer: '8', requestId: uuid() },
        cookie,
      )
    ).status,
    401,
  );
  assert.equal(
    (await request('/api/v2/state', 'GET', undefined, cookie)).status,
    401,
  );
  assert.equal(
    (
      await post(
        'profile',
        {
          action: 'restore',
          recoveryCode: code.body.recoveryCode,
          commandId: uuid(),
        },
        b.cookie,
      )
    ).status,
    401,
  );
  const fresh = await request('/api/learning', 'GET', undefined, cookie);
  assert.equal(fresh.status, 200);
  assert.notEqual(fresh.cookie, cookie);
  assert.equal(fresh.body.totals.attempts, 0);
  const profileCommand = { action: 'new', commandId: uuid() };
  const switched = await post('profile', profileCommand, fresh.cookie);
  assert.equal(switched.status, 200);
  assert.equal(
    (await post('profile', profileCommand, fresh.cookie)).cookie,
    switched.cookie,
  );
  assert.equal(
    (await post('profile', profileCommand, switched.cookie)).cookie,
    switched.cookie,
  );
  console.log(
    'PASS: 本地 D1 实际接口：幂等、并发、帮助分类、档案隔离、恢复、跳过、来源限制、延迟门槛、删除及旧接口兼容。',
  );
} finally {
  for (const cookie of sessions)
    await request('/api/v2/me', 'DELETE', undefined, cookie);
}
