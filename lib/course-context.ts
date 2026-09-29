export const courseInfo = {
  id: 'math-grade7-upper-pep2024',
  title: '初一数学 · 七年级上册',
  textbook: '人教版',
  edition: '2024',
};
// Reviewed mapping to the named K12 model. Lesson IDs remain unchanged.
export const lessonSkills: Record<
  string,
  { id: string; title: string; version: string }[]
> = {
  absolute: [
    {
      id: 'S05',
      title: '将绝对值解释为到原点的距离',
      version: 'k12-learning-model-v1',
    },
  ],
};
export const COURSE_CONTEXT_VERSION = 'course-context-1';
