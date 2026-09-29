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
import { beginUpload, confirmUpload, mediaUrl, uploadAsset, completeUpload } from '@/server/studio/media';
import { identifier, StudioError } from '@/server/studio/content';
export async function GET(request: Request) {
  try {
    const db = getDatabase(),
      u = await studioUser(request),
      id = identifier(new URL(request.url).searchParams.get('id'));
    return new Response(null, {
      status: 302,
      headers: {
        Location: await mediaUrl(db, id, u.learner, await isAdmin(db, u)),
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    writeOrigin(request);
    const db = getDatabase(),
      u = await requireAdmin(db, request),
      b = await readInput(request, 4096);
    if (b.action === 'sign') return reply(await beginUpload(db, u.learner, b));
    if (b.action === 'complete') return reply(await completeUpload(db, u.learner, identifier(b.id)));
    if (b.action === 'confirm')
      return reply(await confirmUpload(db, identifier(b.id)));
    throw new StudioError('不支持的操作。');
  } catch (e) {
    return failure(e);
  }
}

export async function PUT(request: Request) {
  try {
    writeOrigin(request);
    const db = getDatabase();
    const user = await requireAdmin(db, request);
    const id = identifier(new URL(request.url).searchParams.get('id'));
    return reply(await uploadAsset(db, user.learner, id, request));
  } catch (e) { return failure(e); }
}
