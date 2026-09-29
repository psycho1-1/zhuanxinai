import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '砖芯ai',
  icons: { icon: '/favicon.svg' },
  description:
    '从一个知识点开始，循序学会数学。学习、练习、复习，看到自己的每一步进步。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head><script dangerouslySetInnerHTML={{__html: `if(location.hostname==='zhixu-math-314991-12-1489669739.sh.run.tcloudbase.com'||(location.hostname==='zhuanxinai.com'&&location.protocol==='http:')){location.replace('https://zhuanxinai.com'+location.pathname+location.search+location.hash);}`}} /></head>
      <body>{children}</body>
    </html>
  );
}
