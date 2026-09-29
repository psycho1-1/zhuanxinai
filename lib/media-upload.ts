export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Stay comfortably below CloudBase Run's 20 MB request limit.
export const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;
export const MEDIA_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function mediaInputError(name: unknown, mime: unknown, bytes: unknown) {
  if (typeof name !== 'string' || !name.trim() || name.length > 180)
    return '文件名不能为空，且不能超过 180 个字符。';
  if (typeof mime !== 'string' || !Object.hasOwn(MEDIA_TYPES, mime))
    return '支持 MP4/WebM 视频和 PNG/JPG/WebP 图片。';
  if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes < 1)
    return '文件为空或大小无效。';
  if (bytes > (mime.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES))
    return mime.startsWith('video/')
      ? '当前单个视频最多 100 MiB，请选择压缩副本或拆分视频后上传。'
      : '单张图片最多 8 MiB，请缩小后上传。';
  return '';
}

export function uploadFailure(status: number, code?: string) {
  if (status === 413 || code === 'STORAGE_FILE_SIZE_LIMIT_EXCEEDED')
    return '文件超过存储接口限制。视频最多 100 MiB，图片最多 8 MiB。';
  if (status === 401) return '登录已过期，请重新登录后上传。';
  if (status === 403) return '没有上传权限，请使用管理员账号登录。';
  if (status === 408 || status === 504 || code === 'STORAGE_ABORTED')
    return '上传连接超时，文件尚未确认保存。请检查网络后重试。';
  return `素材存储暂时未能完成上传（HTTP ${status}），请稍后重试。`;
}
