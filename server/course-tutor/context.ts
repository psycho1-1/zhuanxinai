import { chapters, lessons } from '../../lib/curriculum.ts';
import { lessonVideos, sourceUrl } from '../../lib/lesson-videos.ts';
import {
  courseInfo,
  lessonSkills,
  COURSE_CONTEXT_VERSION,
} from '../../lib/course-context.ts';
import type { CourseTutorContext } from '../../lib/course-tutor-contract.ts';
export class CourseError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export function courseContext(
  lessonId: unknown,
  resourceId?: unknown,
): CourseTutorContext {
  if (typeof lessonId !== 'string') throw new CourseError('INVALID_CONTEXT');
  const lesson = lessons.find((l) => l.id === lessonId);
  const video = lessonVideos[lessonId];
  const chapter = chapters.find((c) => c.id === lesson?.chapterId);
  if (!lesson || !video || !chapter)
    throw new CourseError('CONTEXT_NOT_FOUND', 404);
  const id = `bilibili:${video.bvid}:${video.cid}:${video.page}`;
  if (resourceId !== undefined && resourceId !== id)
    throw new CourseError('RESOURCE_MISMATCH', 409);
  const skills = lessonSkills[lesson.id] ?? [];
  return {
    version: COURSE_CONTEXT_VERSION,
    course: courseInfo,
    chapter: { id: chapter.id, title: chapter.title },
    lesson: { id: lesson.id, title: lesson.title, section: lesson.section },
    knowledgePoint: {
      title: lesson.title,
      concept: lesson.concept,
      example: lesson.example,
      hint: lesson.hint,
    },
    skills,
    skillMappingStatus: skills.length ? 'mapped' : 'pending',
    resource: {
      id,
      provider: 'bilibili',
      bvid: video.bvid,
      cid: video.cid,
      page: video.page,
      title: video.title,
      author: video.author,
      sourceUrl: sourceUrl(video),
      focus: video.focus,
    },
  };
}
