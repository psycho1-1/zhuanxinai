'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  topicTitles,
  purposeTitles,
  type Topic,
  type Purpose,
  type EvidencePublicItem,
  type SkillEvidence,
} from '@/lib/evidence-contract';
type ApiResult = {
  available: boolean;
  item: EvidencePublicItem | null;
  presentationId: string;
  reason: string;
  correct: boolean;
  feedback: string;
  evidenceClass: string;
  stateStatus: string;
  content: string;
  reply: string;
  notice?: string;
  recoveryCode: string;
  deleted: boolean;
};
type Activity = { presentationId: string; item: EvidencePublicItem };
type State = {
  profileLabel: string;
  hasRecovery: boolean;
  states: SkillEvidence[];
  active: Activity | null;
  throughSeq: number;
  reviewStatus: string;
};
async function api<T = ApiResult>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const r = await fetch(`/api/v2/${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(method !== 'GET' && body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const result = (await r.json()) as T & { error?: string };
  if (!r.ok || result.error)
    throw new Error(result.error ?? '暂时无法处理，请重试。');
  return result;
}
export default function EvidenceLab() {
  const [available, setAvailable] = useState<boolean | null>(null),
    [data, setData] = useState<State | null>(null);
  const [topic, setTopic] = useState<Topic>('absolute'),
    [purpose, setPurpose] = useState<Purpose>('diagnostic');
  const [activity, setActivity] = useState<Activity | null>(null),
    [answer, setAnswer] = useState(''),
    [feedback, setFeedback] = useState(''),
    [reason, setReason] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [recovery, setRecovery] = useState(''),
    [newCode, setNewCode] = useState(''),
    [deleting, setDeleting] = useState(false);
  const [help, setHelp] = useState(''),
    [deleted, setDeleted] = useState(false);
  const locked = useRef(false),
    activeId = useRef<string | null>(null),
    refreshRevision = useRef(0);
  const pending = useRef<{ key: string; id: string } | null>(null),
    started = useRef(0);
  const refresh = useCallback(async () => {
    const revision = ++refreshRevision.current;
    const s = await api<State>('state');
    if (revision !== refreshRevision.current) return s;
    if ((s.active?.presentationId ?? null) !== activeId.current) {
      setAnswer('');
      setHelp('');
      setMessage('');
      started.current = Date.now();
    }
    activeId.current = s.active?.presentationId ?? null;
    setData(s);
    setActivity(s.active);
    if (s.active) {
      setTopic(s.active.item.topic);
      setPurpose(s.active.item.purpose);
    }
    return s;
  }, []);
  useEffect(() => {
    let live = true;
    void api('status')
      .then(async (s) => {
        if (!live) return;
        setAvailable(s.available);
        if (s.available) await refresh();
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [refresh]);
  async function run(
    action: string,
    payload: Record<string, unknown>,
    done: (r: ApiResult) => void | Promise<void>,
    method = 'POST',
  ) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const { clientElapsedMs: _elapsed, ...identity } = payload;
    const key = JSON.stringify([action, identity]);
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      const result = await api(
        action,
        method,
        method === 'DELETE'
          ? undefined
          : { ...payload, commandId: pending.current.id },
      );
      pending.current = null;
      await done(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
      if (e instanceof Error && e.message.includes('恢复码已生成过'))
        pending.current = null;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function start() {
    await run('next', { topic, purpose }, async (r) => {
      setActivity(
        r.item ? { presentationId: r.presentationId, item: r.item } : null,
      );
      setReason(r.reason);
      setAnswer('');
      setFeedback('');
      setMessage('');
      setHelp('');
      started.current = Date.now();
      await refresh().catch((e) =>
        setError(`操作已保存，但状态暂时无法刷新：${e.message}`),
      );
    });
  }
  const item = activity?.item;
  return (
    <main className="evidence-shell">
      <header className="evidence-header">
        <Link href="/">← 返回砖芯 AI课程</Link>
        <span>学习证据 · 开发预览</span>
      </header>
      <h1>让下一步学习有依据</h1>
      <p className="evidence-notice">
        11 个能力定义 · 3 个诊断专题 · 60
        道原创草稿。内容尚未经真实教师审校，正式学生试点未开放。这里用于检查流程，不能据此认定真实学习效果。
      </p>
      {error ? (
        <p role="alert" className="evidence-error">
          {error}{' '}
          <button
            disabled={busy}
            onClick={() => void refresh().catch((e) => setError(e.message))}
          >
            刷新活动
          </button>
        </p>
      ) : null}
      {deleted ? (
        <section className="evidence-panel">
          <h2>档案已删除</h2>
          <p>此档案的课程答题、诊断记录和恢复码已清理。</p>
          <button onClick={() => window.location.reload()}>
            创建新档案并继续
          </button>
        </section>
      ) : available === null ? (
        <output>正在读取预览状态…</output>
      ) : !available ? (
        <section className="evidence-panel">
          <h2>正在准备与审校</h2>
          <p>
            预览只在明确启用的本地开发环境开放。原有课程、视频和练习可以继续使用。
          </p>
          <Link href="/">回到课程</Link>
        </section>
      ) : (
        <>
          <div className="evidence-states">
            {data?.states.map((s) => (
              <section key={s.topic} className="evidence-panel">
                <h2>{s.title}</h2>
                <strong>{s.status}</strong>
                <p>{s.evidence}</p>
                {s.reviewDue ? (
                  <small>
                    复测日期：
                    {new Date(s.reviewDue).toLocaleDateString('zh-CN')}
                  </small>
                ) : null}
              </section>
            ))}
          </div>
          <div className="evidence-workspace">
            <section className="evidence-panel">
              <h2>选择一次学习活动</h2>
              <div className="evidence-fields">
                <label>
                  专题
                  <select
                    value={topic}
                    disabled={!!activity || busy}
                    onChange={(e) => setTopic(e.target.value as Topic)}
                  >
                    {Object.entries(topicTitles).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  活动
                  <select
                    value={purpose}
                    disabled={!!activity || busy}
                    onChange={(e) => setPurpose(e.target.value as Purpose)}
                  >
                    {Object.entries(purposeTitles).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!activity ? (
                <button
                  className="evidence-primary"
                  disabled={busy || !data}
                  onClick={() => void start()}
                >
                  开始 / 下一题
                </button>
              ) : null}
              {reason ? (
                <details open className="evidence-reason">
                  <summary>为什么推荐</summary>
                  <p>{reason}</p>
                </details>
              ) : null}
              {item ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      'attempts',
                      {
                        presentationId: activity!.presentationId,
                        answer,
                        clientElapsedMs: Math.min(
                          Date.now() - started.current,
                          3600000,
                        ),
                      },
                      async (r) => {
                        setFeedback(
                          `${r.correct ? '这次答对了。' : '这次答案已记录。'} ${r.feedback} ${r.evidenceClass === 'independent' ? '已记为未获站内帮助的独立表现。' : '本次用于练习，不计入独立通过条件。'}${r.stateStatus === 'updating' ? '状态正在更新。' : ''}`,
                        );
                        setActivity(null);
                        setAnswer('');
                        await refresh().catch((e) =>
                          setError(
                            `操作已保存，但状态暂时无法刷新：${e.message}`,
                          ),
                        );
                      },
                    );
                  }}
                >
                  <div className="evidence-question">
                    <small>{purposeTitles[item.purpose]}</small>
                    <h3>{item.prompt}</h3>
                  </div>
                  {item.options ? (
                    <fieldset disabled={busy}>
                      <legend>选择一个答案</legend>
                      {item.options.map((o, i) => (
                        <label className="evidence-choice" key={i}>
                          <input
                            type="radio"
                            name="answer"
                            checked={answer === String(i + 1)}
                            onChange={() => setAnswer(String(i + 1))}
                          />
                          {String.fromCharCode(65 + i)}. {o}
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <label>
                      你的答案
                      <input
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="例如 −3、0.5 或 1/2"
                        disabled={busy}
                        autoComplete="off"
                        maxLength={120}
                      />
                    </label>
                  )}
                  <div className="evidence-actions">
                    <button
                      className="evidence-primary"
                      type="submit"
                      disabled={busy || !answer.trim()}
                    >
                      提交并保存
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          'skip',
                          { presentationId: activity!.presentationId },
                          async () => {
                            setActivity(null);
                            setAnswer('');
                            setFeedback('已跳过，不计为答错。');
                            await refresh().catch((e) =>
                              setError(
                                `操作已保存，但状态暂时无法刷新：${e.message}`,
                              ),
                            );
                          },
                        )
                      }
                    >
                      跳过这题
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          'skip',
                          {
                            presentationId: activity!.presentationId,
                            dismiss: true,
                          },
                          async () => {
                            setActivity(null);
                            setFeedback(
                              '已记录你的反馈，本专题将停止诊断追问。',
                            );
                            setPurpose('practice');
                            await refresh().catch((e) =>
                              setError(
                                `操作已保存，但状态暂时无法刷新：${e.message}`,
                              ),
                            );
                          },
                        )
                      }
                    >
                      这不是我的问题
                    </button>
                  </div>
                </form>
              ) : null}
              {feedback ? (
                <output className="evidence-feedback">{feedback}</output>
              ) : null}
            </section>
            <aside className="evidence-panel">
              <h2>需要一点帮助？</h2>
              <p>
                使用提示或 AI 后，系统会把这次表现单独记录。你仍可以继续学习。
              </p>
              <div className="evidence-actions">
                {(['hint', 'alternate', 'solution'] as const).map((kind, i) => (
                  <button
                    key={kind}
                    disabled={busy || !activity}
                    onClick={() =>
                      activity &&
                      void run(
                        'assistance',
                        { presentationId: activity.presentationId, kind },
                        (r) => setHelp(r.content),
                      )
                    }
                  >
                    {['给我提示', '换一种讲解', '查看解法'][i]}
                  </button>
                ))}
              </div>
              {help ? (
                <output className="evidence-feedback" aria-label="学习帮助">
                  {help}
                </output>
              ) : null}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (activity)
                    void run(
                      'tutor',
                      {
                        presentationId: activity.presentationId,
                        message: message.trim(),
                        history: [],
                      },
                      (r) => setHelp(`${r.reply}\n${r.notice ?? ''}`),
                    );
                }}
              >
                <label>
                  问 AI 一个具体问题
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={600}
                    disabled={busy || !activity}
                  />
                </label>
                <button disabled={busy || !activity || !message.trim()}>
                  请 AI 引导我
                </button>
              </form>
              <p className="evidence-small">
                帮助只记录必要类型和版本，不保存完整聊天正文。AI
                不改分。评测题族的平行性仍待教师核对。
              </p>
            </aside>
          </div>
          <section className="evidence-panel">
            <h2>{data?.profileLabel ?? '学习档案'}</h2>
            <p>
              共享设备请明确切换档案。恢复码由你保管，持有码的人可以访问该档案。
            </p>
            <div className="evidence-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void run('profile', { action: 'recovery' }, async (r) => {
                    setNewCode(r.recoveryCode);
                    await refresh();
                  })
                }
              >
                {data?.hasRecovery ? '重置恢复码' : '生成恢复码'}
              </button>
              <button
                disabled={busy || !!activity}
                onClick={() =>
                  void run('profile', { action: 'new' }, async () => {
                    setNewCode('');
                    setAnswer('');
                    setHelp('');
                    setMessage('');
                    setRecovery('');
                    setDeleting(false);
                    setFeedback('');
                    setReason('');
                    await refresh().catch((e) =>
                      setError(`操作已保存，但状态暂时无法刷新：${e.message}`),
                    );
                  })
                }
              >
                创建并切换到新档案
              </button>
            </div>
            {newCode ? (
              <div className="evidence-feedback">
                <strong>请保存恢复码（重置后旧码失效）</strong>
                <code className="evidence-code">{newCode}</code>
              </div>
            ) : null}
            <form
              className="evidence-fields"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  'profile',
                  { action: 'restore', recoveryCode: recovery },
                  async () => {
                    setRecovery('');
                    setNewCode('');
                    setAnswer('');
                    setHelp('');
                    setMessage('');
                    setDeleting(false);
                    setFeedback('');
                    setReason('');
                    await refresh().catch((e) =>
                      setError(`操作已保存，但状态暂时无法刷新：${e.message}`),
                    );
                  },
                );
              }}
            >
              <label>
                输入恢复码，恢复或切换档案
                <input
                  value={recovery}
                  onChange={(e) => setRecovery(e.target.value)}
                  maxLength={100}
                  disabled={busy}
                  autoComplete="off"
                />
              </label>
              <button disabled={busy || !recovery.trim()}>恢复档案</button>
            </form>
            <details>
              <summary>数据与删除</summary>
              <p>
                原始诊断事件按 30
                天保留策略清理，之后仅能从必要的版本化摘要继续计算。当前预览维护由开发命令执行，尚未配置线上定时任务。托管备份恢复流程须另行验证。
              </p>
              <button onClick={() => setDeleting(true)}>删除当前档案…</button>
              {deleting ? (
                <div role="alert">
                  <p>
                    这会删除本应用中此档案的课程答题和诊断记录，并使恢复码失效。
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        'me',
                        {},
                        async (r) => {
                          if (r.deleted) {
                            setData(null);
                            setActivity(null);
                            setNewCode('');
                            setFeedback('');
                            setHelp('');
                            setMessage('');
                            setAnswer('');
                            setRecovery('');
                            setDeleted(true);
                          } else
                            setFeedback(
                              '已停止此档案的个性化处理，删除仍在进行，请再次点击完成清理。',
                            );
                        },
                        'DELETE',
                      )
                    }
                  >
                    确认删除当前档案
                  </button>
                  <button onClick={() => setDeleting(false)}>取消</button>
                </div>
              ) : null}
            </details>
          </section>
        </>
      )}
    </main>
  );
}
