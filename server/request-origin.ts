export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  if (process.env.ZHIXU_PUBLIC_ORIGIN) return origin === process.env.ZHIXU_PUBLIC_ORIGIN;

  const candidates = new Set<string>([new URL(request.url).origin]);
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0].trim() ??
    request.headers.get('host');
  if (host) {
    const forwardedProto = request.headers
      .get('x-forwarded-proto')
      ?.split(',')[0]
      .trim();
    for (const protocol of [forwardedProto, 'https', 'http']) {
      if (protocol) candidates.add(`${protocol}://${host}`);
    }
  }
  return candidates.has(origin);
}
