import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresD1, postgresSQL } from '../db/postgres.ts';
import { ensureProfile, loadSummary, importLegacy } from '../server/evidence/store.ts';
import { openConversation, thread } from '../server/course-tutor/store.ts';
import { courseContext } from '../server/course-tutor/context.ts';
import { lessons } from '../lib/curriculum.ts';
import { readJourney, changeJourney } from '../server/journey/service.ts';

test('SQL 参数中的引号、反斜杠与关键字不改变查询结构', () => {
  assert.match(postgresSQL('SELECT ? AS value', ["x'\\ RETURNING MAX(a,b)"]), /MAX\(a,b\)/);
  assert.throws(() => postgresSQL('SELECT ?', []));
  assert.throws(() => postgresSQL('SELECT ?', [{}]));
});
test('云数据库：持久保存、账号隔离与事务回滚', {skip: !process.env.CLOUDBASE_SERVER_KEY}, async () => {
  const db = new PostgresD1(); const a = crypto.randomUUID(), b = crypto.randomUUID();
  try {
    await ensureProfile(db,a); await ensureProfile(db,b);
    const answer = "验证 ' \\ MAX(a,b)";
    await db.prepare('INSERT INTO attempts (learner,request_id,question_id,answer,correct,created_at) VALUES (?,?,?,?,?,?)').bind(a,crypto.randomUUID(),'signed-1',answer,1,new Date().toISOString()).run();
    assert.equal((await new PostgresD1().prepare('SELECT answer FROM attempts WHERE learner=?').bind(a).first()).answer,answer);
    assert.equal(await db.prepare('SELECT answer FROM attempts WHERE learner=?').bind(b).first(),null);
    await importLegacy(db,a);
    assert.ok(await loadSummary(db,a));
    const journey = await readJourney(db,a);
    assert.equal((await readJourney(new PostgresD1(),a)).sessionId, journey.sessionId);
    const conversation = await openConversation(db,a,courseContext(lessons[0].id));
    assert.ok(conversation);
    const row = await db.prepare('SELECT id, lesson_id AS lessonId FROM tutor_conversations WHERE learner=?').bind(a).first();
    assert.equal(row.lessonId, lessons[0].id);
    await assert.rejects(thread(db,b,row.id));
    await assert.rejects(db.batch([
      db.prepare('INSERT INTO evidence_commands (learner,command_id,hash,created_at) VALUES (?,?,?,?)').bind(a,'rollback','test',Date.now()),
      db.prepare('UPDATE evidence_commands SET guard=0 WHERE learner=? AND command_id=?').bind(a,'rollback'),
    ]));
    assert.equal(await db.prepare('SELECT * FROM evidence_commands WHERE learner=? AND command_id=?').bind(a,'rollback').first(),null);
  } finally {
    for (const table of ['attempts','learning_journeys','tutor_conversations','tutor_messages','evidence_events','evidence_commands','evidence_snapshots','evidence_profiles']) await db.prepare(`DELETE FROM ${table} WHERE ${table === 'evidence_profiles' ? 'id' : 'learner'} IN (?,?)`).bind(a,b).run();
  }
});
