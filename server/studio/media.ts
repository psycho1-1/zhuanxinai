import { StudioError, identifier } from './content.ts';
import { flattenSegments, type StudioCourse } from '../../lib/studio.ts';
import { MEDIA_TYPES, mediaInputError, uploadFailure, UPLOAD_CHUNK_BYTES } from '../../lib/media-upload.ts';
const origin =
  'https://zhixu-math-test-d2fi7r0hc6ae5fdb.api.tcloudbasegateway.com';
const base = `${origin}/v1/storages`;
const bucket = 'course-media';
export type Asset = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  object_path: string;
  status: string;
  created_at: number;
  created_by: string;
};
async function storage(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<any> {
  const key = process.env.CLOUDBASE_SERVER_KEY ?? process.env.CLOUDBASE_APIKEY;
  if (!key) throw new StudioError('素材存储尚未配置。课程草稿仍可保存。', 503);
  const r = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new StudioError('素材存储暂时不可用，请稍后重试。', 503);
  return r.json();
}
function objectPath(asset: Asset) {
  return `${bucket}/${asset.object_path.split('/').map(encodeURIComponent).join('/')}`;
}
export async function listAssets(db: D1Database) {
  return (
    await db
      .prepare(
        "SELECT id,name,mime,bytes,status,created_at FROM cms_assets WHERE status='ready' ORDER BY created_at DESC LIMIT 500",
      )
      .all()
  ).results;
}
export async function beginUpload(
  db: D1Database,
  user: string,
  body: Record<string, any>,
) {
  const invalid = mediaInputError(body.name, body.mime, body.bytes);
  if (invalid) throw new StudioError(invalid);
  const id = crypto.randomUUID(),
    path = `courses/${id}.${MEDIA_TYPES[body.mime]}`;
  await db
    .prepare(
      "INSERT INTO cms_assets(id,name,mime,bytes,object_path,status,created_at,created_by) VALUES (?,?,?,?,?,'pending',?,?)",
    )
    .bind(id, body.name.trim(), body.mime, body.bytes, path, Date.now(), user)
    .run();
  return {
    id,
    url: `/api/studio/assets?id=${encodeURIComponent(id)}`,
    chunkBytes: UPLOAD_CHUNK_BYTES,
  };
}

// The service credential stays on the server. The browser can upload only to
// an asset registered by the authenticated administrator, with bounded bytes.
export async function uploadAsset(db: D1Database, user: string, id: string, request: Request) {
  const a = await db.prepare('SELECT * FROM cms_assets WHERE id=?').bind(identifier(id)).first<Asset>();
  if (!a || a.created_by !== user) throw new StudioError('无权上传这个素材。', 403);
  if (a.status === 'ready') return { ok: true };
  const invalid = mediaInputError(a.name, a.mime, a.bytes);
  if (invalid) throw new StudioError(invalid, 413);
  const index = Number(new URL(request.url).searchParams.get('part'));
  if (!Number.isInteger(index) || index < 0 || index >= Math.ceil(a.bytes / UPLOAD_CHUNK_BYTES))
    throw new StudioError('上传分块编号无效。');
  const expected = Math.min(UPLOAD_CHUNK_BYTES, a.bytes - index * UPLOAD_CHUNK_BYTES);
  if (request.headers.get('content-type')?.split(';')[0] !== a.mime)
    throw new StudioError('文件类型与登记内容不符。', 415);
  const length = request.headers.get('content-length');
  if (length !== null && Number(length) !== expected)
    throw new StudioError('文件大小与登记内容不符。', 400);
  const reader = request.body?.getReader();
  if (!reader) throw new StudioError('请选择文件。');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > expected) {
        await reader.cancel();
        throw new StudioError('文件大小与登记内容不符。', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (size !== expected) throw new StudioError('文件分块没有传输完整，请重试。');
  const key = process.env.CLOUDBASE_SERVER_KEY ?? process.env.CLOUDBASE_APIKEY;
  if (!key) throw new StudioError('素材存储尚未配置。', 503);
  let response: Response;
  try {
    response = await fetch(`${base}/object/${partPath(a, index)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': a.mime, 'x-upsert': 'true' },
      body: Buffer.concat(chunks),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(40000)]),
    });
  } catch {
    throw new StudioError(uploadFailure(504), 504);
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as { code?: string };
    throw new StudioError(uploadFailure(response.status, detail.code), response.status === 413 ? 413 : 502);
  }
  return { ok: true, part: index };
}

function partPath(a: Asset, index: number) {
  return `${bucket}/courses/${a.id}-parts/${index}.${MEDIA_TYPES[a.mime]}`;
}

export async function completeUpload(db: D1Database, user: string, id: string) {
  const a = await db.prepare('SELECT * FROM cms_assets WHERE id=?').bind(identifier(id)).first<Asset>();
  if (!a || a.created_by !== user) throw new StudioError('无权上传这个素材。', 403);
  if (a.status === 'ready') return { ok: true };
  const invalid = mediaInputError(a.name, a.mime, a.bytes);
  if (invalid) throw new StudioError(invalid, 413);
  const key = process.env.CLOUDBASE_SERVER_KEY ?? process.env.CLOUDBASE_APIKEY;
  if (!key) throw new StudioError('素材存储尚未配置。', 503);
  const count = Math.ceil(a.bytes / UPLOAD_CHUNK_BYTES);
  const chunks: Buffer[] = [];
  const signal = AbortSignal.timeout(45000);
  try {
    // Four bounded reads at a time; file transfers here stay within the cloud.
    for (let offset = 0; offset < count; offset += 4) {
      const group = await Promise.all(Array.from({ length: Math.min(4, count-offset) }, async (_, n) => {
        const index = offset+n;
        const response = await fetch(`${base}/object/authenticated/${partPath(a,index)}`, {headers:{Authorization:`Bearer ${key}`},signal});
        if (!response.ok) throw new StudioError(`第 ${index+1} 个分块尚未上传成功，请重试。`);
        const expected = Math.min(UPLOAD_CHUNK_BYTES,a.bytes-index*UPLOAD_CHUNK_BYTES);
        const reader = response.body?.getReader();
        if (!reader) throw new StudioError('无法读取视频分块。');
        const pieces: Uint8Array[]=[]; let total=0;
        try {
          while (true) {
            const {done,value}=await reader.read(); if(done) break;
            total+=value.byteLength;
            if(total>expected){await reader.cancel();throw new StudioError('视频分块大小不符，请重新上传。');}
            pieces.push(value);
          }
        } finally {reader.releaseLock();}
        if(total!==expected)throw new StudioError('视频分块不完整，请重试。');
        return Buffer.concat(pieces);
      }));
      chunks.push(...group);
    }
    const response=await fetch(`${base}/object/${objectPath(a)}`,{
      method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':a.mime},body:Buffer.concat(chunks),signal,
    });
    if(!response.ok){
      const detail=await response.json().catch(()=>({})) as {code?:string};
      // Never overwrite the final object. A retry after a lost response verifies it.
      if(response.status!==409 && detail.code!=='STORAGE_RESOURCE_ALREADY_EXISTS')
        throw new StudioError(uploadFailure(response.status,detail.code),502);
    }
    await confirmUpload(db,id);
  } catch(e) {
    if(e instanceof StudioError)throw e;
    throw new StudioError('视频保存暂时超时，请点击重试完成上传。已上传分块仍保留。',504);
  }
  // Only remove this upload's temporary parts after final metadata is verified.
  try {await storage(`/object/${bucket}`,'DELETE',{prefixes:Array.from({length:count},(_,i)=>partPath(a,i).slice(bucket.length+1))});} catch { /* Ready media remains available if temporary cleanup fails. */ }
  return {ok:true};
}
export async function confirmUpload(db: D1Database, id: string) {
  const a = await db
    .prepare('SELECT * FROM cms_assets WHERE id=?')
    .bind(identifier(id))
    .first<Asset>();
  if (!a) throw new StudioError('素材不存在。', 404);
  const info = await storage(`/object/info/authenticated/${objectPath(a)}`);
  const metadata = info.metadata ?? info;
  const size = Number(metadata.size ?? info.size),
    mime =
      metadata.mimetype ??
      metadata.contentType ??
      info.content_type ??
      info.contentType;
  if (size !== a.bytes || mime !== a.mime)
    throw new StudioError('上传文件大小或类型与登记内容不符，请重新上传。');
  await db
    .prepare("UPDATE cms_assets SET status='ready' WHERE id=?")
    .bind(id)
    .run();
  return { ok: true };
}
export async function mediaUrl(
  db: D1Database,
  id: string,
  learner: string,
  admin: boolean,
) {
  const a = await db
    .prepare("SELECT * FROM cms_assets WHERE id=? AND status='ready'")
    .bind(identifier(id))
    .first<Asset>();
  if (!a) throw new StudioError('素材尚未准备好。', 404);
  if (!admin) {
    const { results } = await db
      .prepare(
        `SELECT v.document FROM cms_versions v JOIN cms_courses c ON c.id=v.course_id WHERE c.archived=0 AND (c.published_version=v.id OR EXISTS(SELECT 1 FROM cms_enrollments e WHERE e.learner=? AND e.version_id=v.id))`,
      )
      .bind(learner)
      .all<{ document: string }>();
    if (
      !results.some((r) => {
        const c = JSON.parse(r.document) as StudioCourse;
        return (
          c.coverId === id || flattenSegments(c).some((s) => s.videoId === id)
        );
      })
    )
      throw new StudioError('无权访问此素材。', 403);
  }
  const result = await storage(`/object/sign/${objectPath(a)}`, 'POST', {
    expiresIn: 3600,
  });
  if (typeof result.signedURL !== 'string')
    throw new StudioError('无法读取素材。', 503);
  // CloudBase returns storage-relative paths. Never forward the service credential.
  const url = result.signedURL.startsWith('/')
    ? `${origin}${result.signedURL.startsWith('/v1/') ? '' : '/v1/storages'}${result.signedURL}`
    : result.signedURL;
  if (new URL(url).protocol !== 'https:')
    throw new StudioError('素材地址无效。', 503);
  return url;
}
