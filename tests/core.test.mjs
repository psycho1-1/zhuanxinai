import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswer, gradeAnswer } from '../lib/grading.ts';
import { calculateProgress } from '../lib/progress.ts';
import { questions, publicQuestions } from '../server/questions.ts';
import { lessons } from '../lib/curriculum.ts';

test('数字、负号、小数、全角与等值分数', () => {
  for (const [input, expected] of [
    ['−3', -3],
    [' １／２ ', 0.5],
    ['-.5', -0.5],
    ['2 / 4', 0.5],
    ['0', 0],
    ['+3', 3],
  ])
    assert.equal(parseAnswer(input), expected);
  assert.equal(gradeAnswer('3/2', 1.5).correct, true);
  assert.equal(gradeAnswer('-1/2', 0.5).correct, false);
});
test('空值、代码、零分母、无穷大及混合表达式不能被当成有效答案', () => {
  for (const input of [
    '',
    '  ',
    '1/0',
    'NaN',
    'Infinity',
    '1+2',
    'alert(1)',
    '0x10',
    '1 2',
    '3cm',
    '9'.repeat(65),
  ])
    assert.equal(parseAnswer(input), null, input);
});
test('205 道题的结构完整、ID 唯一、标准答案可判对且不会公开', () => {
  assert.equal(questions.length, 205);
  assert.equal(new Set(questions.map((q) => q.id)).size, 205);
  for (const lesson of lessons)
    assert.equal(questions.filter((q) => q.lessonId === lesson.id).length, 5);
  for (const q of questions) {
    assert.ok(q.explanation);
    assert.ok(lessons.some((l) => l.id === q.lessonId));
    assert.equal(gradeAnswer(String(q.answer), q.answer).correct, true);
    if (q.options) {
      assert.ok(q.options.length >= 2);
      assert.equal(new Set(q.options).size, q.options.length);
      assert.ok(
        Number.isInteger(q.answer) &&
          q.answer >= 1 &&
          q.answer <= q.options.length,
      );
    }
  }
  for (const q of publicQuestions) {
    assert.equal('answer' in q, false);
    assert.equal('explanation' in q, false);
  }
});
const pool = questions.filter((q) => q.lessonId === 'absolute');
function row(i, correct) {
  return {
    questionId: pool[i].id,
    answer: '0',
    correct,
    everWrong: correct ? 0 : 1,
    createdAt: '2026-09-09T00:00:00Z',
  };
}
function progress(rows) {
  return calculateProgress(['absolute'], pool, rows)[0];
}
test('掌握度依赖不同题目的覆盖率，不能重复刷分', () => {
  assert.equal(progress([]).status, '未开始');
  assert.equal(progress([row(0, 1)]).mastery, 20);
  assert.equal(progress([row(0, 1), row(0, 1)]).mastery, 20);
  assert.equal(
    progress([row(0, 1), row(1, 1), row(2, 1), row(3, 1)]).status,
    '学习中',
  );
  assert.equal(
    progress([row(0, 1), row(1, 1), row(2, 1), row(3, 1), row(4, 0)]).status,
    '基础掌握',
  );
  assert.equal(
    progress([row(0, 0), row(1, 1), row(2, 1), row(3, 1), row(4, 0)]).status,
    '需复习',
  );
  assert.equal(progress([row(0, 1), row(0, 0)]).mastery, 0);
});
