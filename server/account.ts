import { createHash } from 'node:crypto';

export const accountCookie = 'zhixu_account';
export const accountsEnabled = () => process.env.ZHIXU_ACCOUNTS_ENABLED === 'true';
const environment = 'zhixu-math-test-d2fi7r0hc6ae5fdb';
export function accountToken(request: Request) {
  return request.headers.get('cookie')?.split(';').map(v => v.trim())
    .find(v => v.startsWith(`${accountCookie}=`))?.slice(accountCookie.length + 1) ?? '';
}

export function learnerIdForAccount(subject: string) {
  const bytes = createHash('sha256').update(`${environment}:${subject}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Buffer.from(bytes).toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export async function verifyAccount(token: string) {
  if (!token || token.length > 8192 || /[\r\n]/.test(token)) return null;
  const response = await fetch(`https://${environment}.api.tcloudbasegateway.com/auth/v1/user/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000), cache: 'no-store',
  });
  if (!response.ok) return null;
  const user = await response.json() as { sub?: string; phone_number?: string };
  if (typeof user.sub !== 'string' || !user.sub) return null;
  return { learner: learnerIdForAccount(user.sub), phone: user.phone_number ?? '' };
}

export function sessionCookie(token: string, maxAge = 3600) {
  return `${accountCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function accountLearner(request: Request) {
  const user = await verifyAccount(accountToken(request));
  return user?.learner ?? null;
}
