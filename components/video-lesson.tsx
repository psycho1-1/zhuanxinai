'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  BookOpen,
  ChevronDown,
  Clock3,
  ExternalLink,
  Film,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Lesson } from '@/lib/curriculum';
import LessonVisual from '@/components/lesson-visual';
import {
  embedUrl,
  formatDuration,
  sourceUrl,
  type LessonVideo,
} from '@/lib/lesson-videos';

/** 视频由来源站的官方播放器提供。切换知识点时由父组件重新挂载。 */
export default function VideoLesson({
  lesson,
  video,
  actions,
  children,
}: {
  lesson: Lesson;
  video: LessonVideo;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const [playerKey, setPlayerKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [notesOpen, setNotesOpen] = useState(lesson.section === '综合与实践');

  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [loaded, playerKey]);

  function reload() {
    setLoaded(false);
    setSlow(false);
    setPlayerKey((key) => key + 1);
  }

  return (
    <section className="video-lesson panel" aria-labelledby="video-heading">
      <div className="video-heading">
        <div>
          <span className="eyebrow">01 / 视频讲解 · {lesson.section}</span>
          <h2 id="video-heading">{lesson.title}</h2>
        </div>
        <div className="video-heading-actions">
          <span className="video-duration">
            <Clock3 size={15} aria-hidden="true" />
            {formatDuration(video.durationSeconds)}
          </span>
          {actions}
        </div>
      </div>
      <div className="lesson-player">
        {!loaded && (
          <output className="player-loading">
            <LoaderCircle className="spin" size={24} aria-hidden="true" />
            <span>
              {slow ? '加载较慢，可使用下方来源链接观看' : '正在加载视频讲解…'}
            </span>
          </output>
        )}
        <iframe
          key={playerKey}
          src={embedUrl(video)}
          title={`${lesson.title}视频讲解 — ${video.author}`}
          allow="fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
          onError={() => setSlow(true)}
        />
        {children}
      </div>
      <div className="video-caption">
        <div className="video-credit">
          <Film size={16} aria-hidden="true" />
          <span>
            讲解：{video.author}
            <span className="credit-divider">·</span>哔哩哔哩
          </span>
        </div>
        <a
          className="source-link"
          href={sourceUrl(video)}
          target="_blank"
          rel="noopener noreferrer"
        >
          在 B 站观看
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
      <p className="video-topic-note">{video.focus}</p>
      <div className="player-help">
        <span>若播放器提示无法播放或需要登录，可在来源站继续观看。</span>
        <button type="button" onClick={reload}>
          <RotateCcw size={13} aria-hidden="true" />
          重新加载
        </button>
      </div>
      <Collapsible
        open={notesOpen}
        onOpenChange={setNotesOpen}
        className="video-notes"
      >
        <CollapsibleTrigger className="video-notes-trigger">
          <BookOpen size={17} aria-hidden="true" />
          <span>本节知识要点</span>
          <span className="notes-action">{notesOpen ? '收起' : '展开'}</span>
          <ChevronDown
            size={16}
            className={notesOpen ? 'chevron-open' : ''}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="video-notes-content">
          <p>{lesson.concept}</p>
          <div className="example">
            <span>看一个例子</span>
            <p>{lesson.example}</p>
          </div>
          <LessonVisual key={lesson.id} id={lesson.id} />
          <p className="video-study-tip">
            看到关键步骤时，试着暂停视频，自己算一遍，再继续看。
          </p>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
