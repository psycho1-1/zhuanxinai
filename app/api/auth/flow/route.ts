import { randomUUID } from 'node:crypto';
import { isSameOrigin } from '@/server/request-origin';
import { authCall, seal, unseal, readCookie, privateCookie, readAuthBody, limit, LoginError, loginCookies } from '@/server/auth-service';
export async function GET(request: Request) {
  const pending = unseal(readCookie(request, 'zhixu_pending'));
  return Response.json({pending: !!pending && pending.expires > Date.now()}, {headers: {'Cache-Control': 'no-store'}});
}
export async function POST(request: Request) {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (!isSameOrigin(request)) return json({ error: '请从本网站登录。' }, 403);
  try {
    const body = await readAuthBody(request);
    if (typeof body.phone !== 'string' || !/^1[3-9]\d{9}$/.test(body.phone)) throw new LoginError('请输入正确的 11 位手机号。');
    const phone = '+86 ' + body.phone;
    if (body.action === 'send') {
      await limit('sms:minute:' + phone, 1, 60000);
      await limit('sms:daily:' + phone, 5, 86400000);
      await limit('sms:daily:all', 50, 86400000);
      const device = randomUUID();
      const sent = await authCall('/verification', {phone_number: phone, target: body.mode === 'reset' ? 'USER' : 'ANY'}, device);
      if (typeof sent.verification_id !== 'string') throw new Error('Missing verification id');
      headers.append('Set-Cookie', privateCookie('zhixu_pending', seal({ phone, device, mode: body.mode === 'reset' ? 'reset' : 'sms', id: sent.verification_id, user: !!sent.is_user, expires: Date.now() + 600000 }), 600));
      return json({ sent: true });
    }
    await limit('login:' + phone, 10, 900000);
    await limit('login:all', 500, 86400000);
    let result; let device = randomUUID();
    if (body.action === 'password') {
      if (typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 64) throw new LoginError('请输入密码。');
      result = await authCall('/signin', {username: phone, password: body.password}, device);
    } else if (body.action === 'sms' || body.action === 'reset') {
      const pending = unseal(readCookie(request, 'zhixu_pending'));
      if (!pending || pending.expires < Date.now() || pending.phone !== phone || pending.mode !== body.action) throw new LoginError('请重新获取当前手机号的验证码。');
      if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new LoginError('请输入 6 位短信验证码。');
      if (body.action === 'reset' && (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 64)) throw new LoginError('请设置 8–64 位密码。');
      device = pending.device;
      const verified = await authCall('/verification/verify', {verification_id: pending.id, verification_code: body.code}, device);
      if (body.action === 'reset') {
        await authCall('/reset', {phone_number: phone, new_password: body.password, verification_token: verified.verification_token}, device);
        result = await authCall('/signin', {username: phone, password: body.password}, device);
      } else result = await authCall(pending.user ? '/signin' : '/signup', pending.user
        ? {username: phone, verification_token: verified.verification_token}
        : {phone_number: phone, verification_token: verified.verification_token}, device);
    } else throw new LoginError('登录方式不正确。');
    for (const cookie of loginCookies(result, device)) headers.append('Set-Cookie', cookie);
    return json({ authenticated: true });
  } catch (error) {
    return json({ error: error instanceof LoginError ? error.message : '登录服务暂时不可用，请稍后重试。' }, error instanceof LoginError ? error.status : 503);
  }
}
