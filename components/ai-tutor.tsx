'use client';
import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, Send, Trash2 } from 'lucide-react';
import type { TutorMessage } from '@/server/tutor';

export default function AiTutor({ questionId }: { questionId: string }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const [check, setCheck] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setStatusError(false);
    fetch('/api/tutor', { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const b = await r.json() as { available?: boolean };
        setAvailable(b.available === true);
      })
      .catch(() => {
        if (!abort.signal.aborted) setStatusError(true);
      });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, [check]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, busy]);
  async function send(text: string) {
    if (lock.current || !available || !text.trim()) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          questionId,
          message: text,
          history: messages.slice(-4),
        }),
      });
      const body = await response.json() as { reply?: string; error?: string };
      if (!response.ok)
        throw new Error(body.error || '暂时无法回答，请稍后重试。');
      if (typeof body.reply !== 'string')
        throw new Error('回答未完整收到，请稍后重试。');
      const reply = body.reply;
      setMessages((old) => [
        ...old,
        { role: 'user', content: text },
        { role: 'assistant', content: reply },
      ]);
      setDraft('');
    } catch (e) {
      setError(
        abort.signal.aborted
          ? '等待超时。问题已保留，请稍后重试。'
          : e instanceof Error
            ? e.message
            : '网络连接失败，请稍后重试。',
      );
    } finally {
      clearTimeout(timer);
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="ai-tutor panel" aria-labelledby="ai-heading">
      <div className="ai-heading">
        <Bot size={24} aria-hidden="true" />
        <div>
          <span className="eyebrow">03 / 一起想一想</span>
          <h2 id="ai-heading">AI 数学老师</h2>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className="ai-clear"
            disabled={busy}
            onClick={() => {
              setMessages([]);
              setError('');
            }}
          >
            <Trash2 size={15} />
            清空对话
          </button>
        )}
      </div>
      {statusError ? (
        <p role="status">
          暂时无法连接。
          <button
            className="source-link"
            type="button"
            onClick={() => setCheck((c) => c + 1)}
          >
            重新检查
          </button>
        </p>
      ) : available === null ? (
        <p role="status">正在连接 AI 老师…</p>
      ) : !available ? (
        <p className="ai-unavailable" role="status">
          AI 老师尚未启用。你可以先看视频，或使用题目下方的“给我一点提示”。
        </p>
      ) : (
        <>
          <p className="ai-intro">
            说说你卡在哪一步，我会结合当前题目给你提示。
          </p>
          <p className="ai-privacy">
            发送后，当前题目、最近答题结果和最近对话将交给 DeepSeek
            生成回答。请勿填写姓名、学校或联系方式。AI
            可能出错，判题以系统结果为准。
          </p>
          <div
            className="ai-messages"
            role="log"
            aria-live="polite"
            aria-label="本题辅导对话"
          >
            {messages.map((m, i) => (
              <div key={i} className={`ai-message ${m.role}`}>
                <strong>{m.role === 'user' ? '你' : 'AI 老师'}</strong>
                <p>{m.content}</p>
              </div>
            ))}
            {busy && (
              <p className="ai-thinking">
                <LoaderCircle className="spin" size={17} />
                正在思考这一步…
              </p>
            )}
            <div ref={end} />
          </div>
          <div className="ai-suggestions">
            {[
              '第一步应该怎么想？',
              '换个例子讲一讲',
              '帮我分析最近一次错误',
            ].map((text) => (
              <button
                type="button"
                key={text}
                disabled={busy}
                onClick={() => {
                  setDraft(text);
                  void send(text);
                }}
              >
                {text}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <label htmlFor="ai-question">问问 AI 老师</label>
            <textarea
              id="ai-question"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={600}
              rows={3}
              disabled={busy}
              placeholder="例如：为什么减去负数会变成加法？"
            />
            {error && (
              <p role="alert" className="answer-error">
                {error}
              </p>
            )}
            <div className="ai-send">
              <small>对话仅保留在当前题目页面</small>
              <button
                className="primary"
                type="submit"
                disabled={busy || !draft.trim()}
              >
                <Send size={16} />
                {busy ? '等待回答…' : '发送问题'}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
