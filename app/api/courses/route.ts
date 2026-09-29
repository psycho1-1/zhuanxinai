import { getDatabase } from '@/db';
import {
  studioUser,
  reply,
  failure,
  readInput,
  writeOrigin,
} from '@/server/studio/auth';
import { identifier, StudioError } from '@/server/studio/content';
import {
  catalog,
  enroll,
  learningState,
  recordProgress,
  submitAnswer,
} from '@/server/studio/learning';
export async function GET(request: Request) {
  try {
    const db = getDatabase(),
      u = await studioUser(request),
      id = new URL(request.url).searchParams.get('id');
    return reply(
      id
        ? await learningState(db, u.learner, identifier(id))
        : { courses: await catalog(db, u.learner) },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    writeOrigin(request);
    const db = getDatabase(),
      u = await studioUser(request),
      b = await readInput(request, 12000),
      id = identifier(b.id);
    if (b.action === 'enroll') return reply(await enroll(db, u.learner, id));
    const segment = identifier(b.segmentId);
    if (b.action === 'answer') {
      if (typeof b.answer !== 'string') throw new StudioError('请填写答案。');
      return reply(
        await submitAnswer(
          db,
          u.learner,
          id,
          segment,
          identifier(b.questionId),
          identifier(b.requestId),
          b.answer,
          {
            DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
            AI_TUTOR_ENABLED: process.env.AI_TUTOR_ENABLED,
            AI_TUTOR_MODEL: process.env.AI_TUTOR_MODEL,
          },
        ),
      );
    }
    if (!['progress', 'complete', 'skip'].includes(b.action))
      throw new StudioError('不支持的操作。');
    const seconds = b.seconds ?? 0;
    if (
      !Number.isInteger(seconds) ||
      seconds < 0 ||
      seconds > 86400 ||
      (b.ended !== undefined && typeof b.ended !== 'boolean')
    )
      throw new StudioError('播放进度格式不正确。');
    return reply(
      await recordProgress(
        db,
        u.learner,
        id,
        segment,
        b.action,
        seconds,
        b.ended === true,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
