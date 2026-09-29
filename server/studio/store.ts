import {
  emptyCourse,
  flattenSegments,
  type StudioCourse,
  type CourseRow,
} from '../../lib/studio.ts';
import { StudioError, publishIssues, validateCourse } from './content.ts';
type RawCourse = Omit<CourseRow, 'draft'> & { draft: string };
export async function getCourse(db: D1Database, id: string) {
  const row = await db
    .prepare('SELECT * FROM cms_courses WHERE id=?')
    .bind(id)
    .first<RawCourse>();
  if (!row) throw new StudioError('课程不存在。', 404);
  if (row.archived === 2) throw new StudioError('课程已移入回收站，请先恢复。', 410);
  return { ...row, draft: JSON.parse(row.draft) as StudioCourse };
}
export async function listCourses(db: D1Database, trash = false) {
  const { results } = await db
    .prepare(`SELECT * FROM cms_courses WHERE archived ${trash ? '=' : '<>'} 2 ORDER BY updated_at DESC LIMIT 200`)
    .all<RawCourse>();
  return results.map((r) => {
    const c = JSON.parse(r.draft) as StudioCourse;
    return {
      id: r.id,
      title: c.title,
      description: c.description,
      coverId: c.coverId,
      revision: r.revision,
      published_version: r.published_version,
      archived: r.archived,
      updated_at: r.updated_at,
      segments: flattenSegments(c).length,
      emptyDraft: !r.published_version && isEmptyDraft(c),
    };
  });
}
function isEmptyDraft(c: StudioCourse) {
  return c.title.trim() === '未命名课程' && !c.description.trim() && !c.coverId && c.chapters.length === 0;
}

// archived: 0 = active, 1 = unpublished, 2 = recoverable draft trash.
// Published history and student records are never moved to the draft trash.
export async function trashDraft(db: D1Database, id: string, revision: number, actor: string, restore = false) {
  const result = await db.prepare(`UPDATE cms_courses SET archived=?,revision=revision+1,updated_at=?,updated_by=?
    WHERE id=? AND revision=? AND archived ${restore ? '=' : '<>'} 2 AND published_version IS NULL
    AND NOT EXISTS(SELECT 1 FROM cms_versions WHERE course_id=cms_courses.id)
    AND NOT EXISTS(SELECT 1 FROM cms_enrollments WHERE course_id=cms_courses.id) RETURNING id`)
    .bind(restore ? 0 : 2, Date.now(), actor, id, revision).all();
  if (!result.results.length) throw new StudioError('课程已变化，或有发布和学习记录。请刷新后重试。', 409);
  return { ok: true };
}

