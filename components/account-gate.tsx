'use client';
import { useEffect, useState } from 'react';
import { timedFetch } from '@/lib/timed-fetch';
import AccountLogin from './account-login';

export default function AccountGate({
  children,
  initialReady = false,
}: {
  children: React.ReactNode;
  initialReady?: boolean;
}) {
  const [ready, setReady] = useState(initialReady);
  const [admin, setAdmin] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState('');
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void fetch('/api/studio?access=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (!cancelled) setAdmin(d?.admin === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    void fetch('/api/account/profile').then(async r => r.ok ? await r.json() : null).then((d: any) => {
      if (d) { setStudentName(d.studentName || ''); setNameDraft(d.studentName || ''); setAccountId(d.accountId || ''); }
    }).catch(() => {});
  }, [ready]);
  async function saveStudentName() {
    setNameBusy(true); setNameError('');
    try {
      const r = await fetch('/api/account/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ studentName: nameDraft }) });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error || '保存失败');
      setStudentName(d.studentName);
    } catch (e) { setNameError(e instanceof Error ? e.message : '保存失败'); }
    finally { setNameBusy(false); }
  }
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let stopped = false;
    setError('');
    async function sync() {
      const deadline = setTimeout(() => {
        if (!stopped) { setReady(false); setError('登录验证超时，请重新检查，或用系统浏览器打开 https://zhuanxinai.com/login。'); }
      }, 22000);
      try {
        const response = await timedFetch('/api/auth/session', {
          method: 'POST',
        });
        if (stopped) return;
        if (response.status === 401) {
          setReady(false);
          return;
        }
        if (!response.ok) throw new Error('登录状态已失效，请重新登录。');
        if (JSON.parse(response.text).authenticated !== true)
          throw new Error('请重新登录。');
        if (!stopped) {
          setReady(true);
          setError('');
        }
      } catch (failure) {
        if (!stopped) {
          setReady(false);
          setError(
            failure instanceof Error
              ? failure.message
              : '无法验证登录状态，请重试。',
          );
        }
      } finally { clearTimeout(deadline); }
    }
    if (!initialReady || retry > 0) void sync();
    const timer = setInterval(() => void sync(), 20 * 60 * 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [retry, initialReady]);
  async function logout() {
    setReady(false);
    try {
      const response = await timedFetch('/api/auth/session', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('退出未成功，请重试。');
      window.location.replace('/login');
    } catch {
      setError('退出请求未完成，请重试或重新登录。');
    }
  }
  if (!ready)
    return (
      <>
        <AccountLogin />
        {error && (
          <div className="shell" role="status"><p>{error}</p>
          <button
            className="text-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            重新检查
          </button>
          </div>
        )}
        <noscript>请开启浏览器的 JavaScript 后继续使用。</noscript>
      </>
    );
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 20,
          flexWrap: 'wrap',
          padding: '12px 24px',
        }}
      >
        {admin && <a href="/admin">课程管理</a>}
        <a href="/courses">学习课程</a>
        <a href="/login">设置 / 找回密码</a>
        <button className="text-button" onClick={logout}>
          退出登录
        </button>
      </div>
      <div className="account-student-bar">
        <span>{studentName ? `学生：${studentName}` : '还未设置学生姓名'}</span>
        {accountId && <span title={accountId}>账号编号：{accountId.slice(0, 8)}</span>}
        <label>学生姓名 <input value={nameDraft} maxLength={30} onChange={e => setNameDraft(e.target.value)} placeholder="例如：小明" /></label>
        <button className="text-button" disabled={nameBusy || !nameDraft.trim()} onClick={() => void saveStudentName()}>{nameBusy ? '保存中…' : '保存姓名'}</button>
        {nameError && <span role="alert">{nameError}</span>}
      </div>
      {children}
    </>
  );
}
