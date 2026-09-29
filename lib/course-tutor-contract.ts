export const courseActions = [
  'ask',
  'rephrase',
  'example',
  'diagram',
  'check',
] as const;
export type CourseAction = (typeof courseActions)[number];
export const actionLabels: Record<CourseAction, string> = {
  ask: '提问',
  rephrase: '换种说法',
  example: '举个例子',
  diagram: '画图解释',
  check: '出题检查',
};
export type CourseTutorContext = {
  version: string;
  course: { id: string; title: string; textbook: string; edition: string };
  chapter: { id: string; title: string };
  lesson: { id: string; title: string; section: string };
  knowledgePoint: {
    title: string;
    concept: string;
    example: string;
    hint: string;
  };
  skills: { id: string; title: string; version: string }[];
  skillMappingStatus: 'mapped' | 'pending';
  resource: {
    id: string;
    provider: 'bilibili';
    bvid: string;
    cid: number;
    page: number;
    title: string;
    author: string;
    sourceUrl: string;
    focus: string;
  };
};
export type TutorDiagram =
  | { type: 'number-line'; point: number; title: string }
  | { type: 'steps'; title: string; steps: string[] };
export type TutorCheck = {
  question: string;
  answer: string;
  explanation: string;
};
export type CourseReply = {
  text: string;
  diagram?: TutorDiagram;
  check?: TutorCheck;
  source: 'model' | 'course';
  notice?: string;
};
export type MessageStatus = 'pending' | 'completed' | 'failed' | 'unknown';
export type CourseMessage = {
  seq: number;
  id: string;
  requestId: string;
  role: 'user' | 'assistant';
  content: string;
  action: CourseAction;
  status: MessageStatus;
  reply: CourseReply | null;
  createdAt: number;
};
export type CourseConversation = {
  id: string;
  lessonId: string;
  resourceId: string;
  revision: number;
};
export type CourseThread = {
  conversation: CourseConversation;
  messages: CourseMessage[];
  hasMore: boolean;
};
