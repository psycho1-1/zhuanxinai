'use client';
import { useEffect, useRef, useState } from 'react';
import BrandLogo from '@/components/brand-logo';
import { timedFetch } from '@/lib/timed-fetch';
import { secureLoginUrl } from '@/lib/login-origin';
import { LOGIN_QUOTES, nextQuoteIndex } from '@/lib/login-quotes';

async function loginRequest(body: Record<string, unknown>) {
  const secureUrl = secureLoginUrl(window.location.href);
  if (secureUrl) { window.location.replace(secureUrl); throw new Error('正在切换到安全登录地址，请稍候。'); }
  const response = await timedFetch('/api/auth/flow', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)}, 45000);
  let result: {error?: string};
  try { result = JSON.parse(response.text); }
  catch { throw new Error('登录服务暂时不可用，请稍后重试。'); }
  if (!response.ok) throw new Error(result.error || '登录失败，请稍后重试。');
  return result;
}

export default function AccountLogin() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const quoteChosen = useRef(false);
  useEffect(() => {
    if (quoteChosen.current) return;
    quoteChosen.current = true;
    let previous = -1;
    try { const saved = localStorage.getItem('zhuanxinai-login-quote'); if (saved !== null) previous = Number(saved); } catch {}
    const next = nextQuoteIndex(previous);
    setQuoteIndex(next);
    try { localStorage.setItem('zhuanxinai-login-quote', String(next)); } catch {}
  }, []);
  const [mode, setMode] = useState<'sms' | 'password' | 'reset'>('sms');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const verification = useRef<{ phone: string; mode: string; verify: (code: string, password: string) => Promise<void> } | null>(null);
  useEffect(() => {
    if (!seconds) return;
    const timer = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  const phoneNumber = () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('请输入正确的 11 位手机号。');
    return `+86 ${phone}`;
  };
  async function sendCode() {
    setBusy(true); setError(''); setNotice('');
    try {
      const number = phoneNumber();
      await loginRequest({action: 'send', phone, mode});
      setSeconds(60); setNotice('验证码已发送，请查看手机短信。');
      verification.current = {phone, mode, verify: async () => {}};
      const check = await timedFetch('/api/auth/flow', {method: 'GET', cache: 'no-store', credentials: 'same-origin'});
      if (!check.ok || JSON.parse(check.text).pending !== true) {
        throw new Error('浏览器未保存验证记录。请用系统浏览器打开 https://zhuanxinai.com/login，并允许网站使用 Cookie 后重试。');
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : '验证码发送失败，请稍后重试。'); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const number = phoneNumber();
      if (mode !== 'password') {
        if (!/^\d{6}$/.test(code)) throw new Error('请输入 6 位短信验证码。');
        const pending = verification.current;
        if (!pending || pending.phone !== phone || pending.mode !== mode) throw new Error('请先获取当前手机号的验证码。');
      }
      await loginRequest({action: mode, phone, code, password});
      verification.current = null;
      window.location.assign('/');
    } catch (failure) { setError(failure instanceof Error ? failure.message : '登录失败，请重新获取验证码。'); }
    finally { setBusy(false); }
  }
  function changeMode(next: typeof mode) { setMode(next); setCode(''); setPassword(''); setError(''); setNotice(''); verification.current = null; }
  return <main className="login-shell">
    <div className="login-intro">
<a className="brand login-brand" href="/" aria-label="砖芯 AI 首页"><BrandLogo /></a>
<p className="login-kicker">给今天一个新的开始</p>
<h2 className="login-headline">{LOGIN_QUOTES[quoteIndex][0]}<br />{LOGIN_QUOTES[quoteIndex][1]}</h2>
<p className="login-description">看懂知识，动手练习。<br />和砖芯 AI 一起，积累看得见的进步。</p>
<div className="login-pillars"><span>知识点学习</span><span>AI 答疑</span><span>错题复习</span></div>
</div>
    <section className="login-card">
      <h1>{mode === 'reset' ? '设置或找回密码' : '登录'}</h1>
      <p className="login-subtitle">登录后，继续你的学习进度。</p>
      <div className="login-modes" role="group" aria-label="登录方式">
        <button type="button" className="login-mode" onClick={() => changeMode('sms')} disabled={busy} aria-pressed={mode === 'sms'}>验证码登录</button>
        <button type="button" className="login-mode" onClick={() => changeMode('password')} disabled={busy} aria-pressed={mode === 'password'}>密码登录</button>
      </div>
      <form onSubmit={submit} className="login-form">
        <label>手机号<input aria-label="手机号" type="tel" autoComplete="tel-national" inputMode="numeric" placeholder="请输入手机号" maxLength={11} value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g,'')); verification.current = null; }} required className="login-input" /></label>
        {mode !== 'password' && <label>短信验证码<div className="login-code-row"><input aria-label="短信验证码" autoComplete="one-time-code" inputMode="numeric" placeholder="6 位验证码" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g,''))} required className="login-input" /><button type="button" onClick={sendCode} disabled={busy || seconds > 0} className="login-send-code">{seconds ? `${seconds} 秒后重发` : '获取验证码'}</button></div></label>}
        {mode !== 'sms' && <label>{mode === 'reset' ? '新密码（8–64 位）' : '密码'}<input aria-label="密码" type="password" autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} placeholder={mode === 'reset' ? '请设置 8–64 位密码' : '请输入密码'} maxLength={64} value={password} onChange={e => setPassword(e.target.value)} required className="login-input" /></label>}
        {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <button className="primary login-submit" disabled={busy}>{busy ? '正在处理…' : mode === 'reset' ? '保存密码并登录' : '登录'}</button>
        <button type="button" className="login-help" onClick={() => changeMode('reset')} disabled={busy}>设置密码 / 忘记密码</button>
        <p className="login-footnote">首次验证码登录将自动创建账号</p>
      </form>
    </section>
  </main>;
}
