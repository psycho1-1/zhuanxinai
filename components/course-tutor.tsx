'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { MessageCircle, Send, Trash2, RotateCcw, Minus } from 'lucide-react';
import { useCourseTutor } from '@/hooks/use-course-tutor';
import { actionLabels, type CourseAction } from '@/lib/course-tutor-contract';
import TutorDiagram from './tutor-diagram';
import CourseTutorCheck from './course-tutor-check';
export default function CourseTutor({
  lessonId,
  enabled,
  onMinimize,
}: {
  lessonId: string;
  enabled: boolean;
  onMinimize?: () => void;
}) {
  const t = useCourseTutor(lessonId, enabled),
    inputId = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const lastMessage = t.data?.messages.at(-1);
  useEffect(() => {
    if (enabled && messagesRef.current)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [enabled, lastMessage?.id, lastMessage?.status]);
  const blocked = t.busy || t.waiting || t.loading || !t.context;
  return (
    <section
      className="course-tutor"
      aria-label="砖芯 AI课程Tutor"
      aria-busy={t.busy}
    >
      <header className="ct-heading">
        <span className="ct-bot">
          <MessageCircle size={20} />
        </span>
        <div>
          <h2>砖芯 AI 学习助手</h2>
          <p>当前：{t.context?.lesson.title ?? '正在接回本课…'}</p>
        </div>
        {t.data ? (
          <button
            type="button"
            className="ct-icon"
            title="删除本课聊天"
            aria-label="删除本课聊天"
            disabled={t.busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={17} />
          </button>
        ) : null}
        {onMinimize ? (
          <button
            type="button"
            className="ct-minimize"
            title="最小化问砖芯 AI"
            aria-label="最小化问砖芯 AI"
            onClick={onMinimize}
          >
            <Minus size={20} />
          </button>
        ) : null}
      </header>
      {t.context ? (
        <div className="ct-context">
          <span>
            {t.context.chapter.title} · {t.context.lesson.section}
          </span>
          {t.context.skills.map((s) => (
            <span key={s.id}>{s.id}</span>
          ))}
        </div>
      ) : null}
      {confirmDelete ? (
        <fieldset className="ct-delete" aria-label="确认删除聊天">
          <p>删除本课聊天？删除后无法恢复。</p>
          <button type="button" onClick={() => setConfirmDelete(false)}>
            保留聊天
          </button>
          <button
            type="button"
            disabled={t.busy}
            onClick={() => {
              void t.remove().then(() => setConfirmDelete(false));
            }}
          >
            确认删除
          </button>
        </fieldset>
      ) : null}
      <div
        ref={messagesRef}
        className="ct-messages"
        role="log"
        aria-label="本课聊天记录"
        aria-live="polite"
      >
        {t.data?.hasMore ? (
          <button
            type="button"
            onClick={() => void t.older()}
            disabled={t.loading}
          >
            查看更早的对话
          </button>
        ) : null}
        {!t.data?.messages.length ? (
          <div className="ct-welcome">
            <h3>卡在哪一步，我们一起想。</h3>
            <p>
              我会结合本课知识要点回答。你可以问一个问题，也可以选下面的快捷操作。
            </p>
            <small>无需暂停或离开课程页面。</small>
          </div>
        ) : null}
        {t.data?.messages.map((m) => (
          <article key={m.id} className={`ct-message ct-${m.role}`}>
            <strong>{m.role === 'user' ? '你' : '砖芯 AI'}</strong>
            {m.content ? <p>{m.content}</p> : null}
            {m.reply?.diagram ? (
              <TutorDiagram diagram={m.reply.diagram} />
            ) : null}
            {m.reply?.check ? <CourseTutorCheck check={m.reply.check} /> : null}
            {m.role === 'assistant' ? (
              <small>
                {m.status === 'pending'
                  ? '正在思考，问题已保存…'
                  : m.status === 'unknown'
                    ? '本次调用结果未确认，不会自动重试。'
                    : m.status === 'failed'
                      ? '本次AI回答未完成。'
                      : m.reply?.source === 'course'
                        ? '课程材料 · 已保存'
                        : '已保存'}
                {m.reply?.notice ? ' ' + m.reply.notice : ''}
              </small>
            ) : null}
          </article>
        ))}
      </div>
      <div className="ct-actions">
        {(['rephrase', 'example', 'diagram', 'check'] as CourseAction[]).map(
          (action) => (
            <button
              type="button"
              key={action}
              disabled={blocked || t.retry}
              onClick={() => void t.send(action)}
            >
              {actionLabels[action]}
            </button>
          ),
        )}
      </div>
      {t.error ? (
        <div role="alert" className="ct-error">
          <p>{t.error}</p>
          {t.retry ? (
            <button
              type="button"
              disabled={t.busy}
              onClick={() => void t.send('ask', true)}
            >
              重试这条消息
            </button>
          ) : null}
          <button
            type="button"
            disabled={t.busy}
            onClick={() => void t.refresh()}
          >
            <RotateCcw size={13} />
            刷新对话
          </button>
        </div>
      ) : null}
      <form
        className="ct-form"
        onSubmit={(e) => {
          e.preventDefault();
          void t.send();
        }}
      >
        <label htmlFor={inputId}>问问砖芯 AI</label>
        <textarea
          id={inputId}
          value={t.draft}
          onChange={(e) => t.setDraft(e.target.value)}
          maxLength={600}
          rows={3}
          placeholder={
            lessonId === 'absolute'
              ? '例如：为什么绝对值不能是负数？'
              : '这节课的哪一步还不明白？'
          }
          disabled={t.busy || t.retry}
        />
        <div className="ct-send">
          <small>
            {t.waiting ? '正在处理上一条问题' : t.draft.length + '/600'}
          </small>
          <button
            type="submit"
            disabled={blocked || t.retry || !t.draft.trim()}
          >
            <Send size={15} />
            {t.busy ? '正在发送…' : '发送'}
          </button>
        </div>
      </form>
      <details className="ct-privacy">
        <summary>学习交流 · 不改变正式掌握状态</summary>
        <p>
          聊天保存在当前学习档案中。AI
          会收到本课要点及最近对话；请勿填写姓名、学校或联系方式。回答仅用于学习交流，不改变正式掌握状态。
        </p>
      </details>
    </section>
  );
}
