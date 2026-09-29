export async function timedFetch(url: string, init: RequestInit = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {credentials: 'same-origin', cache: 'no-store', ...init, signal: controller.signal});
    // Read the body before clearing the timer, so stalled responses also time out.
    const text = await response.text();
    return {ok: response.ok, status: response.status, text};
  } catch (error) {
    if (controller.signal.aborted) throw new Error('连接超时，请重试；也可以用手机浏览器打开。');
    throw error;
  } finally { clearTimeout(timer); }
}
