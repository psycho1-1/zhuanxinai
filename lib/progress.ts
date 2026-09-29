import type { PublicQuestion } from './curriculum';
export type LatestAnswer = {
  questionId: string;
  answer: string;
  correct: number;
  everWrong: number;
  createdAt: string;
};
export type LessonProgress = {
  lessonId: string;
  attempted: number;
  correct: number;
  total: number;
  mastery: number;
  status: '未开始' | '学习中' | '需复习' | '基础掌握';
};
// 每道题只取最近一次结果。重复答同一道题不会增加题目覆盖率。
export function calculateProgress(
  lessonIds: string[],
  questions: { id: string; lessonId: string }[],
  latest: LatestAnswer[],
): LessonProgress[] {
  const byId = new Map(latest.map((a) => [a.questionId, a]));
  return lessonIds.map((lessonId) => {
    const pool = questions.filter((q) => q.lessonId === lessonId);
    const attempted = pool.filter((q) => byId.has(q.id)).length;
    const correct = pool.filter((q) => byId.get(q.id)?.correct === 1).length;
    const total = pool.length;
    const mastery = total ? Math.round((correct / total) * 100) : 0;
    const status =
      attempted === 0
        ? '未开始'
        : attempted === total && mastery >= 80
          ? '基础掌握'
          : attempted === total
            ? '需复习'
            : '学习中';
    return { lessonId, attempted, correct, total, mastery, status };
  });
}
export type LearningData = {
  questions: PublicQuestion[];
  latest: LatestAnswer[];
  progress: LessonProgress[];
  totals: { attempts: number; correct: number; today: number };
  days: { day: string; count: number }[];
};
