import type { NextConfig } from 'next';
import { BASE_PATH } from './src/lib/base.ts';

const nextConfig: NextConfig = {
  // 纯静态导出：产物可直接部署到任意静态托管（GitHub Pages / Cloudflare Pages / OSS / Nginx），
  // 也正是本站的核心承诺——所有许可证文本与生成逻辑都在浏览器里跑，用户填的版权信息不上传。
  output: 'export',
  // 子路径部署时与数据加载共用同一个来源（src/lib/base.ts），避免页面与数据各走一套路径
  basePath: BASE_PATH || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // 显式声明工程根目录：本仓库路径含非 ASCII 目录名，且 node_modules 由 pnpm 以符号链接组织，
  // 让打包器直接以本目录为根可以避免它向上层目录探测 workspace。
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
