import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LicenseForge · 开源许可证选择与完整产物生成器',
  description:
    '按真实条款差异做选择，一次生成 LICENSE、NOTICE、源文件 SPDX 头、README 许可段与包管理器字段。全部在浏览器本地完成，不上传任何信息。',
  keywords: [
    '开源许可证',
    'LICENSE 生成器',
    'SPDX',
    'NOTICE',
    'MIT',
    'Apache-2.0',
    'GPL-3.0-only',
    'GPL-3.0-or-later',
    'AGPL',
    '木兰宽松许可证',
    'open source license generator',
    'NOTICE file',
    'REUSE',
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
