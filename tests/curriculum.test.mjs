import test from 'node:test';
import assert from 'node:assert/strict';
import { chapters, lessons, displayAnswer } from '../lib/curriculum.ts';
import { lessonVideos, embedUrl } from '../lib/lesson-videos.ts';
import { questions } from '../server/questions.ts';
import { tutorInstructions } from '../server/tutor.ts';
test('新版六章顺序、41节完整且视频分集有对应', () => {
  assert.deepEqual(
    chapters.map((c) => c.id),
    [
      'rational',
      'arithmetic',
      'expressions',
      'algebra',
      'equation',
      'geometry',
    ],
  );
  assert.equal(lessons.length, 41);
  assert.equal(new Set(lessons.map((l) => l.id)).size, 41);
  assert.equal(lessons.filter((l) => l.section === '综合与实践').length, 2);
  let chapter = -1;
  for (const lesson of lessons) {
    assert.ok(
      lesson.section && lesson.concept && lesson.example && lesson.hint,
    );
    const index = chapters.findIndex((c) => c.id === lesson.chapterId);
    assert.ok(index >= chapter);
    chapter = index;
    const video = lessonVideos[lesson.id];
    assert.ok(
      video && video.cid > 0 && video.page >= 1 && video.durationSeconds > 0,
    );
    const url = new URL(embedUrl(video));
    assert.equal(url.searchParams.get('cid'), String(video.cid));
    assert.equal(url.searchParams.get('p'), String(video.page));
  }
});
test('旧的45道题ID均保留，选择题显示内容并传递正确AI语境', () => {
  for (const id of [
    'number-line',
    'absolute',
    'operations',
    'expression',
    'like-terms',
    'solve',
    'word-problems',
    'segments',
    'angles',
  ]) {
    for (let i = 1; i <= 5; i++)
      assert.ok(questions.some((q) => q.id === `${id}-${i}`));
  }
  const q = questions.find((q) => q.id === 'signed-numbers-3');
  assert.equal(displayAnswer(q, 3), 'C. 0 既不是正数也不是负数');
  const instructions = tutorInstructions(
    lessons.find((l) => l.id === q.lessonId),
    q,
    { answer: '1', correct: 0 },
  );
  assert.ok(instructions.includes('选项序号'));
  assert.ok(instructions.includes(q.options[2]));
});
