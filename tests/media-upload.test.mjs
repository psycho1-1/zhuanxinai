import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaInputError, MAX_VIDEO_BYTES, UPLOAD_CHUNK_BYTES } from '../lib/media-upload.ts';
import { beginUpload, uploadAsset, completeUpload } from '../server/studio/media.ts';

function fixture() {
  const row = { id: 'asset-test', name: 'lesson.mp4', mime: 'video/mp4', bytes: 4, object_path: 'courses/asset-test.mp4', created_by: 'admin', status: 'pending' };
  return { row, db: { prepare(sql) { return { bind() { return this; }, async first() { return row; }, async run() { if (sql.startsWith('UPDATE')) row.status = 'ready'; return {}; } }; } } };
}
function input(bytes = new Uint8Array([1,2,3,4])) {
  return new Request('https://test/api/studio/assets?id=asset-test', { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: bytes });
}
test('video size limit matches the storage limit before upload starts', async () => {
  assert.equal(mediaInputError('lesson.mp4','video/mp4', MAX_VIDEO_BYTES), '');
  assert.match(mediaInputError('lesson.mp4','video/mp4',MAX_VIDEO_BYTES + 1), /100 MiB/);
  await assert.rejects(beginUpload(null, 'admin', { name:'lesson.mp4', mime:'video/mp4', bytes:MAX_VIDEO_BYTES+1 }), /100 MiB/);
});
test('proxy rejects another owner, wrong type, oversized and truncated bodies', async () => {
  const {db} = fixture();
  await assert.rejects(uploadAsset(db,'student','asset-test',input()), /无权/);
  const wrong=input(); wrong.headers.set('Content-Type','text/html');
  await assert.rejects(uploadAsset(db,'admin','asset-test',wrong), /类型/);
  await assert.rejects(uploadAsset(db,'admin','asset-test',input(new Uint8Array(5))), /大小/);
  await assert.rejects(uploadAsset(db,'admin','asset-test',input(new Uint8Array(3))), /完整/);
});
test('only verified storage contents are marked ready; no credential sent to client', async t => {
  const {db,row}=fixture();
  const original=globalThis.fetch, oldKey=process.env.CLOUDBASE_SERVER_KEY;
  process.env.CLOUDBASE_SERVER_KEY='test-private-key';
  t.after(()=>{globalThis.fetch=original; if(oldKey===undefined)delete process.env.CLOUDBASE_SERVER_KEY;else process.env.CLOUDBASE_SERVER_KEY=oldKey;});
  let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;
    assert.equal(options.headers.Authorization,'Bearer test-private-key');
    if(calls===1){assert.equal(options.method,'POST');assert.match(url,/-parts\/0.mp4$/);assert.equal(options.body.byteLength,4);return Response.json({});}
    if(url.includes('/object/authenticated/')) return new Response(new Uint8Array([1,2,3,4]));
    if(options.method==='POST'||options.method==='DELETE')return Response.json({});
    return Response.json({metadata:{size:4,mimetype:'video/mp4'}});
  };
  assert.deepEqual(await uploadAsset(db,'admin','asset-test',input()),{ok:true,part:0});
  assert.equal(row.status,'pending');
  assert.deepEqual(await completeUpload(db,'admin','asset-test'),{ok:true});
  assert.equal(row.status,'ready');
  assert.equal(calls,5);
});
test('storage failure leaves asset pending with actionable error', async t=>{
  const {db,row}=fixture();
  const original=globalThis.fetch, oldKey=process.env.CLOUDBASE_SERVER_KEY;
  process.env.CLOUDBASE_SERVER_KEY='test-private-key';
  t.after(()=>{globalThis.fetch=original;if(oldKey===undefined)delete process.env.CLOUDBASE_SERVER_KEY;else process.env.CLOUDBASE_SERVER_KEY=oldKey;});
  globalThis.fetch=async()=>Response.json({code:'STORAGE_ABORTED'},{status:400});
  await assert.rejects(uploadAsset(db,'admin','asset-test',input()),/连接超时/);
  assert.equal(row.status,'pending');
});

test('multipart assembly preserves byte order and blocks missing parts', async t=>{
  const {db,row}=fixture(); row.bytes=UPLOAD_CHUNK_BYTES+3;
  const original=globalThis.fetch, oldKey=process.env.CLOUDBASE_SERVER_KEY;
  process.env.CLOUDBASE_SERVER_KEY='test-private-key';
  t.after(()=>{globalThis.fetch=original;if(oldKey===undefined)delete process.env.CLOUDBASE_SERVER_KEY;else process.env.CLOUDBASE_SERVER_KEY=oldKey;});
  let missing=true, finalWrites=0;
  globalThis.fetch=async(url,options)=>{
    if(url.includes('/object/authenticated/')){
      if(url.endsWith('/0.mp4'))return new Response(new Uint8Array(UPLOAD_CHUNK_BYTES).fill(7));
      return missing?new Response('',{status:404}):new Response(new Uint8Array([8,9,10]));
    }
    if(options.method==='POST'){
      finalWrites++;assert.equal(options.body.length,row.bytes);
      assert.equal(options.body[UPLOAD_CHUNK_BYTES-1],7);
      assert.deepEqual([...options.body.subarray(-3)],[8,9,10]);return Response.json({});
    }
    if(options.method==='DELETE')return Response.json({});
    return Response.json({metadata:{size:row.bytes,mimetype:row.mime}});
  };
  await assert.rejects(completeUpload(db,'admin',row.id),/分块尚未上传成功/);
  assert.equal(row.status,'pending');assert.equal(finalWrites,0);
  missing=false;await completeUpload(db,'admin',row.id);
  assert.equal(row.status,'ready');assert.equal(finalWrites,1);
});
