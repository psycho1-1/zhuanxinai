import type { StudioCourse, PublicCourse } from '../../lib/studio.ts';
import { flattenSegments } from '../../lib/studio.ts';
export class StudioError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export const ID = /^[a-zA-Z0-9_-]{1,80}$/;
export function identifier(v: unknown): string {
  if (typeof v !== 'string' || !ID.test(v))
    throw new StudioError('内容编号无效。');
  return v;
}
const object = (v: unknown): Record<string, any> => {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new StudioError('课程格式不正确。');
  return v;
};
const str = (v: unknown, max: number): string => {
  if (typeof v !== 'string' || v.length > max)
    throw new StudioError(`文字内容过长或格式不正确（最多 ${max} 字）。`);
  return v.trim();
};
const list = (v: unknown, max: number): any[] => {
  if (!Array.isArray(v) || v.length > max)
    throw new StudioError('内容数量超出单次课程限制。');
  return v;
};
const bool = (v: unknown): boolean => {
  if (typeof v !== 'boolean') throw new StudioError('学习规则格式不正确。');
  return v;
};
export function validateCourse(raw: unknown): StudioCourse {
  const seen = new Set<string>();
  const id = (v: unknown) => {
    const key = identifier(v);
    if (seen.has(key))
      throw new StudioError('章节、片段或题目的编号重复，请刷新后重试。');
    seen.add(key);
    return key;
  };
  const optionalId = (v: unknown) => (v === '' ? '' : identifier(v));
  const c = object(raw);
  if (c.subject !== undefined && !['数学', '物理', '化学'].includes(c.subject)) throw new StudioError('请选择有效学科。');
  if (c.grade !== undefined && !['初一', '初二', '初三'].includes(c.grade)) throw new StudioError('请选择有效年级。');
  const course: StudioCourse = {
    ...(c.subject !== undefined ? { subject: c.subject } : {}),
    ...(c.grade !== undefined ? { grade: c.grade } : {}),
    title: str(c.title, 100),
    description: str(c.description, 2000),
    coverId: optionalId(c.coverId),
    chapters: list(c.chapters, 30).map((v) => {
      const ch = object(v);
      return {
        id: id(ch.id),
        title: str(ch.title, 100),
        lessons: list(ch.lessons, 50).map((v) => {
          const l = object(v);
          return {
            id: id(l.id),
            title: str(l.title, 100),
            segments: list(l.segments, 30).map((v) => {
              const s = object(v);
              if (!['submit', 'correct'].includes(s.completion))
                throw new StudioError('请选择有效的完成规则。');
              return {
                id: id(s.id),
                title: str(s.title, 100),
                goal: str(s.goal, 1000),
                notes: str(s.notes, 8000),
                misconceptions: str(s.misconceptions, 2000),
                guidance: str(s.guidance, 2000),
                videoId: optionalId(s.videoId),
                videoRequired: bool(s.videoRequired),
                allowSkip: bool(s.allowSkip),
                completion: s.completion,
                questions: list(s.questions, 20).map((v) => {
                  const q = object(v);
                  if (!['choice', 'boolean', 'short'].includes(q.type))
                    throw new StudioError('不支持的题型。');
                  return {
                    id: id(q.id),
                    type: q.type,
                    prompt: str(q.prompt, 2000),
                    options: list(q.options, 6).map((x) => str(x, 500)),
                    answer: str(q.answer, 2000),
                    explanation: str(q.explanation, 3000),
                    rubric: str(q.rubric, 3000),
                  };
                }),
              };
            }),
          };
        }),
      };
    }),
  };
  if (!course.title) throw new StudioError('请填写课程名称。');
  if (flattenSegments(course).length > 200)
    throw new StudioError('一门课程最多 200 个片段，请拆分为多门课程。');
  return course;
}
export function publishIssues(c: StudioCourse) {
  const errors: string[] = [];
  if (!c.description) errors.push('请填写课程介绍');
  if (!c.chapters.length) errors.push('至少添加一个章节');
  c.chapters.forEach((ch, i) => {
    if (!ch.title) errors.push(`第 ${i + 1} 章缺少名称`);
    if (!ch.lessons.length) errors.push(`${ch.title}：至少添加一个课时`);
    ch.lessons.forEach((l) => {
      if (!l.title || !l.segments.length)
        errors.push(`${l.title || '未命名课时'}：请填写名称并添加片段`);
      l.segments.forEach((s) => {
        const prefix = `${l.title} / ${s.title || '未命名片段'}`;
        if (!s.title || !s.goal) errors.push(`${prefix}：缺少名称或学习目标`);
        if (s.videoRequired && !s.videoId) errors.push(`${prefix}：待上传视频`);
        if (!s.videoId && !s.notes)
          errors.push(`${prefix}：至少提供视频或文字讲解`);
        s.questions.forEach((q, n) => {
          if (!q.prompt || !q.answer)
            errors.push(`${prefix} 第 ${n + 1} 题：缺少题目或参考答案`);
          if (
            q.type === 'choice' &&
            (q.options.length < 2 ||
              q.options.some((o) => !o) ||
              !/^[1-6]$/.test(q.answer) ||
              Number(q.answer) > q.options.length)
          )
            errors.push(`${prefix} 第 ${n + 1} 题：选项或答案序号不正确`);
          if (q.type === 'boolean' && !['true', 'false'].includes(q.answer))
            errors.push(`${prefix} 第 ${n + 1} 题：请选择正确或错误`);
          if (q.type === 'short' && !q.rubric)
            errors.push(`${prefix} 第 ${n + 1} 题：请填写 AI 评价标准`);
        });
      });
    });
  });
  return errors;
}
export function studentDocument(c: StudioCourse): PublicCourse {
  return {
    ...c,
    chapters: c.chapters.map((ch) => ({
      ...ch,
      lessons: ch.lessons.map((l) => ({
        ...l,
        segments: l.segments.map((s) => {
          const { misconceptions, guidance, questions, ...visible } = s;
          return {
            ...visible,
            questions: questions.map(
              ({ answer, explanation, rubric, ...question }) => question,
            ),
          };
        }),
      })),
    })),
  };
}
