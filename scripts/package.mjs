/**
 * 打包发行版。
 *
 * 为什么要有这个脚本：`dist/` 在 .gitignore 里，所以放进去的文件（发行说明、
 * 部署文档、启动脚本）**进不了仓库**，克隆一份就没了、也就无从复现同一个包。
 * 这些源文件统一放在受跟踪的 `release/` 里，打包时从那儿取，产出落到 `dist/`。
 *
 * 用法：`npm run package`（要求先跑过 `npm run build` 产出 `out/`）
 *
 * 打包的四条硬性要求，改代码前先看这里：
 *  1. ZIP 内路径**必须用正斜杠** —— Windows 的 Compress-Archive 会写成反斜杠，
 *     而所有静态托管解析 zip 都按正斜杠，反斜杠会导致解压后路径错乱。
 *  2. 不打包 `preview.*` 之类的历史脚本（已按要求删除）。
 *  3. 不打包 `node_modules/`、`out/` 之外的任何东西。
 *  4. `启动网站.cmd` 的内容必须是**纯 ASCII** —— cmd.exe 按控制台代码页解析
 *     批处理，UTF-8 中文会被误解码，甚至影响解析。仓库里有测试守住这一点。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const project = join(here, '..');
const outDir = join(project, 'out');
const releaseDir = join(project, 'release');
const distDir = join(project, 'dist');
const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
const version = pkg.version;
const zipName = `license-forge-v${version}-static.zip`;

if (!existsSync(outDir)) {
  console.error('✗ 找不到 out/。请先运行 `npm run build`。');
  process.exit(1);
}
if (!existsSync(releaseDir)) {
  console.error('✗ 找不到 release/。里面放的是打包要用的源文件。');
  process.exit(1);
}

/** 递归收集要打进 zip 的构建产物 */
async function walk(dir, base = dir) {
  const out = [];
  for (const name of (await readdir(dir)).sort()) {
    const full = join(dir, name);
    if ((await stat(full)).isDirectory()) out.push(...(await walk(full, base)));
    else out.push(full);
  }
  return out;
}

/**
 * 用作 zip 内的 entry 名。
 *
 * 必须把 Windows 的 `\` 换成 `/`——`path.relative()` 在 Windows 上返回反斜杠路径，
 * 而所有静态托管解压 zip 都按正斜杠理解路径，写反斜杠会让解压后的目录结构错乱。
 * 这条踩过（Compress-Archive 默认就写反斜杠），打包脚本末尾有自检守住。
 */
const toEntry = (p) => relative(outDir, p).split(sep).join('/');

const files = (await walk(outDir)).map((p) => ({ path: p, entry: toEntry(p) }));
// release/ 里的文件放在 zip 根目录
for (const name of ['DEPLOY.md', 'server.mjs', '启动网站.cmd']) {
  const p = join(releaseDir, name);
  if (!existsSync(p)) {
    console.error(`✗ release/${name} 不存在`);
    process.exit(1);
  }
  files.push({ path: p, entry: name });
}

mkdirSync(distDir, { recursive: true });
const zipPath = join(distDir, zipName);

// 用系统自带的 tar/压缩能力拼 zip 太绕，直接用 PowerShell 的 ZipArchive
// ——但**必须**自己控制 entry 名为正斜杠，Compress-Archive 会写反斜杠。
const ps = `
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = '${zipPath.replace(/'/g, "''")}'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
$fs = [System.IO.File]::Open($zipPath, 'Create')
$a = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
$files = ConvertFrom-Json '${JSON.stringify(files.map((f) => ({ p: f.path, e: f.entry }))).replace(/'/g, "''")}'
foreach ($f in $files) {
  $e = $a.CreateEntry($f.e, [System.IO.Compression.CompressionLevel]::Optimal)
  $s = $e.Open()
  $bytes = [System.IO.File]::ReadAllBytes($f.p)
  $s.Write($bytes, 0, $bytes.Length)
  $s.Dispose()
}
$a.Dispose()
$fs.Dispose()
Write-Output "WROTE $zipPath"
`;
execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: ['ignore', 'pipe', 'inherit'] });

const sha = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
writeFileSync(join(distDir, 'SHA256SUMS.txt'), `${sha}  ${zipName}\n`, 'ascii');

// 自检：条目数是否符合预期，以及有没有反斜杠路径（第 1 条硬性要求）
const check = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}')
Write-Output ("COUNT=" + $z.Entries.Count)
Write-Output ("BACKSLASH=" + (($z.Entries | Where-Object { $_.FullName -like '*\\*' }).Count))
$z.Dispose()
`;
const raw = execFileSync('powershell', ['-NoProfile', '-Command', check], { encoding: 'utf8' });
const count = Number(/COUNT=(\d+)/.exec(raw)?.[1] ?? 0);
const backslash = Number(/BACKSLASH=(\d+)/.exec(raw)?.[1] ?? -1);
const expected = files.length;

if (count !== expected) {
  console.error(`✗ 条目数不符：预期 ${expected}，实际 ${count}`);
  process.exit(1);
}
if (backslash !== 0) {
  console.error(`✗ 有 ${backslash} 个条目路径用了反斜杠——必须全是正斜杠`);
  process.exit(1);
}

console.log(`✓ 已生成 dist/${zipName}`);
console.log(`  条目数 ${count}`);
console.log(`  大小 ${(statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`  SHA256 ${sha}`);
