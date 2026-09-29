import { timedFetch } from './timed-fetch.ts';

export class StudioRequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function studioRequest<T = any>(
  url: string,
  body?: unknown,
): Promise<T> {
  const r = await timedFetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  }, 60000);
  let data: any;
  try {
    data = JSON.parse(r.text);
  } catch {
    throw new Error('服务暂时未响应，请稍后重试。');
  }
  if (!r.ok) throw new StudioRequestError(data?.error || '操作失败，请重试。', r.status);
  return data;
}
export function exportJSON(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
