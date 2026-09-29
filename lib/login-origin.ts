export function secureLoginUrl(value: string): string | null {
  const url = new URL(value);
  const oldHost = 'zhixu-math-314991-12-1489669739.sh.run.tcloudbase.com';
  if (url.hostname === oldHost || (url.hostname === 'zhuanxinai.com' && url.protocol === 'http:')) {
    url.protocol = 'https:';
    url.hostname = 'zhuanxinai.com';
    url.port = '';
    return url.href;
  }
  return null;
}
