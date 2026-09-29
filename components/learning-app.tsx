'use client';
import BrandLogo from '@/components/brand-logo';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Sprout,
  CheckCircle2,
  PlayCircle,
  RotateCcw,
  ChartNoAxesCombined,
  NotebookPen,
  Lightbulb,
  Target,
  Check,
  ChevronRight,
  LoaderCircle,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  chapters,
  lessons,
  displayAnswer,
  type Lesson,
  type PublicQuestion,
} from '@/lib/curriculum';
import type { LearningData } from '@/lib/progress';
import type { JourneyView } from '@/lib/journey-contract';
import CourseLearningWorkspace from '@/components/course-learning-workspace';
import AiTutor from '@/components/ai-tutor';
import AbsoluteJourney from '@/components/absolute-journey';
import { lessonVideos, formatDuration } from '@/lib/lesson-videos';

async function requestData(): Promise<LearningData> {
  const response = await fetch('/api/learning', { cache: 'no-store' });
  const body = (await response.json()) as LearningData & { error?: string };
  if (!response.ok) throw new Error(body.error || '学习记录暂时无法读取。');
  return body;
}
export default function LearningApp({
  initialLessonId,
}: {
  initialLessonId?: string;
}) {
  const [data, setData] = useState<LearningData | null>(null);
  const [journeyReminder, setJourneyReminder] = useState<JourneyView | null>(
    null,
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('courses');
  const [session, setSession] = useState<{
    lesson: Lesson;
    questionId?: string;
    key: number;
  } | null>(() => {
    const found = lessons.find((l) => l.id === initialLessonId);
    return found ? { lesson: found, key: 0 } : null;
  });
  const [showResolved, setShowResolved] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  async function refresh() {
    try {
      setData(await requestData());
      setError('');
      try {
        const r = await fetch('/api/journey', { cache: 'no-store' });
        const j = (await r.json()) as JourneyView;
        setJourneyReminder(
          r.ok &&
            j.available &&
            j.phase !== 'learn' &&
            (j.phase !== 'complete' || j.canReview)
            ? j
            : null,
        );
      } catch {
        setJourneyReminder(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败，请重试。');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  const progress = data?.progress ?? [];
  const mastered = progress.filter((p) => p.status === '基础掌握').length;
  const attempted = progress.reduce((n, p) => n + p.attempted, 0);
  const latest = data?.latest ?? [];
  const wrong = latest.filter((a) => a.everWrong && !a.correct);
  const resolved = latest.filter((a) => a.everWrong && a.correct);
  const recommended =
    lessons.find(
      (l) => progress.find((p) => p.lessonId === l.id)?.status === '学习中',
    ) ??
    lessons.find(
      (l) => progress.find((p) => p.lessonId === l.id)?.status !== '基础掌握',
    ) ??
    lessons[0];
  function begin(lesson: Lesson, questionId?: string) {
    setSession({ lesson, questionId, key: Date.now() });
    setTab('courses');
    setTimeout(() => headingRef.current?.focus(), 0);
  }
  function leave() {
    const reviewing = Boolean(session?.questionId);
    setSession(null);
    void refresh();
    if (reviewing) setTab('mistakes');
  }
  return (
    <>
      <a className="skip-link" href="#main">
        跳到学习内容
      </a>
      <header className="topbar">
        <a className="brand" href="/">
          <BrandLogo />
          <span className="brand-sub">让每一步学习有迹可循</span>
        </a>
        <span className="profile">
          <span className="avatar">初</span>初一学习者
        </span>
      </header>
      <main id="main" className="shell">
        <div className="eyebrow">
          <a href="/">我的课程</a> <span className="crumb">/</span> 初中{' '}
          <span className="crumb">/</span> 七年级上册 · 人教版（2024）
        </div>
        <div className="page-heading">
          <div>
            <h1 ref={headingRef} tabIndex={-1}>
              {session && tab === 'courses' ? session.lesson.title : '初一数学'}
            </h1>
            <p>
              {session && tab === 'courses'
                ? '先看视频，再动手练习。关键步骤可以暂停、回看。'
                : '从理解一个知识点，到独立解决一道题。'}
            </p>
          </div>
          <span className="tag">基础学习 · 第一期</span>
        </div>
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <TabsList className="main-tabs" variant="line" aria-label="学习导航">
            <TabsTrigger value="courses">
              <BookOpen />
              学习路径
            </TabsTrigger>
            <TabsTrigger value="mistakes">
              <NotebookPen />
              错题本
              {wrong.length > 0 && (
                <span className="count">{wrong.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="progress">
              <ChartNoAxesCombined />
              学习进度
            </TabsTrigger>
          </TabsList>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button className="text-button" onClick={() => void refresh()}>
                重新读取
              </button>
            </div>
          )}
          {loading && (
            <p className="loading" role="status">
              <LoaderCircle size={18} className="spin" />
              正在读取你的学习记录…
            </p>
          )}
          <TabsContent value="courses">
            {session && data ? (
              <Practice
                key={session.key}
                lesson={session.lesson}
                questions={data.questions.filter((q) =>
                  session.questionId
                    ? q.id === session.questionId
                    : q.lessonId === session.lesson.id,
                )}
                reviewing={!!session.questionId}
                onLeave={leave}
                onSaved={refresh}
                onNextLesson={() => {
                  const index = lessons.findIndex(
                    (l) => l.id === session.lesson.id,
                  );
                  begin(lessons[(index + 1) % lessons.length]);
                }}
              />
            ) : (
              <>
                {journeyReminder ? (
                  <section className="panel journey-intro">
                    <h2>接着完成绝对值这一课</h2>
                    <p>
                      上次停在「{journeyReminder.phaseTitle}」，作答已保存。
                    </p>
                    <button
                      className="primary"
                      onClick={() =>
                        begin(lessons.find((l) => l.id === 'absolute')!)
                      }
                    >
                      继续上次的学习 <ArrowRight size={18} />
                    </button>
                  </section>
                ) : null}
                <section className="welcome">
                  <div>
                    <span className="eyebrow">
                      {attempted ? '接着上次，继续向前' : '今天，从这里开始'}
                    </span>
                    <h2>
                      把基础学扎实，
                      <br />
                      每一步都算数。
                    </h2>
                    <p>
                      {recommended.title} <span className="crumb">·</span> 视频{' '}
                      {formatDuration(
                        lessonVideos[recommended.id].durationSeconds,
                      )}{' '}
                      <span className="crumb">·</span> 5 道练习
                    </p>
                    <button
                      className="primary"
                      disabled={!data}
                      onClick={() => begin(recommended)}
                    >
                      {attempted ? '继续学习' : '开始学习'}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                  <div
                    className="numberline"
                    aria-label="数轴，从负三到三，负三到原点的距离是三"
                  >
                    <div className="formula">|−3| = 3</div>
                    <div className="axis">
                      {[-3, -2, -1, 0, 1, 2, 3].map((n) => (
                        <span key={n} className={n === -3 ? 'marked' : ''}>
                          {n}
                          <i />
                        </span>
                      ))}
                    </div>
                    <p>距离原点 3 个单位，就是它的绝对值。</p>
                  </div>
                </section>
                <div className="stats-strip">
                  <Stat
                    icon={<BookOpen />}
                    value={
                      data ? `${attempted} / ${data.questions.length}` : '—'
                    }
                    label="已练习题目"
                  />
                  <Stat
                    icon={<Target />}
                    value={data ? `${mastered} / ${lessons.length}` : '—'}
                    label="基础掌握知识点"
                  />
                  <Stat
                    icon={<RotateCcw />}
                    value={data ? String(wrong.length) : '—'}
                    label="待复习错题"
                  />
                </div>
                <div className="section-heading">
                  <h2>你的学习路径</h2>
                  <span>
                    {chapters.length} 章 · {lessons.length} 节课 · 含综合实践
                  </span>
                </div>
                <div className="course-grid">
                  {chapters.map((chapter, i) => {
                    const chapterLessons = lessons.filter(
                      (l) => l.chapterId === chapter.id,
                    );
                    const done = chapterLessons.filter(
                      (l) =>
                        progress.find((p) => p.lessonId === l.id)?.status ===
                        '基础掌握',
                    ).length;
                    return (
                      <article className="course-card" key={chapter.id}>
                        <div
                          className={`chapter-symbol ${chapter.color}`}
                          aria-hidden="true"
                        >
                          {chapter.symbol}
                        </div>
                        <span className="eyebrow">单元 0{i + 1}</span>
                        <h3>{chapter.title}</h3>
                        <p>{chapter.description}</p>
                        <div className="chapter-progress">
                          <span>
                            {done} / {chapterLessons.length} 个知识点基础掌握
                          </span>
                          <Progress
                            value={(done / chapterLessons.length) * 100}
                            aria-label={`${chapter.title}掌握进度`}
                          />
                        </div>
                        <div className="lesson-list">
                          {chapterLessons.map((lesson) => {
                            const state = progress.find(
                              (p) => p.lessonId === lesson.id,
                            );
                            return (
                              <button
                                className="lesson-row"
                                key={lesson.id}
                                disabled={!data}
                                onClick={() => begin(lesson)}
                              >
                                {state?.status === '基础掌握' ? (
                                  <CheckCircle2
                                    size={18}
                                    className="success-text"
                                  />
                                ) : (
                                  <PlayCircle size={18} />
                                )}
                                <span>
                                  <span className="lesson-section">
                                    {lesson.section}
                                  </span>
                                  {lesson.title}
                                </span>
                                <small>
                                  {state && state.attempted
                                    ? `${state.mastery}%`
                                    : `视频 ${formatDuration(lessonVideos[lesson.id].durationSeconds)}`}
                                </small>
                                <ChevronRight size={16} />
                              </button>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
                <p className="content-note">
                  对齐人教版（2024）七年级上册正文知识点及两项综合实践。每节配视频、要点、例题和
                  5 道基础练习；阅读与拓展内容见教材，完整解题过程请在纸上练习。
                </p>
              </>
            )}
          </TabsContent>
          <TabsContent value="mistakes">
            <div className="section-heading">
              <div>
                <h2>把错题，变成下一次的进步</h2>
                <p>再做一次，答对后会自动标记为已订正。</p>
              </div>
            </div>
            <div className="filter-row">
              <button
                className={!showResolved ? 'filter active' : 'filter'}
                aria-pressed={!showResolved}
                onClick={() => setShowResolved(false)}
              >
                待复习 {wrong.length}
              </button>
              <button
                className={showResolved ? 'filter active' : 'filter'}
                aria-pressed={showResolved}
                onClick={() => setShowResolved(true)}
              >
                已订正 {resolved.length}
              </button>
            </div>
            {(showResolved ? resolved : wrong).length === 0 ? (
              <Empty className="empty-card">
                <EmptyHeader>
                  <div className="empty-icon">
                    {showResolved ? <CheckCircle2 /> : <NotebookPen />}
                  </div>
                  <EmptyTitle className="empty-title">
                    {showResolved
                      ? '还没有已订正的错题'
                      : wrong.length === 0 && resolved.length
                        ? '这轮错题都订正了'
                        : '暂时没有待复习的错题'}
                  </EmptyTitle>
                  <EmptyDescription className="empty-description">
                    {showResolved
                      ? '在待复习里重新答对一道题，它就会来到这里。'
                      : '继续练习，遇到的错题会自动保存在这里。'}
                  </EmptyDescription>
                </EmptyHeader>
                <button
                  className="primary"
                  disabled={!data}
                  onClick={() => {
                    setSession(null);
                    setTab('courses');
                  }}
                >
                  去学习 <ArrowRight size={18} />
                </button>
              </Empty>
            ) : (
              <div className="mistake-list">
                {(showResolved ? resolved : wrong).map((record) => {
                  const question = data!.questions.find(
                    (q) => q.id === record.questionId,
                  )!;
                  const lesson = lessons.find(
                    (l) => l.id === question.lessonId,
                  )!;
                  return (
                    <article className="mistake-card" key={record.questionId}>
                      <div>
                        <span className="eyebrow">{lesson.title}</span>
                        <h3>{question.prompt}</h3>
                        <p>
                          最近答案：
                          <strong>
                            {displayAnswer(question, record.answer)}
                          </strong>{' '}
                          <span className="crumb">·</span>{' '}
                          {new Date(record.createdAt).toLocaleDateString(
                            'zh-CN',
                            { timeZone: 'Asia/Shanghai' },
                          )}
                        </p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => begin(lesson, question.id)}
                      >
                        {showResolved ? '巩固一下' : '重新练习'}{' '}
                        <ArrowRight size={17} />
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="progress">
            <div className="section-heading">
              <div>
                <h2>看见每一步积累</h2>
                <p>每一个数字，都来自你完成的练习。</p>
              </div>
            </div>
            <div className="stats-strip">
              <Stat
                icon={<CheckCircle2 />}
                value={data ? String(data.totals.attempts) : '—'}
                label="累计答题次数"
              />
              <Stat
                icon={<Target />}
                value={
                  data
                    ? `${data.totals.attempts ? Math.round((data.totals.correct / data.totals.attempts) * 100) : 0}%`
                    : '—'
                }
                label="累计答题正确率"
              />
              <Stat
                icon={<BookOpen />}
                value={data ? String(data.totals.today) : '—'}
                label="今日答题次数"
              />
            </div>
            <div className="progress-layout">
              <section className="panel">
                <h3>知识点掌握情况</h3>
                <p className="subtle">先完成每个知识点的 5 道不同题目。</p>
                <div className="mastery-list">
                  {lessons.map((lesson) => {
                    const p = progress.find((s) => s.lessonId === lesson.id);
                    return (
                      <button
                        className="mastery-row"
                        key={lesson.id}
                        disabled={!data}
                        onClick={() => begin(lesson)}
                      >
                        <div>
                          <span>{lesson.title}</span>
                          <small
                            className={
                              p?.status === '基础掌握' ? 'success-text' : ''
                            }
                          >
                            {p?.status ?? '未开始'} · {p?.mastery ?? 0}%
                          </small>
                        </div>
                        <Progress
                          value={p?.mastery ?? 0}
                          aria-label={`${lesson.title}掌握度`}
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
              <aside className="progress-aside">
                <section className="panel">
                  <h3>最近 7 天</h3>
                  <div className="week-chart">
                    {Array.from({ length: 7 }, (_, i) => {
                      const date = new Date(Date.now() - (6 - i) * 86400000);
                      const day = new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'Asia/Shanghai',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      }).format(date);
                      const count =
                        data?.days.find((d) => d.day === day)?.count ?? 0;
                      const max = Math.max(
                        1,
                        ...(data?.days.map((d) => d.count) ?? []),
                      );
                      return (
                        <div className="day" key={day}>
                          <span>{count}</span>
                          <div className="bar-track">
                            <i
                              style={{
                                height: `${Math.max(3, (count / max) * 100)}%`,
                              }}
                              className={count ? 'filled' : ''}
                            />
                          </div>
                          <small>
                            {date
                              .toLocaleDateString('zh-CN', {
                                timeZone: 'Asia/Shanghai',
                                weekday: 'short',
                              })
                              .replace('周', '')}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  <p className="subtle">每天答题次数 · 北京时间</p>
                </section>
                <section className="rule-note">
                  <Lightbulb size={22} />
                  <h3>掌握度怎么计算？</h3>
                  <p>最近一次答对的不同题目数 ÷ 该知识点题目总数。</p>
                  <p>
                    完成全部 5 道题，且至少 4
                    道最近一次答对，标记为“基础掌握”。重复刷同一道题不会累加掌握度。
                  </p>
                  <small>这是基础练习指标，不能代替综合测评。</small>
                </section>
              </aside>
            </div>
          </TabsContent>
        </Tabs>
        <footer>
          <span className="footer-brand">
            <Sprout size={17} />
            砖芯 AI · 循序渐进，自有答案
          </span>
          <span>
            从理解到练习，记录每一步进步。
          </span>
        </footer>
      </main>
    </>
  );
}
function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

type PracticeProps = {
  lesson: Lesson;
  questions: PublicQuestion[];
  reviewing: boolean;
  onLeave: () => void;
  onSaved: () => Promise<void>;
  onNextLesson: () => void;
};
function Practice(props: PracticeProps) {
  return props.lesson.id === 'absolute' && !props.reviewing ? (
    <AbsoluteJourney
      onLeave={props.onLeave}
      onNextLesson={props.onNextLesson}
      onSaved={props.onSaved}
      fallback={<LegacyPractice {...props} />}
    />
  ) : (
    <LegacyPractice {...props} />
  );
}
function LegacyPractice({
  lesson,
  questions,
  reviewing,
  onLeave,
  onSaved,
  onNextLesson,
}: {
  lesson: Lesson;
  questions: PublicQuestion[];
  reviewing: boolean;
  onLeave: () => void;
  onSaved: () => Promise<void>;
  onNextLesson: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{
    correct: boolean;
    answer: number;
    explanation: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const pending = useRef<{
    requestId: string;
    questionId: string;
    answer: string;
  } | null>(null);
  const lock = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const question = questions[index];
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || result) return;
    lock.current = true;
    setBusy(true);
    setError('');
    pending.current ??= {
      requestId: crypto.randomUUID(),
      questionId: question.id,
      answer,
    };
    try {
      const response = await fetch('/api/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.current),
      });
      const body = (await response.json()) as {
        correct: boolean;
        answer: number;
        explanation: string;
        error?: string;
      };
      if (!response.ok) {
        if (response.status < 500) pending.current = null;
        throw new Error(body.error || '提交失败，请重试。');
      }
      setResult(body);
      if (body.correct) setCorrectCount((c) => c + 1);
      pending.current = null;
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络暂时不可用，请重试提交。');
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  function next() {
    if (index === questions.length - 1) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setAnswer('');
    setResult(null);
    setError('');
    pending.current = null;
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  if (done)
    return (
      <section className="completion panel">
        <div className="completion-icon">
          <CheckCircle2 size={42} />
        </div>
        <span className="eyebrow">这一轮练习完成了</span>
        <h2>
          {correctCount === questions.length
            ? '认真思考，收获满满。'
            : '每次订正，都是一次进步。'}
        </h2>
        <p>
          本轮完成 {questions.length} 道题，答对 {correctCount}{' '}
          道。学习记录已保存。
        </p>
        {correctCount < questions.length && (
          <p>答错的题已加入错题本，可以在那里重新练习。</p>
        )}
        <div className="button-row">
          <button className="secondary" onClick={onLeave}>
            {reviewing ? '返回错题本' : '返回学习路径'}
          </button>
          {!reviewing && (
            <button className="primary" onClick={onNextLesson}>
              下一个知识点
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </section>
    );
  return (
    <>
      <button className="back-button" onClick={onLeave}>
        <ArrowLeft size={17} />
        {reviewing ? '返回错题本' : '返回学习路径'}
      </button>
      <div className="practice-layout">
        <CourseLearningWorkspace
          key={lesson.id}
          lesson={lesson}
          video={lessonVideos[lesson.id]}
        />
        <section className="question-card panel">
          <div className="question-top">
            <span className="eyebrow">
              02 / {reviewing ? '错题复习' : '动手练习'}
            </span>
            <span>
              {index + 1} / {questions.length}
            </span>
          </div>
          <Progress
            value={((index + (result ? 1 : 0)) / questions.length) * 100}
            aria-label="本轮练习进度"
          />
          <div className="question-body">
            <span className="question-type">
              基础练习 · {question.options ? '单项选择' : '数值填空'}
            </span>
            <h2>{question.prompt}</h2>
            <form onSubmit={submit}>
              <label htmlFor="answer">
                你的答案
                {question.unit && (
                  <span className="subtle">（单位：{question.unit}）</span>
                )}
              </label>
              {question.options ? (
                <fieldset
                  className="question-options"
                  disabled={busy || !!result || !!pending.current}
                >
                  <legend className="sr-only">选择你的答案</legend>
                  {question.options.map((option, i) => (
                    <label
                      key={i}
                      className={answer === String(i + 1) ? 'selected' : ''}
                    >
                      <input
                        type="radio"
                        name="choice"
                        value={String(i + 1)}
                        checked={answer === String(i + 1)}
                        onChange={(e) => setAnswer(e.target.value)}
                        required
                      />
                      <span className="option-letter">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <input
                  ref={inputRef}
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  maxLength={64}
                  autoComplete="off"
                  placeholder="输入数字或分数"
                  aria-describedby="answer-help"
                  disabled={busy || !!result || !!pending.current}
                  required
                />
              )}
              <p id="answer-help" className="input-help">
                {question.options
                  ? '选择一个选项后提交。'
                  : '可以输入 −3、0.5 或 1/2，只填数值。'}
              </p>
              {!result && (
                <button
                  className="primary submit"
                  type="submit"
                  disabled={busy || !answer.trim()}
                >
                  {busy ? (
                    <>
                      <LoaderCircle size={17} className="spin" />
                      正在保存…
                    </>
                  ) : pending.current ? (
                    '重试提交'
                  ) : (
                    '提交答案'
                  )}
                  {!busy && <Check size={18} />}
                </button>
              )}
            </form>
            {error && (
              <div role="alert" className="answer-error">
                {error}
                {pending.current && (
                  <p>已保留这次提交，点击“重试提交”不会重复记分。</p>
                )}
              </div>
            )}
            {result && (
              <div
                className={
                  result.correct ? 'feedback correct' : 'feedback incorrect'
                }
                role="status"
              >
                <strong>
                  {result.correct ? '答对了！' : '再理解一步，你就更接近了。'}
                </strong>
                <p>
                  正确答案：{displayAnswer(question, result.answer)}
                  {question.unit && ` ${question.unit}`}
                </p>
                <p>{result.explanation}</p>
                <small>
                  {result.correct
                    ? '本次结果已保存。'
                    : '已加入错题本，稍后可以重新练习。'}
                </small>
              </div>
            )}
          </div>
          <div className="question-bottom">
            {!result ? (
              <details>
                <summary>
                  <Lightbulb size={17} />
                  给我一点提示
                </summary>
                <p>{lesson.hint}</p>
                <small>课程提示</small>
              </details>
            ) : (
              <button className="primary" disabled={busy} onClick={next}>
                {index === questions.length - 1 ? '查看本轮结果' : '下一道题'}
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </section>
      </div>
      <AiTutor key={question.id} questionId={question.id} />
    </>
  );
}
