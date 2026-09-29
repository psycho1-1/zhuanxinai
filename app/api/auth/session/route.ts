import { accountToken, verifyAccount } from '@/server/account';
import { isSameOrigin } from '@/server/request-origin';
import { authCall, readCookie, unseal, privateCookie, loginCookies } from '@/server/auth-service';
const json = (body: unknown, status = 200, cookies: string[] = []) => {
  const headers = new Headers({'Cache-Control':'no-store'});
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return Response.json(body, {status, headers});
};
export async function GET(request: Request) {
  try { return json({authenticated: !!await verifyAccount(accountToken(request))}); }
  catch { return json({error:'暂时无法验证登录状态。'}, 503); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({error:'请从本网站登录。'},403);
  try {
    if (await verifyAccount(accountToken(request))) return json({authenticated:true});
    const refresh = unseal(readCookie(request,'zhixu_refresh'));
    if (!refresh?.token || !refresh?.device) return json({authenticated:false},401);
    const data = await authCall('/token', {grant_type:'refresh_token', refresh_token:refresh.token}, refresh.device);
    return json({authenticated:true},200,loginCookies(data,refresh.device));
  } catch { return json({error:'请重新登录。'},401); }
}
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return json({error:'请从本网站退出。'},403);
  const refresh = unseal(readCookie(request,'zhixu_refresh'));
  if (refresh?.token && refresh?.device) {
    try { await authCall('/revoke', {token:refresh.token}, refresh.device); }
    catch { /* Always clear this browser's session, even during provider outages. */ }
  }
  return json({authenticated:false},200,['zhixu_account','zhixu_refresh','zhixu_pending'].map(name=>privateCookie(name,'',0)));
}
