import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { courseContext } from '../server/course-tutor/context.ts';
import {
  openConversation,
  thread,
  deleteConversation,
  beginTurn,
  finishTurn,
  expire,
} from '../server/course-tutor/store.ts';
import {
  sendCourseMessage,
  validateInput,
  validateReply,
  instructions,
} from '../server/course-tutor/service.ts';
import { ensureProfile } from '../server/evidence/store.ts';
import { deleteProfile } from '../server/evidence/lifecycle.ts';
import { lessons } from '../lib/curriculum.ts';
const id = () => crypto.randomUUID();
const config = { AI_TUTOR_ENABLED: 'true', DEEPSEEK_API_KEY: 'unit-test' };
const mock = async () =>
  Response.json({
    choices: [
      {
        finish_reason: 'stop',
        message: { content: '绝对值表示点到原点的距离。' },
      },
    ],
  });
function database(t) {
  const raw = new DatabaseSync(':memory:');
  for (const f of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    raw.exec(readFileSync(new URL('../drizzle/' + f, import.meta.url), 'utf8'));
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
          return { results: raw.prepare(sql).all(...values), success: true };
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
async function setup(t, lesson = 'absolute') {
  const db = database(t),
    learner = id();
  await ensureProfile(db, learner);
  const c = await openConversation(db, learner, courseContext(lesson));
  return { db, learner, c };
}
const input = (c, message = '为什么距离不能为负？', action = 'ask') => ({
  requestId: id(),
  revision: c.conversation.revision,
  message,
  action,
});
const effects = (db) =>
  Object.fromEntries(
    [
      'attempts',
      'evidence_events',
      'evidence_presentations',
      'evidence_snapshots',
      'evidence_baselines',
      'evidence_commands',
      'learning_journeys',
    ].map((table) => [table, db.raw.prepare('SELECT * FROM ' + table).all()]),
  );

test('所有41课的可信课程/章节/视频上下文完整；S05映射明确，资源不匹配拒绝', () => {
  for (const l of lessons) {
    const c = courseContext(l.id);
    assert.equal(c.lesson.id, l.id);
    assert.ok(
      c.chapter.title &&
        c.course.id &&
        c.knowledgePoint.concept &&
        c.resource.cid,
    );
  }
  assert.equal(courseContext('absolute').skills[0].id, 'S05');
  assert.equal(courseContext('number-line').skillMappingStatus, 'pending');
  assert.throws(() => courseContext('missing'), /CONTEXT_NOT_FOUND/);
  assert.throws(
    () => courseContext('absolute', 'bilibili:fake'),
    /RESOURCE_MISMATCH/,
  );
});
test('客户端伪造context/skill/Student Model/history/system字段拒绝', () => {
  const b = { requestId: id(), revision: 0, message: '请解释', action: 'ask' };
  for (const key of [
    'concept',
    'skillId',
    'studentModel',
    'system',
    'history',
    'context',
  ])
    assert.throws(() => validateInput({ ...b, [key]: 'fake' }));
  assert.throws(() => validateInput({ ...b, message: 'x'.repeat(601) }));
  assert.equal(validateInput(b).message, '请解释');
  assert.match(instructions(courseContext('absolute'), 'ask'), /没有字幕/);
});
test('会话恢复、跨课隔离和跨learner访问/删除拒绝', async (t) => {
  const { db, learner, c } = await setup(t);
  assert.equal(
    (await openConversation(db, learner, courseContext('absolute')))
      .conversation.id,
    c.conversation.id,
  );
  const other = id();
  await ensureProfile(db, other);
  await assert.rejects(
    thread(db, other, c.conversation.id),
    /CONVERSATION_NOT_FOUND/,
  );
  await assert.rejects(
    deleteConversation(db, other, c.conversation.id),
    /CONVERSATION_NOT_FOUND/,
  );
  assert.notEqual(
    (await openConversation(db, learner, courseContext('addition')))
      .conversation.id,
    c.conversation.id,
  );
});
test('普通聊天只写聊天/额度，重试不重复模型、消息或额度，伪造复用请求冲突', async (t) => {
  const { db, learner, c } = await setup(t),
    before = effects(db),
    b = input(c);
  let calls = 0;
  const send = async (...args) => {
    calls++;
    return mock(...args);
  };
  const result = await sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    b,
    config,
    send,
  );
  const retry = await sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    b,
    config,
    send,
  );
  assert.deepEqual(result, retry);
  assert.equal(calls, 1);
  assert.equal(result.messages.length, 2);
  assert.equal(
    db.raw
      .prepare("SELECT used FROM tutor_limits WHERE bucket='site:day'")
      .get().used,
    1,
  );
  assert.deepEqual(effects(db), before);
  await assert.rejects(
    sendCourseMessage(
      db,
      learner,
      c.conversation.id,
      { ...b, message: '另一个问题' },
      config,
      send,
    ),
    /REQUEST_CONFLICT/,
  );
});
test('并发同请求仅调用一次；不同请求与旧revision不能越过会话锁', async (t) => {
  const { db, learner, c } = await setup(t),
    b = input(c);
  let calls = 0,
    release;
  const send = async () => {
    calls++;
    await new Promise((r) => (release = r));
    return mock();
  };
  const first = sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    b,
    config,
    send,
  );
  while (!release) await new Promise((r) => setTimeout(r, 1));
  const again = await sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    b,
    config,
    send,
  );
  assert.ok(again.messages.some((m) => m.status === 'pending'));
  await assert.rejects(
    sendCourseMessage(
      db,
      learner,
      c.conversation.id,
      { ...b, requestId: id() },
      config,
      send,
    ),
    /BUSY_OR_STALE/,
  );
  release();
  await first;
  assert.equal(calls, 1);
});
test('懂了/会了/谢谢只存聊天；不会宣布mastered或改变任何学习效果', async (t) => {
  const { db, learner, c } = await setup(t),
    before = effects(db);
  let current = c;
  for (const text of ['懂了', '会了', '谢谢']) {
    current = await sendCourseMessage(
      db,
      learner,
      c.conversation.id,
      input(current, text),
      config,
      () => {
        throw Error('must not call');
      },
    );
    assert.doesNotMatch(current.messages.at(-1).content, /mastered|已经掌握/);
  }
  assert.deepEqual(effects(db), before);
  assert.equal(
    db.raw.prepare('SELECT COUNT(*) n FROM tutor_limits').get().n,
    0,
  );
});
test('S05受控数轴、自测可保存且不产生证据；模型结构不允许执行HTML/SVG/JS', async (t) => {
  const { db, learner, c } = await setup(t),
    before = effects(db);
  let d = await sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    input(c, '画图解释', 'diagram'),
    config,
    () => {
      throw Error('must not call');
    },
  );
  assert.equal(d.messages.at(-1).reply.diagram.type, 'number-line');
  d = await sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    input(d, '出题检查', 'check'),
    config,
    () => {
      throw Error('must not call');
    },
  );
  assert.ok(d.messages.at(-1).reply.check.answer);
  assert.deepEqual(effects(db), before);
  assert.throws(() =>
    validateReply(
      '{"text":"test","diagram":{"type":"html","html":"<script/>"}}',
      'diagram',
    ),
  );
  assert.throws(() => validateReply('你已经掌握了，mastered', 'ask'));
  const safe = validateReply(
    '{"text":"解释","diagram":{"type":"steps","title":"步骤","steps":["一","二"],"html":"<script/>"}}',
    'diagram',
  );
  assert.equal('html' in safe.diagram, false);
});
test('换说法/新例子调用模型；可信历史由服务端加载', async (t) => {
  const { db, learner, c } = await setup(t, 'addition');
  let d = c,
    observed;
  for (const action of ['rephrase', 'example']) {
    d = await sendCourseMessage(
      db,
      learner,
      c.conversation.id,
      input(d, action, action),
      config,
      async (url, opts) => {
        observed = JSON.parse(opts.body);
        return mock();
      },
    );
  }
  assert.match(observed.messages[0].content, /有理数加法/);
  assert.equal(observed.messages.length, 4);
  assert.equal(d.messages.length, 4);
});
test('上游超时/不合格回复保存unknown/failed；同请求恢复不再次扣费', async (t) => {
  const { db, learner, c } = await setup(t),
    b = input(c);
  let calls = 0;
  const fail = async () => {
    calls++;
    throw Error('timeout');
  };
  let d = await sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    b,
    config,
    fail,
  );
  assert.equal(d.messages.at(-1).status, 'unknown');
  assert.equal(calls, 1);
  await sendCourseMessage(db, learner, c.conversation.id, b, config, fail);
  assert.equal(calls, 1);
  d = await sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    input(d),
    config,
    async () =>
      Response.json({
        choices: [
          { finish_reason: 'stop', message: { content: '你已经掌握了' } },
        ],
      }),
  );
  assert.equal(d.messages.at(-1).status, 'failed');
});
test('额度拒绝不扣部分额度，以课程材料完成且可恢复', async (t) => {
  const { db, learner, c } = await setup(t);
  const now = Date.now();
  db.raw
    .prepare('INSERT INTO tutor_limits VALUES (?,?,?)')
    .run('site:day', Math.floor((now + 8 * 3600000) / 86400000), 500);
  const b = input(c);
  const result = await sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    b,
    config,
    () => {
      throw Error('must not call');
    },
  );
  assert.match(result.messages.at(-1).reply.notice, /额度/);
  assert.equal(
    db.raw.prepare('SELECT COUNT(*) n FROM tutor_limits').get().n,
    1,
  );
  assert.equal(
    (await sendCourseMessage(db, learner, c.conversation.id, b, config))
      .messages.length,
    2,
  );
});
test('删除会话与删除档案阻止在途回复复活，删除后可创建新的本课会话', async (t) => {
  const { db, learner, c } = await setup(t),
    b = input(c);
  await beginTurn(db, learner, c.conversation.id, b, false);
  await deleteConversation(db, learner, c.conversation.id);
  await assert.rejects(
    finishTurn(db, learner, c.conversation.id, b.requestId, {
      text: 'late',
      source: 'course',
    }),
    /CONVERSATION_NOT_FOUND/,
  );
  assert.equal(
    db.raw.prepare('SELECT COUNT(*) n FROM tutor_messages').get().n,
    0,
  );
  const d = await openConversation(db, learner, courseContext('absolute'));
  assert.notEqual(c.conversation.id, d.conversation.id);
  await deleteProfile(db, learner);
  for (const table of ['tutor_messages', 'tutor_conversations'])
    assert.equal(db.raw.prepare('SELECT COUNT(*) n FROM ' + table).get().n, 0);
});
test('崩溃遗留pending有界过期；旧请求仍不可重发模型，迟到回复不得替换unknown', async (t) => {
  const { db, learner, c } = await setup(t),
    b = input(c);
  await beginTurn(db, learner, c.conversation.id, b, true);
  await expire(db, learner, c.conversation.id, Date.now() + 61000);
  const d = await thread(db, learner, c.conversation.id);
  assert.equal(d.messages.at(-1).status, 'unknown');
  const late = await finishTurn(db, learner, c.conversation.id, b.requestId, {
    text: 'late',
    source: 'course',
  });
  assert.equal(late.messages.at(-1).content, '');
  assert.equal(
    db.raw.prepare('SELECT status FROM tutor_reservations').get().status,
    'unknown',
  );
  await sendCourseMessage(db, learner, c.conversation.id, b, config, () => {
    throw Error('must not call');
  });
});

