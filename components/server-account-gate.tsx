import { cookies } from 'next/headers';
import AccountGate from './account-gate';
import AccountLogin from './account-login';
import { accountCookie, verifyAccount } from '@/server/account';

export default async function ServerAccountGate({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const token = jar.get(accountCookie)?.value;
  const refresh = jar.get('zhixu_refresh')?.value;
  if (!token && !refresh) return <AccountLogin />;
  let authenticated = false;
  try { authenticated = !!await verifyAccount(token ?? ''); }
  catch { /* The client can retry while the sign-in form remains usable. */ }
  return <AccountGate initialReady={authenticated}>{children}</AccountGate>;
}
