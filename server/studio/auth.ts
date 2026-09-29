import { createHash } from 'node:crypto';
import { accountToken, verifyAccount } from '../account.ts';
import { isSameOrigin } from '../request-origin.ts';
import { StudioError } from './content.ts';
export function adminPhoneHash(phone: string) {
  return createHash('sha256')
    .update(
      `studio-admin:${phone.replace(/\D/g, '').replace(/^86(?=1\d{10}$)/, '')}`,
    )
    .digest('hex');
}
export async function studioUser(request: Request) {
  // No anonymous or client-supplied role fallback, including in local development.
  const user = await verifyAccount(accountToken(request));
  if (!user) throw new StudioError('请先登录，再进入课程。', 401);
  return user;
}
export async function isAdmin(db: D1Database, user: { phone: string }) {
  if (!user.phone) return false;
  return !!(await db
    .prepare('SELECT phone_hash FROM cms_admins WHERE phone_hash=?')
    .bind(adminPhoneHash(user.phone))
    .first());
}
export async function requireAdmin(db: D1Database, request: Request) {
  const user = await studioUser(request);
  if (!(await isAdmin(db, user)))
    throw new StudioError(
      '这个账号没有课程管理权限。请使用管理员手机号登录。',
      403,
    );
  return user;
}
export function writeOrigin(request: Request) {
  if (!isSameOrigin(request)) throw new StudioError('请从本网站操作。', 403);
}
export async function readInput(
  request: Request,
  limit = 1500000,
): Promise<Record<string, any>> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new StudioError('请使用 JSON 格式。', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new StudioError('请求为空。');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new StudioError('提交内容过大，请减少课程内容。', 413);
    }
    chunks.push(value);
  }
  try {
    const b = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw 0;
    return b;
  } catch {
    throw new StudioError('请求格式不正确。');
  }
}
export const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export function failure(e: unknown) {
  if (e instanceof StudioError) return reply({ error: e.message }, e.status);
  console.error(
    'Studio request failed',
    e instanceof Error
      ? e.message.replace(/https?:\/\/\S+/g, '[service]')
      : 'unknown',
  );
  return reply({ error: '服务暂时不可用，内容未确认保存，请稍后重试。' }, 503);
}