export async function trashEmptyDrafts(db: D1Database, actor: string) {
  const { results } = await db.prepare('SELECT * FROM cms_courses WHERE archived<>2 AND published_version IS NULL ORDER BY updated_at DESC LIMIT 200').all<RawCourse>();
  const empty = results.filter(r => isEmptyDraft(JSON.parse(r.draft)));
  let count = 0;
  for (const r of empty) {
    try { await trashDraft(db, r.id, r.revision, actor); count++; }
    catch (e) { if (!(e instanceof StudioError) || e.status !== 409) throw e; }
  }
  return { count };
}
export async function createCourse(db: D1Database, actor: string) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO cms_courses(id,draft,revision,updated_at,updated_by) VALUES (?,?,0,?,?)',
    )
    .bind(id, JSON.stringify(emptyCourse()), Date.now(), actor)
    .run();
  return getCourse(db, id);
}
export async function checkAssets(db: D1Database, c: StudioCourse) {
  const ids = [
    ...(c.coverId ? [{ id: c.coverId, kind: 'image/' }] : []),
    ...flattenSegments(c)
      .filter((s) => s.videoId)
      .map((s) => ({ id: s.videoId, kind: 'video/' })),
  ];
  if (!ids.length) return;
  const { results } = await db
    .prepare(
      `SELECT id,mime,status FROM cms_assets WHERE id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(...ids.map((a) => a.id))
    .all<{ id: string; mime: string; status: string }>();
  if (
    ids.some(
      (a) =>
        !results.some(
          (r) =>
            r.id === a.id && r.status === 'ready' && r.mime.startsWith(a.kind),
        ),
    )
  )
    throw new StudioError('部分素材尚未上传完成或类型不匹配，请重新选择。');
}
export async function saveCourse(
  db: D1Database,
  id: string,
  revision: number,
  raw: unknown,
  actor: string,
) {
  const c = validateCourse(raw);
  await checkAssets(db, c);
  const result = await db
    .prepare(
      'UPDATE cms_courses SET draft=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND archived<>2 RETURNING id',
    )
    .bind(JSON.stringify(c), Date.now(), actor, id, revision)
    .all();
  if (!result.results.length)
    throw new StudioError(
      '课程已在另一处修改。请先导出当前草稿备份，再重新载入。',
      409,
    );
  return getCourse(db, id);
}
export async function publishCourse(
  db: D1Database,
  id: string,
  revision: number,
  actor: string,
) {
  const c = await getCourse(db, id);
  if (c.revision !== revision)
    throw new StudioError('课程版本已变化，请重新载入。', 409);
  const issues = publishIssues(c.draft);
  if (issues.length) throw new StudioError(issues.slice(0, 12).join('；'));
  await checkAssets(db, c.draft);
  const version = crypto.randomUUID(),
    now = Date.now();
  const result = await db.batch([
    db
      .prepare(
        'INSERT INTO cms_versions(id,course_id,document,created_at,created_by) SELECT ?,id,draft,?,? FROM cms_courses WHERE id=? AND revision=? RETURNING id',
      )
      .bind(version, now, actor, id, revision),
    db
      .prepare(
        'UPDATE cms_courses SET published_version=?,archived=0,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM cms_versions WHERE id=?) RETURNING id',
      )
      .bind(version, now, actor, id, revision, version),
  ]);
  if (!result[1].results.length)
    throw new StudioError('课程已变化，本次未发布，请重新载入。', 409);
  return getCourse(db, id);
}
export async function restoreCourse(
  db: D1Database,
  id: string,
  revision: number,
  version: string,
  actor: string,
) {
  const row = await db
    .prepare('SELECT document FROM cms_versions WHERE id=? AND course_id=?')
    .bind(version, id)
    .first<{ document: string }>();
  if (!row) throw new StudioError('历史版本不存在。', 404);
  return saveCourse(db, id, revision, JSON.parse(row.document), actor);
}
export async function archiveCourse(
  db: D1Database,
  id: string,
  revision: number,
  archived: boolean,
  actor: string,
) {
  const r = await db
    .prepare(
      'UPDATE cms_courses SET archived=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND archived<>2 RETURNING id',
    )
    .bind(archived ? 1 : 0, Date.now(), actor, id, revision)
    .all();
  if (!r.results.length) throw new StudioError('课程已变化，请重新载入。', 409);
  return getCourse(db, id);
}
export async function history(db: D1Database, id: string) {
  return (
    await db
      .prepare(
        'SELECT id,created_at FROM cms_versions WHERE course_id=? ORDER BY created_at DESC LIMIT 100',
      )
      .bind(id)
      .all()
  ).results;
}
export async function reports(db: D1Database, id: string, offset = 0) {
  return (
    await db
      .prepare(
        `SELECT a.learner,a.version_id,a.segment_id,a.question_id,a.answer,a.correct,a.feedback,a.source,a.status,a.created_at,v.document FROM cms_answers a JOIN cms_versions v ON v.id=a.version_id WHERE v.course_id=? ORDER BY a.created_at DESC LIMIT 100 OFFSET ?`,
      )
      .bind(id, offset)
      .all<{
        learner: string;
        document: string;
        segment_id: string;
        question_id: string;
      }>()
  ).results.map(({ document, ...r }) => {
    const s = flattenSegments(JSON.parse(document) as StudioCourse).find(
      (s) => s.id === r.segment_id,
    );
    return {
      ...r,
      segmentTitle: s?.title,
      questionTitle: s?.questions.find((q) => q.id === r.question_id)?.prompt,
    };
  });
}
