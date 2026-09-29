'use client';
import { useEffect, useRef, useState } from 'react';
import {
  assetUrl,
  type PublicCourse,
  type PublicSegment,
  type SegmentProgress,
  type SavedAnswer,
} from '@/lib/studio';
import { studioRequest as api } from '@/lib/studio-client';
type State = {
  course: PublicCourse;
  version: string;
  lastSegment: string;
  progress: SegmentProgress[];
  answers: SavedAnswer[];
};
export default function CourseStudy({
  id,
  preview,
}: {
  id?: string;
  preview?: PublicCourse;
}) {
  const [state, setState] = useState<State | null>(
      preview
        ? {
            course: preview,
            version: 'preview',
            lastSegment: '',
            progress: [],
            answers: [],
          }
        : null,
    ),
    [active, setActive] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0),
    [mediaRetry, setMediaRetry] = useState(0),
    [videoError, setVideoError] = useState(false);
  const savedAt = useRef(0),
    video = useRef<HTMLVideoElement>(null),
    saving = useRef(false);
  const segments =
    state?.course.chapters.flatMap((ch) =>
      ch.lessons.flatMap((l) =>
        l.segments.map((s) => ({
          ...s,
          lessonTitle: l.title,
          chapterTitle: ch.title,
        })),
      ),
    ) ?? [];
  const index = Math.max(
      0,
      segments.findIndex((s) => s.id === active),
    ),
    segment = segments[index],
    current = state?.progress.find((p) => p.segment_id === segment?.id);
  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    setError('');
    void api('/api/courses', { action: 'enroll', id })
      .then((r) => {
        if (!cancelled) {
          setState(r);
          setActive(r.lastSegment);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, preview, reload]);
  useEffect(() => {
    savedAt.current = 0;
    setVideoError(false);
  }, [active]);
  function acceptState(next: State) {
    setState((old) => {
      if (!old || old.version !== next.version) return next;
      const answers = new Map(old.answers.map((a) => [a.question_id, a]));
      for (const a of next.answers) {
        const prev = answers.get(a.question_id);
        if (
          !prev ||
          a.created_at > prev.created_at ||
          (a.created_at === prev.created_at &&
            (a.id > prev.id || (a.id === prev.id && a.status === 'done')))
        )
          answers.set(a.question_id, a);
      }
      const progress = new Map(old.progress.map((p) => [p.segment_id, p]));
      for (const p of next.progress) {
        const prev = progress.get(p.segment_id);
        progress.set(
          p.segment_id,
          prev
            ? {
                ...p,
                seconds: Math.max(prev.seconds, p.seconds),
                video_done: Math.max(prev.video_done, p.video_done),
                completed: Math.max(prev.completed, p.completed),
                skipped:
                  prev.completed && !p.completed ? prev.skipped : p.skipped,
              }
            : p,
        );
      }
      return {
        ...next,
        answers: [...answers.values()],
        progress: [...progress.values()],
      };
    });
  }
  function accessible(i: number) {
    return (
      !!preview ||
      segments
        .slice(0, i)
        .every((s) =>
          state?.progress.some((p) => p.segment_id === s.id && p.completed),
        )
    );
  }
  async function progress(action: string, seconds = 0, ended = false) {
    if (!segment || !state) return;
    if (preview) {
      if (['complete', 'skip'].includes(action) && segments[index + 1])
        setActive(segments[index + 1].id);
      return;
    }
    if (action === 'progress' && saving.current && !ended) return;
    if (action === 'progress') saving.current = true;
    else setBusy(true);
    try {
      const r = await api('/api/courses', {
        action,
        id,
        segmentId: segment.id,
        seconds,
        ended,
      });
      acceptState(r);
      setError('');
      if (['complete', 'skip'].includes(action) && segments[index + 1])
        setActive(segments[index + 1].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '进度保存失败，请重试。');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  if (!state)
    return (
      <div className="studio-empty">
        <p role={error ? 'alert' : 'status'}>{error || '正在载入课程…'}</p>
        {error && (
          <button onClick={() => setReload((x) => x + 1)}>重新载入</button>
        )}
      </div>
    );
  if (!segment)
    return (
      <div className="studio-empty">
        <h3>课程结构已准备就绪</h3>
        <p>添加章节、课时和学习片段后，就能在这里预览。</p>
      </div>
    );
  return (
    <div className="study-layout">
      <aside className="study-outline">
        <h3>{state.course.title}</h3>
        <p className="studio-muted">
          {preview
            ? '草稿预览'
            : `${state.progress.filter((p) => p.completed).length} / ${segments.length} 个片段已完成`}
        </p>
        {segments.map((s, i) => (
          <button
            key={s.id}
            disabled={!accessible(i) || busy}
            className={s.id === segment.id ? 'is-active' : ''}
            onClick={() => {
              setActive(s.id);
              setError('');
            }}
          >
            <small>
              {s.chapterTitle} / {s.lessonTitle}
            </small>
            <strong>
              {i + 1}. {s.title}
            </strong>
            <small>
              {state.progress.find((p) => p.segment_id === s.id)?.completed
                ? state.progress.find((p) => p.segment_id === s.id)?.skipped
                  ? '已跳过'
                  : '已完成'
                : accessible(i)
                  ? '可以学习'
                  : '完成前面的片段后解锁'}
            </small>
          </button>
        ))}
      </aside>
      <section className="study-content">
        <p className="studio-eyebrow">
          片段 {index + 1} / {segments.length}
        </p>
        <h2>{segment.title}</h2>
        <p className="study-goal">{segment.goal || '待填写学习目标'}</p>
        {segment.videoId ? (
          <>
            <video
              ref={video}
              key={`${segment.id}-${mediaRetry}`}
              className="studio-video"
              controls
              playsInline
              preload="metadata"
              src={`${assetUrl(segment.videoId)}&retry=${mediaRetry}`}
              onLoadedMetadata={() => {
                if (
                  video.current &&
                  current?.seconds &&
                  current.seconds < video.current.duration
                )
                  video.current.currentTime = current.seconds;
              }}
              onError={() => setVideoError(true)}
              onTimeUpdate={() => {
                const el = video.current;
                if (!el || Date.now() - savedAt.current < 15000) return;
                savedAt.current = Date.now();
                void progress('progress', Math.floor(el.currentTime));
              }}
              onPause={() => {
                const el = video.current;
                if (el && !el.ended)
                  void progress('progress', Math.floor(el.currentTime));
              }}
              onEnded={() => {
                const el = video.current;
                if (el)
                  void progress(
                    'progress',
                    Math.floor(el.duration || el.currentTime),
                    true,
                  );
              }}
            />
            {videoError && (
              <p className="studio-alert">
                视频暂时无法播放。
                <button
                  onClick={() => {
                    setMediaRetry((x) => x + 1);
                    setVideoError(false);
                  }}
                >
                  重新加载视频
                </button>
              </p>
            )}
          </>
        ) : (
          <div className="study-placeholder">
            <span>▷</span>
            <strong>{preview ? '视频待上传' : '本段为文字学习'}</strong>
            <p>
              {preview
                ? '可以先检查知识点和题目，录好视频后再补充。'
                : '阅读下面的讲解，再完成互动练习。'}
            </p>
          </div>
        )}
        {segment.notes && (
          <article className="studio-box">
            <h3>知识点讲解</h3>
            <p className="studio-pre">{segment.notes}</p>
          </article>
        )}
        {segment.questions.length > 0 && <h3>动手试一试</h3>}
        {segment.questions.map((q, i) => (
          <StudyQuestion
            key={`${state.version}-${segment.id}-${q.id}`}
            q={q}
            number={i + 1}
            saved={state.answers.find((a) => a.question_id === q.id)}
            preview={!!preview}
            submit={async (answer, requestId) => {
              const r = await api('/api/courses', {
                action: 'answer',
                id,
                segmentId: segment.id,
                questionId: q.id,
                answer,
                requestId,
              });
              acceptState(r);
            }}
          />
        ))}
        {error && (
          <p className="studio-alert" role="alert">
            {error}
            {segment.videoId && (
              <button
                onClick={() => {
                  const v = video.current;
                  if (v)
                    void progress(
                      'progress',
                      Math.floor(v.currentTime),
                      v.ended,
                    );
                }}
              >
                重新保存播放进度
              </button>
            )}
          </p>
        )}
        <div className="study-bottom">
          <span>
            {current?.completed
              ? current.skipped
                ? '此片段已跳过'
                : '此片段已完成'
              : segment.videoRequired
                ? '看完视频并完成互动后继续'
                : '完成本段学习后继续'}
          </span>
          <div className="studio-actions">
            {segment.allowSkip && (
              <button disabled={busy} onClick={() => void progress('skip')}>
                跳过本段
              </button>
            )}
            <button
              disabled={busy}
              className="studio-primary"
              onClick={() => void progress('complete')}
            >
              {busy
                ? '正在保存…'
                : index === segments.length - 1
                  ? '完成本课学习'
                  : '完成并继续 →'}
            </button>
          </div>
        </div>
        {index === segments.length - 1 && current?.completed && (
          <p className="studio-notice">
            本课程学习进度已保存，你可以随时回来复习。
          </p>
        )}
      </section>
    </div>
  );
}
function StudyQuestion({
  q,
  number,
  saved,
  preview,
  submit,
}: {
  q: PublicSegment['questions'][number];
  number: number;
  saved?: SavedAnswer;
  preview: boolean;
  submit: (answer: string, id: string) => Promise<void>;
}) {
  const [answer, setAnswer] = useState(saved?.answer ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const request = useRef(
    saved?.status === 'pending' ? saved.id : crypto.randomUUID(),
  );
  function change(v: string) {
    setAnswer(v);
    request.current = crypto.randomUUID();
    setError('');
  }
  return (
    <form
      className="studio-question"
      onSubmit={async (e) => {
        e.preventDefault();
        if (preview) {
          setError('这是草稿预览，正式发布后才会保存答案和生成反馈。');
          return;
        }
        setBusy(true);
        setError('');
        try {
          await submit(answer, request.current);
        } catch (e) {
          setError(e instanceof Error ? e.message : '提交失败，请重试。');
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <legend>
          第 {number} 题 ·{' '}
          {q.type === 'short' ? '简答' : q.type === 'boolean' ? '判断' : '单选'}
        </legend>
        <h4>{q.prompt || '待填写题目'}</h4>
        {q.type === 'short' ? (
          <textarea
            aria-label={`第${number}题答案`}
            maxLength={2000}
            rows={4}
            value={answer}
            onChange={(e) => change(e.target.value)}
            placeholder="写下你的思路…"
          />
        ) : (
          (q.type === 'boolean'
            ? [
                ['true', '正确'],
                ['false', '错误'],
              ]
            : q.options.map((o, i) => [String(i + 1), o])
          ).map(([value, label]) => (
            <label className="study-option" key={value}>
              <input
                type="radio"
                name={q.id}
                value={value}
                checked={answer === value}
                onChange={() => change(value)}
              />
              {label || '待填写选项'}
            </label>
          ))
        )}
        <button type="submit" disabled={!answer.trim() || busy}>
          {busy ? '正在评价…' : saved ? '重新提交' : '提交回答'}
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="studio-alert">
          {error}
        </p>
      )}
      {saved && (
        <div className="study-feedback">
          <strong>
            {saved.status === 'pending'
              ? '正在评价，可稍后重新提交查询'
              : saved.correct === null
                ? '暂不判定对错'
                : saved.correct
                  ? '回答正确'
                  : '再想一想'}
          </strong>
          <p className="studio-pre">{saved.feedback}</p>
          <small>
            {saved.source === 'ai'
              ? 'AI 教学反馈，仅供参考'
              : saved.source === 'rule'
                ? '按教师参考答案判分'
                : '教师参考答案'}
          </small>
        </div>
      )}
    </form>
  );
}
