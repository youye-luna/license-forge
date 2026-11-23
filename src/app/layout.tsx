import type { Metadata } from 'next';
import './globals.css';

const TITLE = 'LicenseForge · 开源许可证选择与完整产物生成器';
const DESCRIPTION =
  '按真实条款差异做选择，一次生成 LICENSE、NOTICE、源文件 SPDX 头、README 许可段与包管理器字段。全部在浏览器本地完成，不上传任何信息。';

/**
 * 部署后的站点地址。
 *
 * 分享卡片（opengraph-image）与 canonical 需要**绝对地址**，而静态导出在构建期
 * 并不知道最终域名。部署时设置 `NEXT_PUBLIC_SITE_URL=https://your.site` 即可；
 * 未设置时 Next 会退回 localhost，只影响本地预览，不影响页面本身。
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: TITLE,
  description: DESCRIPTION,
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
  openGraph: {
    type: 'website',
    siteName: 'LicenseForge',
    locale: 'zh_CN',
    alternateLocale: ['en_US'],
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
