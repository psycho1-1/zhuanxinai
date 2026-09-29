import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const learners = [];
async function request(path, method = 'GET', body, cookie = '') {
  const r = await fetch(base + path, {
    method,
    headers: {
      origin: base,
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    body: await r.json(),
    cookie: r.headers.get('set-cookie')?.split(';')[0],
  };
}
const endpoint = '/api/course-tutor';
const assertOK = (r) => {
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
};
async function learner() {
  const r = await request('/api/learning');
  assertOK(r);
  learners.push(r.cookie);
  return r.cookie;
}
try {
  const a = await learner(),
    b = await learner();
  assert.equal(
    (await request(endpoint + '/conversations?lessonId=absolute')).status,
    401,
  );
  const context = assertOK(
    await request(endpoint + '/context?lessonId=absolute', 'GET', undefined, a),
  ).context;
  assert.equal(context.skills[0].id, 'S05');
  assert.equal(context.resource.provider, 'bilibili');
  assert.equal(
    (
      await request(
        endpoint + '/conversations',
        'POST',
        { lessonId: 'absolute', concept: 'FAKE' },
        a,
      )
    ).status,
    400,
  );
  let d = assertOK(
    await request(
      endpoint + '/conversations',
      'POST',
      { lessonId: 'absolute', resourceId: context.resource.id },
      a,
    ),
  );
  const id = d.conversation.id;
  const again = assertOK(
    await request(
      endpoint + '/conversations',
      'POST',
      { lessonId: 'absolute' },
      a,
    ),
  );
  assert.equal(again.conversation.id, id);
  assert.equal(
    (await request(endpoint + '/conversations/' + id, 'GET', undefined, b))
      .status,
    404,
  );
  const stateBefore = assertOK(
    await request('/api/v2/state', 'GET', undefined, a),
  );
  const journeyBefore = assertOK(
    await request('/api/journey', 'GET', undefined, a),
  );
  const learningBefore = assertOK(
    await request('/api/learning', 'GET', undefined, a),
  );
  const payload = {
    requestId: crypto.randomUUID(),
    revision: d.conversation.revision,
    action: 'ask',
    message: '懂了',
  };
  d = assertOK(
    await request(
      endpoint + '/conversations/' + id + '/messages',
      'POST',
      payload,
      a,
    ),
  );
  const retry = assertOK(
    await request(
      endpoint + '/conversations/' + id + '/messages',
      'POST',
      payload,
      a,
    ),
  );
  assert.deepEqual(retry, d);
  assert.equal(d.messages.length, 2);
  const messagesPath = endpoint + '/conversations/' + id + '/messages';
  assert.equal(
    (
      await request(
        messagesPath,
        'POST',
        { ...payload, requestId: crypto.randomUUID() },
        a,
      )
    ).status,
    409,
  );
  for (const key of ['skillId', 'studentModel', 'system', 'history']) {
    assert.equal(
      (await request(messagesPath, 'POST', { ...payload, [key]: 'fake' }, a))
        .status,
      400,
    );
  }
  assert.equal((await request(messagesPath, 'POST', payload, b)).status, 404);
  assert.equal(
    (
      await request(
        endpoint + '/conversations/' + id + '/messages',
        'POST',
        { ...payload, message: 'other' },
        a,
      )
    ).status,
    409,
  );
  for (const action of ['diagram', 'check']) {
    d = assertOK(
      await request(
        endpoint + '/conversations/' + id + '/messages',
        'POST',
        {
          requestId: crypto.randomUUID(),
          revision: d.conversation.revision,
          action,
          message: action,
        },
        a,
      ),
    );
  }
  assert.equal(d.messages[3].reply.diagram.type, 'number-line');
  assert.ok(d.messages[5].reply.check.question);
  const concurrent = {
    requestId: crypto.randomUUID(),
    revision: d.conversation.revision,
    action: 'ask',
    message: '谢谢',
  };
  const replies = await Promise.all([
    request(messagesPath, 'POST', concurrent, a),
    request(messagesPath, 'POST', concurrent, a),
  ]);
  for (const reply of replies) assertOK(reply);
  d = assertOK(
    await request(endpoint + '/conversations/' + id, 'GET', undefined, a),
  );
  assert.equal(d.messages.length, 8);
  assert.equal(
    d.messages.filter((m) => m.requestId === concurrent.requestId).length,
    2,
  );
  assert.deepEqual(
    assertOK(
      await request(endpoint + '/conversations/' + id, 'GET', undefined, a),
    ),
    d,
  );
  const other = assertOK(
    await request(
      endpoint + '/conversations',
      'POST',
      { lessonId: 'number-line' },
      a,
    ),
  );
  assert.equal(other.messages.length, 0);
  assert.notEqual(other.conversation.id, id);
  const stateAfter = assertOK(
    await request('/api/v2/state', 'GET', undefined, a),
  );
  const journeyAfter = assertOK(
    await request('/api/journey', 'GET', undefined, a),
  );
  assert.deepEqual(stateAfter.states, stateBefore.states);
  assert.equal(stateAfter.throughSeq, stateBefore.throughSeq);
  assert.deepEqual(journeyAfter, journeyBefore);
  assert.deepEqual(
    assertOK(await request('/api/learning', 'GET', undefined, a)),
    learningBefore,
  );
  assertOK(
    await request(endpoint + '/conversations/' + id, 'DELETE', undefined, a),
  );
  assert.equal(
    (await request(endpoint + '/conversations/' + id, 'GET', undefined, a))
      .status,
    404,
  );
  const recreated = assertOK(
    await request(
      endpoint + '/conversations',
      'POST',
      { lessonId: 'absolute' },
      a,
    ),
  );
  assert.notEqual(recreated.conversation.id, id);
  assert.equal(recreated.messages.length, 0);
  console.log(
    'PASS: local HTTP/D1 context, restore, request idempotency, learner/course isolation, diagram/check, deletion, and unchanged evidence/journey/student state. No model calls.',
  );
} finally {
  for (const cookie of learners) {
    const r = await request('/api/v2/me', 'DELETE', undefined, cookie);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
}
