export type StudioQuestion = {
  id: string;
  type: 'choice' | 'boolean' | 'short';
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  rubric: string;
};
export type StudioSegment = {
  id: string;
  title: string;
  goal: string;
  notes: string;
  misconceptions: string;
  guidance: string;
  videoId: string;
  videoRequired: boolean;
  allowSkip: boolean;
  completion: 'submit' | 'correct';
  questions: StudioQuestion[];
};
export type StudioLesson = {
  id: string;
  title: string;
  segments: StudioSegment[];
};
export type StudioChapter = {
  id: string;
  title: string;
  lessons: StudioLesson[];
};
export type StudioCourse = {
  subject?: string;
  grade?: string;
  title: string;
  description: string;
  coverId: string;
  chapters: StudioChapter[];
};
export type PublicSegment = Omit<
  StudioSegment,
  'misconceptions' | 'guidance' | 'questions'
> & { questions: Omit<StudioQuestion, 'answer' | 'explanation' | 'rubric'>[] };
export type PublicCourse = Omit<StudioCourse, 'chapters'> & {
  chapters: {
    id: string;
    title: string;
    lessons: { id: string; title: string; segments: PublicSegment[] }[];
  }[];
};
export type CourseRow = {
  id: string;
  revision: number;
  draft: StudioCourse;
  published_version: string | null;
  archived: number;
  updated_at: number;
};
export type CourseSummary = {
  id: string;
  title: string;
  description: string;
  coverId: string;
  revision: number;
  published_version: string | null;
  archived: number;
  updated_at: number;
  segments: number;
  emptyDraft?: boolean;
};
export type SegmentProgress = {
  segment_id: string;
  seconds: number;
  video_done: number;
  completed: number;
  skipped: number;
};
export type SavedAnswer = {
  id: string;
  segment_id: string;
  question_id: string;
  answer: string;
  correct: number | null;
  feedback: string;
  source: string;
  created_at: number;
  status: string;
};
export function flattenSegments(course: StudioCourse): StudioSegment[];
export function flattenSegments(course: PublicCourse): PublicSegment[];
export function flattenSegments(
  course: StudioCourse | PublicCourse,
): (StudioSegment | PublicSegment)[] {
  return course.chapters.flatMap((ch) => ch.lessons.flatMap((l) => l.segments));
}
export function emptySegment(): StudioSegment {
  return {
    id: crypto.randomUUID(),
    title: '新学习片段',
    goal: '',
    notes: '',
    misconceptions: '',
    guidance: '',
    videoId: '',
    videoRequired: true,
    allowSkip: true,
    completion: 'submit',
    questions: [],
  };
}
export function emptyCourse(): StudioCourse {
  return { title: '未命名课程', description: '', coverId: '', chapters: [] };
}
export function assetUrl(id: string) {
  return `/api/studio/assets?id=${encodeURIComponent(id)}`;
}
