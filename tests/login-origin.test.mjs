import test from 'node:test';
import assert from 'node:assert/strict';
import { secureLoginUrl } from '../lib/login-origin.ts';
test('public HTTP and test-domain pages use the HTTPS production origin before authentication', () => {
  assert.equal(secureLoginUrl('http://zhuanxinai.com/login?next=course#sms'), 'https://zhuanxinai.com/login?next=course#sms');
  assert.equal(secureLoginUrl('https://zhixu-math-314991-12-1489669739.sh.run.tcloudbase.com/'), 'https://zhuanxinai.com/');
  assert.equal(secureLoginUrl('https://zhuanxinai.com/login'), null);
  assert.equal(secureLoginUrl('http://localhost:3002/login'), null);
  assert.equal(secureLoginUrl('https://example.com/login'), null);
});
