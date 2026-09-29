'use client';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Lightbulb,
  LoaderCircle,
} from 'lucide-react';
import { lessons } from '@/lib/curriculum';
import { lessonVideos } from '@/lib/lesson-videos';
import type { JourneyView } from '@/lib/journey-contract';
import CourseLearningWorkspace from '@/components/course-learning-workspace';
type Reply = {
  view: JourneyView;
  help?: string;
  reply?: string;
  source?: string;
  notice?: string;
};
const lesson = lessons.find((l) => l.id === 'absolute')!;
async function load() {
  const identity = await fetch('/api/learning', { cache: 'no-store' });
  if (!identity.ok) throw new Error('暂时无法读取学习档案，请重试。');
  const r = await fetch('/api/journey', { cache: 'no-store' });
  const b = (await r.json()) as JourneyView & { error?: string };
  if (!r.ok) throw new Error(b.error ?? '暂时无法读取进度。');
  return b;
}
export default function AbsoluteJourney({
  fallback,
  onLeave,
  onNextLesson,
  onSaved,
}: {
  fallback?: ReactNode;
  onLeave?: () => void;
  onNextLesson?: () => void;
  onSaved?: () => Promise<void>;
}) {
  const [data, setData] = useState<JourneyView | null>(null),
    [unavailable, setUnavailable] = useState(false),
    [error, setError] = useState('');
  const [answer, setAnswer] = useState(''),
    [draft, setDraft] = useState(''),
    [help, setHelp] = useState(''),
    [replySource, setReplySource] = useState('');
  const [busy, setBusy] = useState(false),
    [refreshKey, setRefreshKey] = useState(0),
    [retry, setRetry] = useState(false);
  const lock = useRef(false),
    pending = useRef<Record<string, unknown> | null>(null),
    latest = useRef<JourneyView | null>(null),
    transcript = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]),
    intro = useRef(new Set<string>());
  const apply = useCallback((s: JourneyView) => {
    if (latest.current && latest.current.sessionId !== s.sessionId) {
      transcript.current = [];
      intro.current.clear();
    }
    if (
      latest.current &&
      (latest.current.sessionId !== s.sessionId ||
        latest.current.phase !== s.phase ||
        latest.current.current?.id !== s.current?.id)
    ) {
      setAnswer('');
      setHelp('');
      setDraft('');
    }
    latest.current = s;
    setData(s);
  }, []);
  useEffect(() => {
    let alive = true;
    void load()
      .then((s) => {
        if (alive) {
          setUnavailable(!s.available);
          if (s.available) apply(s);
          setError('');
        }
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [refreshKey, apply]);
  const run = useCallback(
    async (
      action: string,
      extra: Record<string, unknown> = {},
      isRetry = false,
    ) => {
      if (lock.current || !latest.current) return;
      lock.current = true;
      setBusy(true);
      setError('');
      const payload =
        isRetry && pending.current
          ? pending.current
          : {
              action,
              revision: latest.current.revision,
              sessionId: latest.current.sessionId,
              commandId: crypto.randomUUID(),
              ...extra,
              ...(action === 'tutor'
                ? { history: transcript.current.slice(-4) }
                : {}),
            };
      pending.current = payload;
      try {
        const response = await fetch('/api/journey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as Reply & { error?: string };
        if (!response.ok) {
          if (response.status < 500) {
            pending.current = null;
            setRetry(false);
          }
          throw new Error(result.error ?? '暂时无法完成，请重试。');
        }
        pending.current = null;
        setRetry(false);
        apply(result.view);
        if (
          result.reply &&
          payload.action === 'tutor' &&
          typeof payload.message === 'string'
        )
          transcript.current = [
            ...transcript.current,
            { role: 'user' as const, content: payload.message },
            { role: 'assistant' as const, content: result.reply },
          ].slice(-6);
        if (result.reply || result.help) {
          setHelp(
            `${result.reply ?? result.help}${result.notice ? '\n' + result.notice : ''}`,
          );
          setReplySource(result.source === 'model' ? 'AI 老师' : '课程引导');
        }
        if (payload.action === 'answer') void onSaved?.();
        if (payload.action === 'pause') {
          if (onLeave) onLeave();
          else window.location.assign('/');
        }
      } catch (e) {
        setRetry(!!pending.current);
        setError(e instanceof Error ? e.message : '网络连接失败，输入已保留。');
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [apply, onLeave, onSaved],
  );
  useEffect(() => {
    if (
      !data?.providerAvailable ||
      busy ||
      retry ||
      !['analysis', 'remedy', 'complete'].includes(data.phase)
    )
      return;
    const key = `${data.phase}:${data.phase === 'complete' ? data.status : ''}`;
    if (intro.current.has(key)) return;
    intro.current.add(key);
    void run('tutor', {
      message: '请根据刚才的学习记录，用两句话说明我们接下来怎么学。',
      intent: 'intro',
      history: [],
    });
  }, [data?.phase, data?.providerAvailable, data?.status, busy, retry, run]);
  if (unavailable)
    return (
      fallback ?? (
        <section className="panel journey-intro">
          <h2>这一课正在准备</h2>
          <p>新的教学流程还在审校中，可以继续使用原有课程。</p>
          <Link href="/">返回课程</Link>
        </section>
      )
    );
  if (!data)
    return (
      <section className="panel journey-intro">
        <output>{error || '正在接回你的学习进度…'}</output>
        {error ? (
          <button
            className="secondary"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            重新读取
          </button>
        ) : null}
      </section>
    );
  const q = data.current,
    checking = ['verify', 'review'].includes(data.phase),
    finished = data.phase === 'complete';
  const busyOrRetry = busy || retry;
  return (
    <div className="journey" aria-busy={busy}>
      <div className="journey-topline">
        <button
          className="back-button"
          disabled={busyOrRetry}
          onClick={() => void run('pause')}
        >
          <ArrowLeft size={17} />
          返回学习路径
        </button>
        <span>教学流程试用 · 内容待教师审校</span>
      </div>
      <ol className="journey-steps" aria-label="本课学习流程">
        {[
          ['learn', '学习'],
          ['homework', '练习'],
          ['analysis', '分析'],
          ['remedy', '补练'],
          ['verify', '检查'],
          ['complete', '小结'],
        ].map(([phase, label]) => (
          <li
            key={phase}
            aria-current={
              data.phase === phase ||
              (data.phase === 'diagnose' && phase === 'analysis') ||
              (data.phase === 'review' && phase === 'verify')
                ? 'step'
                : undefined
            }
          >
            {label}
          </li>
        ))}
      </ol>
      {error ? (
        <div role="alert" className="error-banner">
          {error}
          <div className="button-row">
            {retry ? (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void run('retry', {}, true)}
              >
                重试刚才的操作
              </button>
            ) : (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setRefreshKey((k) => k + 1)}
              >
                刷新学习进度
              </button>
            )}
          </div>
        </div>
      ) : null}
      <div
        className={
          data.phase === 'learn' || data.phase === 'homework'
            ? 'practice-layout'
            : 'journey-layout'
        }
      >
        {data.phase === 'learn' || data.phase === 'homework' ? (
          <CourseLearningWorkspace lesson={lesson} video={lessonVideos.absolute} />
        ) : null}
        <section
          className={`question-card panel journey-main ${finished ? 'journey-finished' : ''}`}
        >
          <div className="question-top">
            <span className="eyebrow">{data.phaseTitle}</span>
            {q ? (
              <span>
                {data.position} / {data.total}
              </span>
            ) : (
              <CheckCircle2 size={21} />
            )}
          </div>
          <div className="question-body">
            {q ? (
              <>
                <h2>{q.prompt}</h2>
                {checking ? (
                  <p className="input-help">
                    先独立完成这一组，结束后一起看结果。
                  </p>
                ) : null}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run('answer', { answer });
                  }}
                >
                  {q.options ? (
                    <fieldset
                      className="question-options"
                      disabled={busyOrRetry || data.answered}
                    >
                      <legend>选择你的答案</legend>
                      {q.options.map((o, i) => (
                        <label
                          key={o}
                          className={answer === String(i + 1) ? 'selected' : ''}
                        >
                          <input
                            type="radio"
                            name="journey-answer"
                            checked={answer === String(i + 1)}
                            onChange={() => setAnswer(String(i + 1))}
                          />
                          <span className="option-letter">
                            {String.fromCharCode(65 + i)}
                          </span>
                          {o}
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <>
                      <label htmlFor="journey-answer">你的答案</label>
                      <input
                        id="journey-answer"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        maxLength={64}
                        autoComplete="off"
                        placeholder="输入数字或分数"
                        disabled={busyOrRetry || data.answered}
                      />
                    </>
                  )}
                  {!data.answered ? (
                    <div className="button-row">
                      <button
                        className="primary"
                        disabled={busyOrRetry || !answer.trim()}
                      >
                        提交答案
                      </button>
                      <button
                        className="text-button"
                        type="button"
                        disabled={busyOrRetry}
                        onClick={() => void run('skip')}
                      >
                        不会，先跳过
                      </button>
                    </div>
                  ) : null}
                </form>
                {data.feedback ? (
                  <output
                    className={`feedback ${checking ? '' : data.feedback.correct ? 'correct' : 'incorrect'}`}
                  >
                    <strong>
                      {checking
                        ? '这道题已保存'
                        : data.feedback.correct === null
                          ? '已跳过'
                          : data.feedback.correct
                            ? '答对了'
                            : '我们再理解一步'}
                    </strong>
                    <p>{data.feedback.text}</p>
                  </output>
                ) : null}
              </>
            ) : (
              <>
                <h2>
                  {data.phase === 'learn'
                    ? '理解绝对值，从距离开始'
                    : data.phase === 'analysis'
                      ? '课后题完成了，我们看看下一步'
                      : data.status === 'delayed'
                        ? '隔天再试，也完成了'
                        : data.status === 'independent'
                          ? '这轮新题，你能独立完成了'
                          : '今天的学习先到这里'}
                </h2>
                {data.phase !== 'learn' ? (
                  <p>
                    本课完成 {data.homework.completed} 道课后题，首次答对{' '}
                    {data.homework.correct} 道。
                    {data.homework.helped
                      ? `其中 ${data.homework.helped} 道使用过帮助。`
                      : ''}
                  </p>
                ) : null}
                <p className="journey-reason">{data.reason}</p>
                {finished ? (
                  <>
                    <p>
                      独立新题中，未使用本站帮助且答对{' '}
                      {data.verification.independentCorrect}{' '}
                      道。补练完成和独立通过分别记录。
                    </p>
                    {data.reviewDue ? (
                      <p className="journey-review">
                        下次短复习：
                        {new Date(data.reviewDue).toLocaleDateString('zh-CN')}
                        。返回这一课即可继续。
                      </p>
                    ) : null}
                    <p className="subtle">
                      这轮检查只反映所做题目的表现，其他步骤会在后续学习中继续检查。
                    </p>
                  </>
                ) : null}
              </>
            )}
            {data.canContinue && !finished ? (
              <div className="button-row">
                <button
                  className="primary"
                  disabled={busyOrRetry}
                  onClick={() => void run('continue')}
                >
                  {data.continueLabel}
                  <ArrowRight size={17} />
                </button>
              </div>
            ) : null}
            {finished ? (
              <div className="button-row">
                {data.reviewDue ? (
                  <button
                    className="secondary"
                    disabled={busyOrRetry || !data.canReview}
                    onClick={() => void run('review')}
                  >
                    开始到期复习
                  </button>
                ) : null}
                <button
                  className="primary"
                  disabled={busyOrRetry}
                  onClick={() =>
                    onNextLesson
                      ? onNextLesson()
                      : window.location.assign('/?lesson=operations')
                  }
                >
                  继续下一课
                  <ArrowRight size={17} />
                </button>
              </div>
            ) : null}
            {['analysis', 'diagnose', 'remedy'].includes(data.phase) ? (
              <button
                className="text-button journey-dismiss"
                disabled={busyOrRetry}
                onClick={() => void run('dismiss')}
              >
                这不是我的问题，直接试新题
              </button>
            ) : null}
          </div>
        </section>
        {data.phase !== 'learn' && data.phase !== 'homework' ? (
          <aside className="panel journey-evidence">
            <h3>为什么这样安排</h3>
            <p>{data.reason}</p>
            <p className="subtle">
              一次先检查一个环节。你随时可以跳过，或返回课程稍后继续。
            </p>
          </aside>
        ) : null}
      </div>
      <section className="panel ai-tutor journey-tutor">
        <div className="ai-heading">
          <Bot size={24} />
          <div>
            <span className="eyebrow">{data.phaseTitle} · 陪你想下一步</span>
            <h2>AI 数学老师</h2>
          </div>
        </div>
        <p className="journey-teacher">{data.teacherMessage}</p>
        {help ? (
          <output className="ai-message">
            <strong>{replySource}</strong>
            <p>{help}</p>
          </output>
        ) : null}
        {busy ? (
          <output className="ai-thinking">
            <LoaderCircle size={16} className="spin" />
            正在处理这一步…
          </output>
        ) : null}
        <div className="ai-suggestions">
          <button
            disabled={busyOrRetry}
            onClick={() => void run('help', { kind: 'hint' })}
          >
            <Lightbulb size={16} />
            给我一个小提示
          </button>
          <button
            disabled={busyOrRetry}
            onClick={() => void run('help', { kind: 'alternate' })}
          >
            换一种讲解
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run('tutor', { message: draft, history: [] });
          }}
        >
          <label htmlFor="journey-tutor">说说你卡在哪一步</label>
          <textarea
            id="journey-tutor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={600}
            rows={2}
            disabled={busyOrRetry}
            placeholder="例如：这个负号为什么还保留着？"
          />
          <div className="ai-send">
            <small>
              {data.providerAvailable
                ? 'AI 会收到当前阶段、题目和相关作答摘要。'
                : '当前使用课程引导；AI 未启用也能完成学习。'}{' '}
              对话正文不在服务器保存。
            </small>
            <button className="primary" disabled={busyOrRetry || !draft.trim()}>
              问问老师
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
