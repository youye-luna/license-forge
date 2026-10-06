import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 纯静态导出：产物可直接部署到任意静态托管（GitHub Pages / Cloudflare Pages / OSS / Nginx），
  // 也正是本站的核心承诺——所有许可证文本与生成逻辑都在浏览器里跑，用户填的版权信息不上传。
  output: 'export',
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
