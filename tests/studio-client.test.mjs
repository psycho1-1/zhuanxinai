import test from 'node:test';
import assert from 'node:assert/strict';
import { studioRequest, StudioRequestError } from '../lib/studio-client.ts';
import { timedFetch } from '../lib/timed-fetch.ts';

test('不支持 AbortSignal.timeout 的浏览器仍能读取和保存课程', async t => {
  const original = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');
  Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true });
  t.after(() => Object.defineProperty(AbortSignal, 'timeout', original));
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.credentials, 'same-origin');
    return Response.json({ method: init.method, body: init.body });
  });
  assert.equal((await studioRequest('/api/studio')).method, 'GET');
  assert.equal((await studioRequest('/api/studio', { action: 'save' })).body, '{"action":"save"}');
});

test('权限错误保留状态码，网络故障不伪装成权限问题', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: '请先登录' }, { status: 401 }));
  await assert.rejects(studioRequest('/api/studio'), e => e instanceof StudioRequestError && e.status === 401);
  mock.mock.mockImplementation(async () => { throw new TypeError('network error'); });
  await assert.rejects(studioRequest('/api/studio'), e => !(e instanceof StudioRequestError));
});

test('响应正文卡住也能超时退出', async t => {
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => ({
    text: () => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }),
  }));
  await assert.rejects(timedFetch('/api/studio', {}, 20), /连接超时/);
});