test('长对话分页保持顺序、无重复；删除在途调用保留unknown回执', async (t) => {
  const { db, learner, c } = await setup(t);
  let d = c;
  for (let i = 0; i < 32; i++)
    d = await sendCourseMessage(
      db,
      learner,
      c.conversation.id,
      input(d, '谢谢'),
      {},
      mock,
    );
  assert.equal(d.messages.length, 60);
  assert.equal(d.hasMore, true);
  const older = await thread(db, learner, c.conversation.id, d.messages[0].seq);
  assert.equal(older.messages.length, 4);
  assert.equal(older.hasMore, false);
  const all = [...older.messages, ...d.messages];
  assert.equal(new Set(all.map((m) => m.id)).size, 64);
  assert.deepEqual(
    all.map((m) => m.seq),
    all.map((m) => m.seq).sort((a, b) => a - b),
  );
  await beginTurn(db, learner, c.conversation.id, input(d), true);
  await deleteConversation(db, learner, c.conversation.id);
  assert.equal(
    db.raw.prepare('SELECT status FROM tutor_reservations').get().status,
    'unknown',
  );
});

test('普通课结构化图示及自测校验，供应商错误内容不会进入存储', async (t) => {
  const { db, learner, c } = await setup(t, 'addition');
  const reply = {
    text: '试一试',
    check: {
      question: '2+3等于多少？',
      answer: '5',
      explanation: '两个单位再加三个单位。',
    },
  };
  let d = await sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    input(c, '出题检查', 'check'),
    config,
    async () =>
      Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: { content: JSON.stringify(reply) },
          },
        ],
      }),
  );
  assert.deepEqual(d.messages.at(-1).reply.check, reply.check);
  d = await sendCourseMessage(
    db,
    learner,
    c.conversation.id,
    input(d),
    config,
    async () => new Response('private-provider-account', { status: 401 }),
  );
  assert.equal(d.messages.at(-1).status, 'unknown');
  assert.doesNotMatch(JSON.stringify(d), /private-provider-account/);
});
test('独立检查时课程聊天不提供旁路帮助也不写任何证据', async (t) => {
  const { db, learner, c } = await setup(t),
    before = effects(db);
  db.raw
    .prepare(
      "INSERT INTO evidence_presentations(id,learner,item_id,item_version,topic,purpose,family_id,created_at) VALUES (?,?,?,1,'absolute','immediate','f',?)",
    )
    .run(id(), learner, 'test', Date.now());
  await assert.rejects(
    sendCourseMessage(db, learner, c.conversation.id, input(c), config, mock),
    /BUSY_OR_STALE/,
  );
  assert.equal(
    db.raw.prepare('SELECT COUNT(*) n FROM tutor_messages').get().n,
    0,
  );
  assert.deepEqual(effects(db).evidence_events, before.evidence_events);
});
