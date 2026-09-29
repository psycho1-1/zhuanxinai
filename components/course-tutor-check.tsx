'use client';
import type { TutorCheck } from '@/lib/course-tutor-contract';
export default function CourseTutorCheck({ check }: { check: TutorCheck }) {
  return (
    <section className="ct-check" aria-label="非正式自测">
      <strong>自己试一试</strong>
      <p className="ct-check-notice">本次自测暂不计入正式掌握状态</p>
      <p>{check.question}</p>
      <details>
        <summary>查看参考答案与讲解</summary>
        <p>{check.answer}</p>
        <p>{check.explanation}</p>
      </details>
    </section>
  );
}
