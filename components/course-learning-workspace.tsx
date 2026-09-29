'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { MessageCircle, Maximize2, Minimize2 } from 'lucide-react';
import type { Lesson } from '@/lib/curriculum';
import type { LessonVideo } from '@/lib/lesson-videos';
import VideoLesson from './video-lesson';
import CourseTutor from './course-tutor';
export default function CourseLearningWorkspace({
  lesson,
  video,
}: {
  lesson: Lesson;
  video: LessonVideo;
}) {
  const [open, setOpen] = useState(false),
    [immersive, setImmersive] = useState(false),
    id = useId();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const modeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!immersive || !workspaceRef.current) return;
    const scroll = { x: window.scrollX, y: window.scrollY };
    const previousOverflow = document.body.style.overflow;
    // Keep the iframe in place. Only make the rest of the page unfocusable.
    const background: { element: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = workspaceRef.current;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          background.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    document.body.style.overflow = 'hidden';
    modeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      for (const { element, inert } of background) element.inert = inert;
      window.scrollTo(scroll.x, scroll.y);
    };
  }, [immersive]);

  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!immersive) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      if (open)
        requestAnimationFrame(() =>
          askRef.current?.focus({ preventScroll: true }),
        );
      else {
        setImmersive(false);
        requestAnimationFrame(() =>
          modeRef.current?.focus({ preventScroll: true }),
        );
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [immersive, open]);

  function minimize() {
    setOpen(false);
    requestAnimationFrame(() => askRef.current?.focus({ preventScroll: true }));
  }
  function enterImmersive() {
    setImmersive(true);
    setOpen(true);
  }
  function exitImmersive() {
    setOpen(false);
    setImmersive(false);
    requestAnimationFrame(() =>
      modeRef.current?.focus({ preventScroll: true }),
    );
  }
  return (
    <div
      ref={workspaceRef}
      className="course-workspace"
      data-open={open}
      data-immersive={immersive}
    >
      <div className="cw-video">
        <VideoLesson
          lesson={lesson}
          video={video}
          actions={
            <button
              ref={modeRef}
              type="button"
              className="cw-mode-button"
              aria-pressed={immersive}
              onClick={() => (immersive ? exitImmersive() : enterImmersive())}
            >
              {immersive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {immersive ? '退出沉浸' : '沉浸学习'}
            </button>
          }
        >
          {/* These overlays are siblings of our iframe, never inside Bilibili. */}
          <button
            ref={askRef}
            type="button"
            className="cw-toggle"
            hidden={open}
            aria-expanded={open}
            aria-controls={id}
            title={immersive ? '哪里没懂，随时问' : '放大视频，边看边问'}
            onClick={enterImmersive}
          >
            <MessageCircle size={19} aria-hidden="true" />
            <span>问砖芯 AI</span>
          </button>
          <div
            ref={panelRef}
            id={id}
            className="cw-tutor-panel"
            hidden={!open}
            tabIndex={-1}
          >
            <CourseTutor
              key={lesson.id}
              lessonId={lesson.id}
              enabled={open}
              onMinimize={minimize}
            />
          </div>
        </VideoLesson>
      </div>
    </div>
  );
}
