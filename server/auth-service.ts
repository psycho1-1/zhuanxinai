import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getDatabase } from '../db/index';
export const authBase = 'https://zhixu-math-test-d2fi7r0hc6ae5fdb.api.tcloudbasegateway.com/auth/v1';
export class LoginError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function authCall(path: string, body: Record<string, unknown>, device: string) {
  const response = await fetch(authBase + path, { method: 'POST', headers: {
    'Content-Type': 'application/json', 'x-device-id': device,
  }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await response.json() as Record<string, any>;
  if (!response.ok) {
    const code = String(data.error ?? data.code ?? '').toLowerCase();
    console.warn('Authentication provider response', response.status, code);
    if (code.includes('captcha')) throw new LoginError('需要额外的人机验证，请稍后重试或联系管理员。', 429);
    if (code.includes('resource') || response.status === 429) throw new LoginError('请求次数过多，请稍后再试。', 429);
    throw new LoginError('验证未通过，请检查手机号、验证码或密码；新用户请先用验证码登录。', 400);
  }
  return data;
}
function encryptionKey() {
  const key = process.env.CLOUDBASE_SERVER_KEY ?? process.env.CLOUDBASE_APIKEY;
  if (!key) throw new Error('Missing session encryption key');
  return createHash('sha256').update(key).digest();
}
export function seal(value: unknown) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function unseal(value: string) {
  try {
    const bytes = Buffer.from(value, 'base64url'); const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
  } catch { return null; }
}
export function readCookie(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1) ?? '';
}
export function privateCookie(name: string, value: string, seconds: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
}
export async function readAuthBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new LoginError('请求内容为空。');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.length;
      if (size > 10000) { await reader.cancel(); throw new LoginError('请求过长。', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error();
    return body;
  } catch { throw new LoginError('请求格式不正确。'); }
}
export async function limit(bucket: string, maximum: number, interval: number) {
  const key = createHash('sha256').update(bucket).digest('hex');
  const window = Math.floor(Date.now() / interval);
  const result = await getDatabase().prepare(`INSERT INTO tutor_limits (bucket,window,used) VALUES (?,?,1)
    ON CONFLICT(bucket) DO UPDATE SET used=CASE WHEN tutor_limits.window=excluded.window THEN tutor_limits.used+1 ELSE 1 END,
    window=excluded.window WHERE tutor_limits.window<>excluded.window OR tutor_limits.used<? RETURNING used`).bind('auth:' + key, window, maximum).first();
  if (!result) throw new LoginError('请求次数过多，请稍后再试。', 429);
}
export function loginCookies(data: any, device: string) {
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string' || !Number.isFinite(data.expires_in)) throw new Error('Invalid authentication response');
  return [privateCookie('zhixu_account', data.access_token, Math.min(data.expires_in, 7200)),
    privateCookie('zhixu_refresh', seal({ token: data.refresh_token, device }), 7 * 86400),
    privateCookie('zhixu_pending', '', 0)];
}
