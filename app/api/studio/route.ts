import { getDatabase } from '@/db';
import {
  requireAdmin,
  studioUser,
  isAdmin,
  reply,
  failure,
  readInput,
  writeOrigin,
} from '@/server/studio/auth';
import {
  identifier,
  StudioError,
  publishIssues,
} from '@/server/studio/content';
import {
  listCourses,
  getCourse,
  createCourse,
  saveCourse,
  publishCourse,
  restoreCourse,
  archiveCourse,
  history,
  reports,
  trashDraft,
  trashEmptyDrafts,
} from '@/server/studio/store';
import { listAssets } from '@/server/studio/media';
export async function GET(request: Request) {
  try {
    const db = getDatabase(),
      url = new URL(request.url);
    if (url.searchParams.get('access') === '1') {
      const u = await studioUser(request);
      return reply({ admin: await isAdmin(db, u) });
    }
    await requireAdmin(db, request);
    const id = url.searchParams.get('id');
    if (!id)
      return reply({
        courses: await listCourses(db),
        trash: await listCourses(db, true),
        assets: await listAssets(db),
      });
    const course = await getCourse(db, identifier(id));
    if (url.searchParams.get('reports') === '1') {
      const offset = Math.max(
        0,
        Math.min(100000, Number(url.searchParams.get('offset')) || 0),
      );
      return reply({
        reports: await reports(db, id, Math.floor(offset)),
        enrollments: (
          await db
            .prepare(
              'SELECT e.learner,(SELECT student_name FROM evidence_profiles WHERE id=e.learner) AS studentName,e.version_id,e.last_segment,e.updated_at,(SELECT COUNT(*) FROM cms_progress p WHERE p.learner=e.learner AND p.version_id=e.version_id AND p.completed=1) AS completed FROM cms_enrollments e WHERE e.course_id=? ORDER BY e.updated_at DESC LIMIT 100 OFFSET ?',
            )
            .bind(id, Math.floor(offset))
            .all()
        ).results,
      });
    }
    return reply({
      course,
      history: await history(db, id),
      issues: publishIssues(course.draft),
      assets: await listAssets(db),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    writeOrigin(request);
    const db = getDatabase(),
      user = await requireAdmin(db, request),
      b = await readInput(request);
    if (b.action === 'create')
      return reply({ course: await createCourse(db, user.learner) });
    if (b.action === 'trash-empty') return reply(await trashEmptyDrafts(db, user.learner));
    const id = identifier(b.id);
    if (!Number.isInteger(b.revision) || b.revision < 0)
      throw new StudioError('版本编号无效。');
    if (b.action === 'trash' || b.action === 'restore-trash')
      return reply(await trashDraft(db, id, b.revision, user.learner, b.action === 'restore-trash'));
    let course;
    if (b.action === 'save')
      course = await saveCourse(db, id, b.revision, b.course, user.learner);
    else if (b.action === 'publish')
      course = await publishCourse(db, id, b.revision, user.learner);
    else if (b.action === 'restore')
      course = await restoreCourse(
        db,
        id,
        b.revision,
        identifier(b.version),
        user.learner,
      );
    else if (b.action === 'archive' && typeof b.archived === 'boolean')
      course = await archiveCourse(
        db,
        id,
        b.revision,
        b.archived,
        user.learner,
      );
    else throw new StudioError('不支持的操作。');
    return reply({
      course,
      history: await history(db, id),
      issues: publishIssues(course.draft),
    });
  } catch (e) {
    return failure(e);
  }
}
