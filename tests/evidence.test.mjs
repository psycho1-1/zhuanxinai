import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import {
  ensureProfile,
  loadSummary,
  saveSnapshot,
  command,
  addEvent,
  importLegacy,
} from '../server/evidence/store.ts';
import {
  next,
  attempt,
  assistance,
  skip,
  state,
  createRecovery,
  createProfile,
} from '../server/evidence/service.ts';
import {
  compact,
  deleteProfile,
  replayDeletions,
} from '../server/evidence/lifecycle.ts';
import {
  emptySummary,
  foldEvents,
  skillStates,
} from '../server/evidence/model.ts';
import {
  items,
  catalog,
  publicItem,
  ready,
} from '../server/evidence/catalog.ts';
import { DAY } from '../lib/evidence-contract.ts';
import { quotaStatement, quotaDenied } from '../server/tutor.ts';

// Actual SQLite constraints and transactions, with the D1 async API shape.
function database(t) {
  const raw = new DatabaseSync(':memory:');
  const dir = new URL('../drizzle/', import.meta.url);
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort())
    raw.exec(readFileSync(new URL(name, dir), 'utf8'));
  t.after(() => raw.close());
  const db = {
    raw,
    failBatchAt: -1,
    prepare(sql) {
      let values = [];
      const result = {
        bind(...v) {
          values = v;
          return result;
        },
        execute() {
          return { results: raw.prepare(sql).all(...values), success: true };
        },
        async first() {
          return raw.prepare(sql).get(...values) ?? null;
        },
        async all() {
          return result.execute();
        },
        async run() {
          return result.execute();
        },
      };
      return result;
    },
    async batch(statements) {
      raw.exec('BEGIN');
      try {
        const results = statements.map((s, i) => {
          if (i === db.failBatchAt) throw new Error('injected storage failure');
          return s.execute();
        });
        raw.exec('COMMIT');
        return results;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db;
}
const id = () => crypto.randomUUID();
async function learner(db) {
  const l = id();
  await ensureProfile(db, l);
  return l;
}
const issue = (db, l, purpose = 'pretest', topic = 'absolute') =>
  next(db, l, { commandId: id(), topic, purpose });
const submit = (db, l, p, answer, commandId = id()) =>
  attempt(db, l, {
    commandId,
    presentationId: p.presentationId,
    answer: String(answer),
  });
const correct = (p) => items.find((i) => i.id === p.item.id).answer;

test('60 题草稿、11 个能力、题族和答案隔离；线上草稿门禁关闭', () => {
  assert.equal(items.length, 60);
  assert.equal(catalog.skills.length, 11);
  assert.equal(new Set(items.map((i) => i.id)).size, 60);
  for (const i of items) {
    assert.ok(catalog.skills.some((s) => s.id === i.skillId));
    assert.ok(
      i.familyId && i.hint && i.explanation && Number.isFinite(i.answer),
    );
    for (const field of ['answer', 'explanation', 'hint', 'errorMap'])
      assert.equal(field in publicItem(i), false);
    if (i.options) assert.ok(i.answer >= 1 && i.answer <= i.options.length);
    assert.equal(i.errorMap?.[String(i.answer)], undefined);
  }
  for (const topic of ['absolute', 'addition', 'subtraction'])
    for (const [purpose, n] of [
      ['diagnostic', 3],
      ['practice', 5],
      ['pretest', 4],
      ['immediate', 4],
      ['delayed', 4],
    ])
      assert.equal(
        items.filter((i) => i.topic === topic && i.purpose === purpose).length,
        n,
      );
  assert.equal(
    ready(new Request('https://example.com'), { EVIDENCE_MODE: 'preview' }),
    false,
  );
  assert.equal(
    ready(new Request('https://example.com'), { EVIDENCE_MODE: 'pilot' }),
    false,
  );
  assert.equal(
    ready(new Request('http://localhost:3000'), { EVIDENCE_MODE: 'preview' }),
    true,
  );
});

test('重复/并发提交只保存一次，同编号不同答案冲突，不同编号不能二次作答', async (t) => {
  const db = database(t),
    l = await learner(db),
    p = await issue(db, l),
    cmd = id();
  const [a, b] = await Promise.all([
    submit(db, l, p, correct(p), cmd),
    submit(db, l, p, correct(p), cmd),
  ]);
  assert.equal(a.eventSeq, b.eventSeq);
  assert.equal(a.evidenceClass, 'independent');
  assert.equal(
    db.raw
      .prepare("SELECT COUNT(*) n FROM evidence_events WHERE kind='answered'")
      .get().n,
    1,
  );
  await assert.rejects(submit(db, l, p, -987, cmd), /COMMAND_CONFLICT/);
  await assert.rejects(submit(db, l, p, correct(p)), /STALE_ACTIVITY/);
});

test('批次中途故障完整回滚；原 commandId 重试成功', async (t) => {
  const db = database(t),
    l = await learner(db),
    p = await issue(db, l),
    cmd = id();
  db.failBatchAt = 4;
  await assert.rejects(submit(db, l, p, correct(p), cmd), /injected storage/);
  assert.equal(
    db.raw
      .prepare("SELECT COUNT(*) n FROM evidence_events WHERE kind='answered'")
      .get().n,
    0,
  );
  assert.equal(
    db.raw
      .prepare('SELECT status FROM evidence_presentations WHERE id=?')
      .get(p.presentationId).status,
    'active',
  );
  db.failBatchAt = -1;
  assert.equal((await submit(db, l, p, correct(p), cmd)).correct, true);
});

test('帮助先保存再答题不算独立；同题族变体不能洗成独立证据', async (t) => {
  const db = database(t),
    l = await learner(db),
    p = await issue(db, l);
  await assistance(db, l, {
    commandId: id(),
    presentationId: p.presentationId,
    kind: 'hint',
  });
  assert.equal(
    (await submit(db, l, p, correct(p))).evidenceClass,
    'assisted_or_familiar',
  );
  const q = await issue(db, l, 'immediate');
  assert.notEqual(q.item.familyId, p.item.familyId);
  assert.equal(
    (await submit(db, l, q, correct(q))).evidenceClass,
    'independent',
  );
});

test('双标签页同时选题只能发出一题；档案之间不能提交或读取活动', async (t) => {
  const db = database(t),
    l = await learner(db),
    other = await learner(db);
  const r = await Promise.allSettled([issue(db, l), issue(db, l)]);
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  const p = r.find((x) => x.status === 'fulfilled').value;
  await assert.rejects(submit(db, other, p, correct(p)), /ACTIVITY_NOT_FOUND/);
  assert.equal((await state(db, other)).active, null);
});

test('跳过不计错，拒绝诊断后改用练习，恢复码重置使旧码失效', async (t) => {
  const db = database(t),
    l = await learner(db),
    p = await issue(db, l, 'diagnostic');
  await skip(db, l, {
    commandId: id(),
    presentationId: p.presentationId,
    dismiss: true,
  });
  const s = await loadSummary(db, l);
  assert.equal(s.topics.absolute.answered, 0);
  assert.equal(s.topics.absolute.dismissed, true);
  assert.equal((await issue(db, l, 'diagnostic')).item.purpose, 'practice');
  const cmd = id(),
    a = await createRecovery(db, l, { commandId: cmd });
  await assert.rejects(
    createRecovery(db, l, { commandId: cmd }),
    /RECOVERY_ALREADY_DELIVERED/,
  );
  const b = await createRecovery(db, l, { commandId: id() });
  assert.notEqual(a.recoveryCode, b.recoveryCode);
  assert.equal(
    db.raw
      .prepare('SELECT COUNT(*) n FROM evidence_commands WHERE response LIKE ?')
      .get(`%${a.recoveryCode}%`).n,
    0,
  );
});

test('旧记录的帮助情况未知，不形成能力证据；导入幂等', async (t) => {
  const db = database(t),
    l = await learner(db);
  db.raw
    .prepare(
      'INSERT INTO attempts (learner,request_id,question_id,answer,correct,created_at) VALUES (?,?,?,?,?,?)',
    )
    .run(l, id(), 'absolute-1', '8', 1, new Date().toISOString());
  await importLegacy(db, l);
  await importLegacy(db, l);
  assert.equal(
    db.raw
      .prepare("SELECT COUNT(*) n FROM evidence_events WHERE kind='legacy'")
      .get().n,
    1,
  );
  assert.equal((await state(db, l)).states[0].status, '未评估');
});

test('30 天压缩前后状态一致，旧快照不能覆盖新快照，删除清理且不可复活', async (t) => {
  const db = database(t),
    l = await learner(db),
    p = await issue(db, l);
  await submit(db, l, p, correct(p));
  const before = await loadSummary(db, l);
  await compact(db, l, Date.now() + 31 * DAY);
  assert.deepEqual(await loadSummary(db, l), before);
  await saveSnapshot(db, l, before);
  await saveSnapshot(db, l, emptySummary());
  assert.equal(
    db.raw
      .prepare('SELECT through_seq FROM evidence_snapshots WHERE learner=?')
      .get(l).through_seq,
    before.throughSeq,
  );
  await deleteProfile(db, l);
  await replayDeletions(db, [{ learner: l, requestedAt: Date.now() }]);
  await assert.rejects(ensureProfile(db, l), /PROFILE_DELETED/);
  await assert.rejects(command(db, l, id(), {}, [], {}), /STALE_ACTIVITY/);
  for (const table of [
    'attempts',
    'evidence_events',
    'evidence_commands',
    'evidence_presentations',
    'evidence_baselines',
    'evidence_snapshots',
    'tutor_reservations',
  ])
    assert.equal(
      db.raw.prepare(`SELECT COUNT(*) n FROM ${table} WHERE learner=?`).get(l)
        .n,
      0,
    );
});

test('三个跨题族独立检验后通过，七天后复核，两族延迟正确后通过，矛盾证据撤回', () => {
  let seq = 0;
  const start = Date.now();
  const event = (purpose, correct, at, family = 'f' + seq) => ({
    seq: ++seq,
    kind: 'answered',
    topic: 'absolute',
    created_at: at,
    payload: JSON.stringify({
      itemId: 'i' + seq,
      familyId: family,
      purpose,
      correct,
      evidenceClass: 'independent',
    }),
  });
  let s = foldEvents(emptySummary(), [
    event('immediate', true, start),
    event('immediate', true, start + 1),
    event('immediate', true, start + 2),
  ]);
  assert.equal(skillStates(s, start + 3)[0].status, '独立通过');
  assert.equal(skillStates(s, start + 8 * DAY)[0].status, '待复核');
  s = foldEvents(s, [
    event('delayed', true, start + 8 * DAY),
    event('delayed', true, start + 8 * DAY + 1),
  ]);
  assert.equal(skillStates(s, start + 8 * DAY + 2)[0].status, '延迟通过');
  s = foldEvents(s, [event('immediate', false, start + 9 * DAY)]);
  assert.equal(skillStates(s, start + 9 * DAY)[0].status, '待复核');
  assert.throws(
    () => foldEvents({ ...s, modelVersion: 'unknown' }, []),
    /BASELINE_VERSION/,
  );
});

test('任一 AI 限额拒绝时全部桶回滚，旧时间窗口不能重置新计数', async (t) => {
  const db = database(t),
    l = await learner(db),
    now = Date.now();
  for (let i = 0; i < 3; i++) await db.batch([quotaStatement(db, l, now)]);
  await assert.rejects(db.batch([quotaStatement(db, l, now)]), quotaDenied);
  assert.equal(
    db.raw
      .prepare("SELECT used FROM tutor_limits WHERE bucket='site:day'")
      .get().used,
    3,
  );
  await assert.rejects(
    db.batch([quotaStatement(db, l, now - 2 * DAY)]),
    quotaDenied,
  );
  assert.equal(
    db.raw
      .prepare("SELECT used FROM tutor_limits WHERE bucket='site:day'")
      .get().used,
    3,
  );
});

test('新旧写入交错时分批导入不跳过中间记录', async (t) => {
  const db = database(t),
    l = await learner(db),
    insert = db.raw.prepare(
      'INSERT INTO attempts (learner,request_id,question_id,answer,correct,created_at) VALUES (?,?,?,?,?,?)',
    );
  for (let n = 0; n < 151; n++)
    insert.run(l, id(), 'absolute-1', '8', 1, new Date().toISOString());
  await addEvent(db, l, 'legacy:151', 'legacy', 'legacy', null, {
    legacyAttemptId: 151,
  }).run();
  await importLegacy(db, l);
  await importLegacy(db, l);
  await importLegacy(db, l);
  assert.equal(
    db.raw
      .prepare(
        "SELECT COUNT(*) n FROM evidence_events WHERE learner=? AND kind='legacy'",
      )
      .get(l).n,
    151,
  );
});

test('501 条新事件仍能计算；压缩在分页之间发生也不丢事件', async (t) => {
  const db = database(t),
    l = await learner(db);
  for (let n = 0; n < 1001; n++)
    await addEvent(
      db,
      l,
      id(),
      'answered',
      'absolute',
      null,
      {
        correct: false,
        evidenceClass: 'assisted_or_familiar',
        purpose: 'practice',
      },
      Date.now() - 31 * DAY,
    ).run();
  const original = await loadSummary(db, l);
  assert.equal(original.topics.absolute.answered, 1001);
  const batch = db.batch.bind(db);
  let first = true;
  db.batch = async (statements) => {
    const result = await batch(statements);
    if (first) {
      first = false;
      await compact(db, l);
    }
    return result;
  };
  assert.deepEqual(await loadSummary(db, l), original);
});

test('未迁移的旧身份删除后不能重建，删除清单独立于档案行生效', async (t) => {
  const db = database(t),
    l = id();
  await deleteProfile(db, l);
  await assert.rejects(ensureProfile(db, l), /PROFILE_DELETED/);
  db.raw.prepare('DELETE FROM evidence_profiles WHERE id=?').run(l);
  await assert.rejects(ensureProfile(db, l), /PROFILE_DELETED/);
});

test('同一请求并发生成恢复码至多返回一个有效码', async (t) => {
  const db = database(t),
    l = await learner(db),
    cmd = id();
  const result = await Promise.allSettled([
    createRecovery(db, l, { commandId: cmd }),
    createRecovery(db, l, { commandId: cmd }),
  ]);
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(
    result.find((r) => r.status === 'rejected').reason.message,
    /RECOVERY_ALREADY_DELIVERED/,
  );
});

test('创建档案并发与新旧 Cookie 重试都返回同一新档案', async (t) => {
  const db = database(t),
    l = await learner(db),
    cmd = id();
  const [a, b] = await Promise.all([
    createProfile(db, l, { commandId: cmd }),
    createProfile(db, l, { commandId: cmd }),
  ]);
  assert.equal(a.profileId, b.profileId);
  assert.equal(
    (await createProfile(db, a.profileId, { commandId: cmd })).profileId,
    a.profileId,
  );
  assert.equal(
    db.raw.prepare('SELECT COUNT(*) n FROM evidence_profiles').get().n,
    2,
  );
});

test('延迟检验失败后，一次即时正确不能抵消失败', () => {
  let seq = 0;
  const start = Date.now();
  const e = (purpose, correct, at) => ({
    seq: ++seq,
    kind: 'answered',
    topic: 'absolute',
    created_at: at,
    payload: JSON.stringify({
      itemId: 'i' + seq,
      familyId: 'f' + seq,
      purpose,
      correct,
      evidenceClass: 'independent',
    }),
  });
  let s = foldEvents(emptySummary(), [
    e('immediate', true, start),
    e('immediate', true, start + 1),
    e('immediate', true, start + 2),
    e('delayed', false, start + 8 * DAY),
    e('immediate', true, start + 9 * DAY),
  ]);
  assert.equal(skillStates(s, start + 9 * DAY)[0].status, '待复核');
  s = foldEvents(s, [
    e('immediate', true, start + 9 * DAY + 1),
    e('immediate', true, start + 9 * DAY + 2),
  ]);
  assert.equal(skillStates(s, start + 9 * DAY + 3)[0].status, '独立通过');
});
