import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  validateCourse,
  publishIssues,
  studentDocument,
} from '../server/studio/content.ts';
import {
  createCourse,
  saveCourse,
  publishCourse,
  getCourse,
  restoreCourse,
  archiveCourse,
  history,
  trashDraft,
  trashEmptyDrafts,
  listCourses,
} from '../server/studio/store.ts';
import {
  catalog,
  enroll,
  learningState,
  submitAnswer,
  recordProgress,
} from '../server/studio/learning.ts';
import {
  adminPhoneHash,
  requireAdmin,
  writeOrigin,
} from '../server/studio/auth.ts';
function database(t) {
  const raw = new DatabaseSync(':memory:');
  raw.exec(
    readFileSync(
      new URL('../drizzle/0006_course_studio.sql', import.meta.url),
      'utf8',
    ),
  );
  t.after(() => raw.close());
  return {
    raw,
    prepare(sql) {
      let values = [];
      const s = {
        bind(...v) {
          values = v;
          return s;
        },
        execute() {
          const q = raw.prepare(sql);
          return {
            results: q.columns().length
              ? q.all(...values)
              : (q.run(...values), []),
            success: true,
          };
        },
        async first() {
          return raw.prepare(sql).get(...values) ?? null;
        },
        async run() {
          return s.execute();
        },
        async all() {
          return s.execute();
        },
      };
      return s;
    },
    async batch(stmts) {
      raw.exec('BEGIN');
      try {
        const r = stmts.map((s) => s.execute());
        raw.exec('COMMIT');
        return r;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
const doc = () => ({
  title: '测试数学',
  description: '有理数学习',
  coverId: '',
  chapters: [
    {
      id: 'ch',
      title: '第一章',
      lessons: [
        {
          id: 'lesson',
          title: '绝对值',
          segments: [
            {
              id: 'seg',
              title: '绝对值含义',
              goal: '理解距离',
              notes: '距离非负',
              misconceptions: '符号混淆',
              guidance: '先提示',
              videoId: '',
              videoRequired: false,
              allowSkip: false,
              completion: 'correct',
              questions: [
                {
                  id: 'q',
                  type: 'choice',
                  prompt: '负三的绝对值？',
                  options: ['3', '-3'],
                  answer: '1',
                  explanation: '距离是3',
                  rubric: '',
                },
              ],
            },
            {
              id: 'seg2',
              title: '复习',
              goal: '再练习',
              notes: '归纳',
              misconceptions: '',
              guidance: '',
              videoId: '',
              videoRequired: false,
              allowSkip: true,
              completion: 'submit',
              questions: [],
            },
          ],
        },
      ],
    },
  ],
});
async function setup(t) {
  const db = database(t);
  let c = await createCourse(db, 'admin');
  c = await saveCourse(db, c.id, c.revision, doc(), 'admin');
  c = await publishCourse(db, c.id, c.revision, 'admin');
  return { db, c };
}
test('课程分类随正式版本发布，旧课程默认初一数学', async (t) => {
  const { db, c } = await setup(t);
  assert.equal((await catalog(db, 'student'))[0].subject, '数学');
  let draft = await saveCourse(db, c.id, c.revision, { ...doc(), subject: '物理', grade: '初二' }, 'admin');
  assert.equal((await catalog(db, 'student'))[0].subject, '数学');
  await publishCourse(db, c.id, draft.revision, 'admin');
  const item = (await catalog(db, 'student'))[0];
  assert.equal(item.subject, '物理');
  assert.equal(item.grade, '初二');
  assert.throws(() => validateCourse({ ...doc(), subject: '无效' }), /学科/);
});
test('草稿回收站支持恢复并防止旧版本写入', async (t) => {
  const db = database(t);
  let c = await createCourse(db, 'admin');
  c = await saveCourse(db, c.id, c.revision, doc(), 'admin');
  await trashDraft(db, c.id, c.revision, 'admin');
  assert.equal((await listCourses(db)).length, 0);
  const deleted = (await listCourses(db, true))[0];
  assert.equal(deleted.id, c.id);
  await assert.rejects(getCourse(db, c.id), /回收站/);
  await assert.rejects(saveCourse(db, c.id, c.revision, doc(), 'admin'));
  await assert.rejects(trashDraft(db, c.id, c.revision, 'admin', true));
  await trashDraft(db, c.id, deleted.revision, 'admin', true);
  assert.deepEqual((await getCourse(db, c.id)).draft, doc());
  assert.equal((await listCourses(db, true)).length, 0);
});
test('批量清理只移除空白草稿，发布课程不能删除', async (t) => {
  const { db, c } = await setup(t);
  await createCourse(db, 'admin');
  let named = await createCourse(db, 'admin');
  await saveCourse(db, named.id, named.revision, { ...named.draft, title: '保留' }, 'admin');
  let described = await createCourse(db, 'admin');
  await saveCourse(db, described.id, described.revision, { ...described.draft, description: '内容' }, 'admin');
  assert.equal((await trashEmptyDrafts(db, 'admin')).count, 1);
  assert.equal((await listCourses(db)).length, 3);
  await assert.rejects(trashDraft(db, c.id, c.revision, 'admin'), /发布和学习记录/);
});
test('草稿允许缺视频，发布检查阻止缺失内容；答案与评分标准不发往学生端', () => {
  const c = doc();
  c.chapters[0].lessons[0].segments[0].videoRequired = true;
  assert.ok(publishIssues(validateCourse(c)).some((x) => x.includes('视频')));
  const pub = JSON.stringify(studentDocument(c));
  assert.ok(!pub.includes('"answer"'));
  assert.ok(!pub.includes('"rubric"'));
  assert.ok(!pub.includes('"guidance"'));
  c.chapters[0].lessons[0].segments[1].id = 'seg';
  assert.throws(() => validateCourse(c), /重复/);
});
test('草稿隔离、保存冲突、发布快照、恢复及学员版本固定', async (t) => {
  const db = database(t);
  let c = await createCourse(db, 'admin');
  assert.equal((await catalog(db, 'a')).length, 0);
  c = await saveCourse(db, c.id, 0, doc(), 'admin');
  await assert.rejects(saveCourse(db, c.id, 0, doc(), 'admin'), /另一处/);
  c = await publishCourse(db, c.id, c.revision, 'admin');
  const v1 = c.published_version;
  const a = await enroll(db, 'a', c.id);
  assert.equal(a.version, v1);
  const changed = doc();
  changed.title = '新内容';
  c = await saveCourse(db, c.id, c.revision, changed, 'admin');
  assert.equal((await catalog(db, 'b'))[0].title, '测试数学');
  c = await publishCourse(db, c.id, c.revision, 'admin');
  assert.equal((await learningState(db, 'a', c.id)).course.title, '测试数学');
  assert.equal((await enroll(db, 'b', c.id)).course.title, '新内容');
  c = await restoreCourse(db, c.id, c.revision, v1, 'admin');
  assert.equal(c.draft.title, '测试数学');
  assert.equal((await catalog(db, 'b'))[0].title, '新内容');
  assert.equal((await history(db, c.id)).length, 2);
  await archiveCourse(db, c.id, c.revision, true, 'admin');
  assert.equal((await catalog(db, 'a')).length, 0);
  await assert.rejects(learningState(db, 'a', c.id), /下架/);
});
test('学习记录隔离、答案幂等、服务器顺序及完成规则', async (t) => {
  const { db, c } = await setup(t);
  await enroll(db, 'a', c.id);
  await enroll(db, 'b', c.id);
  await assert.rejects(
    recordProgress(db, 'a', c.id, 'seg2', 'complete'),
    /前面/,
  );
  await assert.rejects(
    recordProgress(db, 'a', c.id, 'seg', 'skip'),
    /需要完成/,
  );
  await submitAnswer(db, 'a', c.id, 'seg', 'q', 'wrong', '2', {});
  await assert.rejects(
    recordProgress(db, 'a', c.id, 'seg', 'complete'),
    /订正/,
  );
  await submitAnswer(db, 'a', c.id, 'seg', 'q', 'right', '1', {});
  await submitAnswer(db, 'a', c.id, 'seg', 'q', 'right', '1', {});
  assert.equal(
    db.raw.prepare('SELECT COUNT(*) AS n FROM cms_answers').get().n,
    2,
  );
  await assert.rejects(
    submitAnswer(db, 'a', c.id, 'seg', 'q', 'right', '2', {}),
    /同一提交/,
  );
  const state = await recordProgress(db, 'a', c.id, 'seg', 'complete');
  assert.equal(state.progress[0].completed, 1);
  assert.equal((await learningState(db, 'b', c.id)).answers.length, 0);
  await recordProgress(db, 'a', c.id, 'seg2', 'skip');
  const reread = await learningState(db, 'a', c.id);
  assert.equal(reread.progress.find((p) => p.segment_id === 'seg2').skipped, 1);
});
test('简答 AI 异常不伪造正确，保留参考反馈且允许继续', async (t) => {
  const { db, c: original } = await setup(t);
  let c = original;
  const d = doc();
  d.chapters[0].lessons[0].segments[0].questions[0] = {
    id: 'short',
    type: 'short',
    prompt: '解释距离',
    options: [],
    answer: '距离非负',
    explanation: '看数轴',
    rubric: '必须说明非负',
  };
  c = await saveCourse(db, c.id, c.revision, d, 'admin');
  c = await publishCourse(db, c.id, c.revision, 'admin');
  await enroll(db, 'a', c.id);
  const r = await submitAnswer(
    db,
    'a',
    c.id,
    'seg',
    'short',
    'attempt',
    '因为距离非负',
    { AI_TUTOR_ENABLED: 'true', DEEPSEEK_API_KEY: 'test' },
    async () => {
      throw new Error('timeout');
    },
  );
  assert.equal(r.answers[0].correct, null);
  assert.equal(r.answers[0].source, 'reference');
  assert.match(r.answers[0].feedback, /参考答案/);
  await recordProgress(db, 'a', c.id, 'seg', 'complete');
});
test('管理员权限必须来自已验证手机号；未登录、普通账号和跨站写入被拒绝', async (t) => {
  const db = database(t),
    phone = '+86 13800000000';
  db.raw
    .prepare('INSERT INTO cms_admins VALUES (?,?)')
    .run(adminPhoneHash(phone), Date.now());
  const original = global.fetch;
  t.after(() => {
    global.fetch = original;
  });
  global.fetch = async (_url, options) =>
    Response.json({
      sub: 'test',
      phone_number:
        options.headers.Authorization === 'Bearer owner'
          ? phone
          : '+86 13900000000',
    });
  await assert.rejects(
    requireAdmin(db, new Request('https://test/api/studio')),
    /登录/,
  );
  await assert.rejects(
    requireAdmin(
      db,
      new Request('https://test/api/studio', {
        headers: { cookie: 'zhixu_account=student' },
      }),
    ),
    /没有课程管理权限/,
  );
  assert.ok(
    await requireAdmin(
      db,
      new Request('https://test/api/studio', {
        headers: { cookie: 'zhixu_account=owner' },
      }),
    ),
  );
  assert.throws(
    () =>
      writeOrigin(
        new Request('https://test/api/studio', {
          headers: { origin: 'https://evil.test' },
        }),
      ),
    /本网站/,
  );
});
