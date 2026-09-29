import test from 'node:test';
import assert from 'node:assert/strict';
import { accountLearner, verifyAccount } from '../server/account.ts';
test('只接受服务器验证过的账号身份；忽略客户端伪造的学习者 Cookie', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const token = options.headers.Authorization;
    if (token === 'Bearer account-a') return Response.json({sub:'user-a'});
    if (token === 'Bearer account-b') return Response.json({sub:'user-b'});
    return Response.json({}, {status:401});
  };
  try {
    assert.equal(await accountLearner(new Request('https://example.com', {headers:{cookie:'zhixu_learner=00000000-0000-4000-8000-000000000000'}})), null);
    assert.equal(await verifyAccount('forged'), null);
    const a = await verifyAccount('account-a');
    const b = await verifyAccount('account-b');
    assert.ok(a && b);
    assert.notEqual(a.learner, b.learner);
    assert.equal((await verifyAccount('account-a')).learner, a.learner);
    assert.equal(await accountLearner(new Request('https://example.com', {headers:{cookie:`zhixu_account=account-a; zhixu_learner=${b.learner}`}})), a.learner);
    globalThis.fetch = async () => Response.json({});
    assert.equal(await verifyAccount('invalid-subject'), null);
  } finally { globalThis.fetch = original; }
});
