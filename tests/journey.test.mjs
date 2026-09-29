import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { initialJourney, advance, addHelp } from '../server/journey/engine.ts';
import {
  itemById,
  flowItems,
  homeworkIds,
  verificationIds,
} from '../server/journey/content.ts';
import {
  readJourney,
  changeJourney,
  tutorContext,
} from '../server/journey/service.ts';
import { ensureProfile } from '../server/evidence/store.ts';
import { deleteProfile, compact } from '../server/evidence/lifecycle.ts';
import { DAY } from '../lib/evidence-contract.ts';
import { items } from '../server/evidence/catalog.ts';
import { journeyReady } from '../server/journey/readiness.ts';
const id = () => crypto.randomUUID();
function dbFor(t) {
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
      const stmt = {
        bind(...v) {
          values = v;
          return stmt;
        },
        execute() {
          return { results: raw.prepare(sql).all(...values), success: true };
        },
        async run() {
          return stmt.execute();
        },
        async all() {
          return stmt.execute();
        },
        async first() {
          return raw.prepare(sql).get(...values) ?? null;
        },
      };
      return stmt;
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
function answer(s, value, now = Date.now()) {
  return advance(
    s,
    'answer',
    String(value ?? itemById(s.currentId).answer),
    now,
  );
}
function homework(wrong = {}) {
  let s = advance(initialJourney(), 'continue');
  for (let i = 0; i < 5; i++) {
    s = answer(s, wrong[s.currentId]);
    if (i < 4) s = advance(s, 'continue');
  }
  return s;
}
function finish(s, now = Date.now()) {
  for (let n = 0; n < 30 && s.phase !== 'complete'; n++) {
    if (s.currentId && !s.observations.some((o) => o.itemId === s.currentId))
      s = answer(s, undefined, now);
    else s = advance(s, 'continue', undefined, now);
  }
  return s;
}

test('草稿题答案有效、复用旧检验题身份且保留三个新结构', () => {
  assert.equal(
    journeyReady(new Request('https://example.com'), {
      EVIDENCE_MODE: 'preview',
    }),
    false,
  );
  assert.equal(
    journeyReady(new Request('https://example.com'), {
      EVIDENCE_MODE: 'pilot',
    }),
    false,
  );
  assert.equal(
    journeyReady(new Request('http://localhost'), { EVIDENCE_MODE: 'preview' }),
    true,
  );
  assert.equal(new Set(flowItems.map((q) => q.id)).size, flowItems.length);
  assert.equal(homeworkIds.length, 5);
  for (const q of flowItems) {
    assert.ok(Number.isFinite(q.answer));
    assert.ok(q.family && q.hint && q.explanation);
    if (q.options) assert.ok(q.answer >= 1 && q.answer <= q.options.length);
    const old = items.find((i) => i.id === q.id);
    if (old) {
      assert.equal(old.familyId, q.family);
      assert.equal(old.answer, q.answer);
    }
  }
  assert.equal(new Set(verificationIds.map((i) => itemById(i).family)).size, 3);
  assert.ok(
    verificationIds.every(
      (i) =>
        !homeworkIds.some((h) => itemById(h).family === itemById(i).family),
    ),
  );
});
test('课后全对自动分析，跳过诊断补练，三道独立新题后结束', () => {
  let s = homework();
  assert.equal(s.phase, 'analysis');
  assert.equal(s.target, 'independent');
  s = advance(s, 'continue');
  assert.equal(s.phase, 'verify');
  s = finish(s);
  assert.equal(s.status, 'independent');
  assert.equal(s.observations.length, 8);
  assert.ok(s.reviewDue);
});
test('负数距离错误进入限定追问及补练，一轮不会无限增加题目', () => {
  let s = homework({ 'absolute-1': '−8' });
  assert.equal(s.target, 'distance');
  s = advance(s, 'continue');
  s = answer(s, -5);
  s = advance(s, 'continue');
  s = answer(s, 1);
  s = advance(s, 'continue');
  assert.equal(s.phase, 'remedy');
  s = finish(s);
  assert.equal(s.phase, 'complete');
  assert.equal(s.observations.filter((o) => o.phase === 'diagnose').length, 2);
  assert.equal(s.observations.filter((o) => o.phase === 'remedy').length, 2);
  assert.equal(s.observations.length, 12);
});
test('外部负号追問有反证时转向距离，不能把错误候选当成确诊', () => {
  let s = homework({ 'absolute-4': 6 });
  assert.equal(s.target, 'outer');
  s = advance(s, 'continue');
  s = answer(s, -7);
  s = advance(s, 'continue');
  assert.equal(s.target, 'distance');
  assert.equal(s.currentId, 'jx-notation-probe');
  assert.equal(s.probes.length, 2);
});
test('跳过不构造原因，学生拒绝诊断可以直接检查；帮助不算独立', () => {
  let s = advance(initialJourney(), 'continue');
  for (let i = 0; i < 5; i++) {
    s = advance(s, 'skip');
    if (i < 4) s = advance(s, 'continue');
  }
  assert.equal(s.target, 'uncertain');
  assert.ok(
    s.observations.every((o) => o.correct === null && o.cause === null),
  );
  s = advance(s, 'dismiss');
  assert.equal(s.phase, 'verify');
  s = addHelp(s, 'tutor');
  s = finish(s);
  assert.equal(s.status, 'review-needed');
});
test('未到期不能复测，未先独立通过的学生不标成延迟通过', () => {
  const now = Date.now();
  let s = finish(advance(homework(), 'continue'), now);
  assert.throws(() => advance(s, 'review', undefined, now), /REVIEW_NOT_DUE/);
  s = advance(s, 'review', undefined, now + 8 * DAY);
  s = finish(s, now + 8 * DAY);
  assert.equal(s.status, 'delayed');
  let other = advance(homework(), 'continue');
  other = finish(answer(other, 999, now), now);
  other = advance(other, 'review', undefined, now + 8 * DAY);
  other = finish(other, now + 8 * DAY);
  assert.equal(other.status, 'independent');
});
test('检查题材料不足就停止；同题换ID不允许洗成独立证据', () => {
  let s = homework();
  s.seen.push(verificationIds[0]);
  s = advance(s, 'continue');
  assert.equal(s.phase, 'complete');
  assert.equal(s.status, 'review-needed');
});

test('答后帮助保留原先独立观测，但污染后续同族题；复测材料耗尽不可循环', () => {
  let s = advance(homework(), 'continue');
  const family = itemById(s.currentId).family;
  s = answer(s);
  assert.equal(s.observations.at(-1).independent, true);
  s = addHelp(s, 'hint');
  assert.equal(s.observations.at(-1).independent, true);
  assert.ok(s.taughtFamilies.includes(family));
  s = finish(s);
  const due = s.reviewDue + DAY;
  s = advance(s, 'review', undefined, due);
  assert.equal(s.phase, 'complete');
  assert.equal(s.reviewDue, null);
  assert.throws(() => advance(s, 'review', undefined, due), /REVIEW_NOT_DUE/);
});

test('切换档案后即使版本相同也拒绝旧页面写入，答后帮助事件持久保存', async (t) => {
  const db = dbFor(t),
    l = id(),
    other = id();
  await ensureProfile(db, l);
  await ensureProfile(db, other);
  const a = await readJourney(db, l),
    b = await readJourney(db, other);
  assert.equal(a.revision, b.revision);
  await assert.rejects(
    changeJourney(db, other, {
      commandId: id(),
      revision: 0,
      sessionId: a.sessionId,
      action: 'continue',
    }),
    /SESSION_CHANGED/,
  );
  let s = advance(homework(), 'continue');
  s = answer(s);
  db.raw
    .prepare('UPDATE learning_journeys SET state=? WHERE learner=?')
    .run(JSON.stringify(s), l);
  const r = await changeJourney(db, l, {
    commandId: id(),
    revision: 0,
    sessionId: s.sessionId,
    action: 'help',
    kind: 'hint',
  });
  assert.equal(
    db.raw
      .prepare("SELECT COUNT(*) n FROM evidence_events WHERE kind='assistance'")
      .get().n,
    1,
  );
  assert.equal(r.view.answered, true);
});
test('教学Session重试只保存一次，旧版本写入冲突，旧课程进度同步且可删除', async (t) => {
  const db = dbFor(t),
    l = id();
  await ensureProfile(db, l);
  const s = await readJourney(db, l);
  const c = await changeJourney(db, l, {
    commandId: id(),
    revision: s.revision,
    action: 'continue',
  });
  const b = {
    commandId: id(),
    revision: c.view.revision,
    action: 'answer',
    answer: '8',
  };
  const [a, retry] = await Promise.all([
    changeJourney(db, l, b),
    changeJourney(db, l, b),
  ]);
  assert.equal(a.view.revision, retry.view.revision);
  assert.equal(db.raw.prepare('SELECT COUNT(*) n FROM attempts').get().n, 1);
  await assert.rejects(
    changeJourney(db, l, { ...b, answer: '9' }),
    /COMMAND_CONFLICT/,
  );
  await assert.rejects(
    changeJourney(db, l, { ...b, commandId: id() }),
    /STALE_ACTIVITY/,
  );
  assert.equal((await readJourney(db, l)).observations.length, 1);
  await compact(db, l, Date.now() + 31 * DAY);
  assert.equal((await readJourney(db, l)).observations.length, 1);
  await deleteProfile(db, l);
  assert.equal(
    db.raw.prepare('SELECT COUNT(*) n FROM learning_journeys').get().n,
    0,
  );
  await assert.rejects(readJourney(db, l), /PROFILE_DELETED/);
});
test('服务器上下文根据真实阶段提供信息，不泄露未提交检查题答案', () => {
  let s = advance(homework({ 'absolute-4': 6 }), 'continue');
  const c = tutorContext(s);
  assert.match(c, /再检查一小步/);
  assert.match(c, /outer/);
  assert.match(c, /不直接给最终答案/);
  assert.doesNotMatch(c, /当前题已提交，可解释/);
  s = answer(s);
  assert.match(tutorContext(s), /当前题已提交，可解释/);
});
