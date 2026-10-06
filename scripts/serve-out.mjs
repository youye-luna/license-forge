/**
 * 极简静态文件服务器，用于本地验证静态导出产物（out/）。
 *
 * 用途仅限于开发期自检：`node scripts/serve-out.mjs [port]`
 * 生产部署不需要它——out/ 目录可直接交给任意静态托管。
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.cwd(), 'out');
const port = Number(process.argv[2] ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  // 阻止路径穿越：规范化后必须仍在 out/ 之内
  const candidate = normalize(join(root, clean));
  if (!candidate.startsWith(root)) return null;

  const attempts = [candidate, join(candidate, 'index.html'), `${candidate}.html`];
  for (const attempt of attempts) {
    try {
      const info = await stat(attempt);
      if (info.isFile()) return attempt;
    } catch {
      // 继续尝试下一个候选路径
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? '/');
  if (!file) {
    const notFound = join(root, '404.html');
    try {
      const body = await readFile(notFound);
      res.writeHead(404, { 'content-type': MIME['.html'] });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404');
    }
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(body);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`静态产物已就绪：http://127.0.0.1:${port}/`);
});
