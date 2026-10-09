/**
 * 零依赖的静态文件服务器。
 *
 * 随发行版 zip 一起分发：zip 里只有 `out/` 的产物与本文件，
 * 不带整个项目的 `scripts/`，所以启动脚本必须自己带一个能跑的服务器。
 *
 * 为什么不用 `npx serve` / `python -m http.server` 作为唯一方案：
 *  - `npx serve` 要联网装包，离线或公司网络下会卡住；
 *  - Python 不一定装了；
 *  - 两者都不管**子路径**：本站的资源是绝对路径（`/_next/…`、`/data/…`），
 *    必须挂在根路径上，而 `python -m http.server` 在当前目录启动时恰好符合，
 *    但用户可能在别处启动——这里显式以脚本所在目录为根，避免歧义。
 *
 * 用法：`node server.mjs [端口]`（默认 8080，被占用时自动+1）
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * 就绪后打开浏览器。
 *
 * 必须由**服务器自己**打开，而不是由 `.cmd` 打开：端口可能自增
 * （8080 被占用时会挪到 8081…），启动脚本如果预先写死端口，
 * 打开的就是没在服务的那个地址。
 *
 * 只在交互式会话里打开——被 CI 或无头环境调用时不该弹窗口。
 */
function openBrowser(url) {
  if (!process.stdout.isTTY && !process.env.LF_OPEN_BROWSER) return;
  const cmd =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // 打不开就算了，日志里已打印地址
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/**
 * 把请求路径安全地解析成磁盘上的绝对路径。
 *
 * 必须做两件事，缺一不可：
 *  1. 取掉 `..` 之类的穿越片段——否则 `/../..//Windows/System32/config` 能读到根外的文件；
 *  2. 解析后确认仍在 `root` 之内——仅靠 decodeURIComponent 去掉 `..` 不够，
 *     URL 编码过的 `%2e%2e` 会在解码后重新变成 `..`。
 */
function safePath(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (p.includes('\0')) return null;
  const abs = resolve(join(root, p));
  if (abs !== root && !abs.startsWith(root + sep)) return null;
  return abs;
}

async function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const target = safePath(req.url || '/');
  if (!target) return send(res, 400, 'Bad request');

  let file = target;
  try {
    const info = await stat(file);
    // 目录 → 该目录的 index.html（`/` 这样就落到 `index.html`）
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    // 看上去是"页面路由"（没有扩展名）时，交给 404.html 处理
    file = '';
  }

  try {
    const body = await readFile(file);
    return send(res, 200, body, MIME[extname(file).toLowerCase()] || 'application/octet-stream');
  } catch {
    // 站点自带 404 页（相对路径，避免再引一遍绝对路径）
    try {
      const page = await readFile(join(root, '404.html'));
      return send(res, 404, page, 'text/html; charset=utf-8');
    } catch {
      return send(res, 404, 'Not found');
    }
  }
});

/**
 * 从起始端口往上找一个能用的。
 * 端口被占用是常见的：上一次的实例还没退出，或本机上别的服务占着。
 */
async function listen(port, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    const candidate = port + i;
    const ok = await new Promise((done) => {
      const probe = createServer();
      probe.once('error', () => done(false));
      probe.listen(candidate, '127.0.0.1', () => probe.close(() => done(true)));
    });
    if (ok) {
      server.listen(candidate, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${candidate}/`;
        console.log(`READY ${url}`);
        openBrowser(url);
      });
      return;
    }
  }
  console.error(`NO_PORT 端口 ${port} 起 ${attempts} 个都被占用`);
  process.exit(1);
}

const start = Number(process.argv[2]) || 8080;
await listen(start);
