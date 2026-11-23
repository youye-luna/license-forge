/**
 * 生成 public/data/MANIFEST.json —— 数据快照的溯源清单。
 *
 * 为什么需要它：README 说「任何人可以重跑抓取脚本核对快照」，但没有锚点——
 * 不知道每个文件是什么时候、从哪个上游抓的，也不知道手上这份有没有被改过。
 * 清单里记两样东西：
 *   1. `sha256` 与字节数：下载/克隆后可直接核对内容；
 *   2. `fetchedAt`：该文件内容**最后一次变化**的时间（哈希没变就沿用旧值，
 *      所以单独重跑部分脚本不会把其它文件的日期刷成今天）。
 *
 * 用法：`npm run data` 的最后一步自动执行，也可以单独跑 `npm run data:manifest`。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'public', 'data');
const manifestPath = join(dataDir, 'MANIFEST.json');

/** 每个文件的上游与许可条款。新增数据文件时必须在这里补一条，测试会检查。 */
const SOURCES = {
  'license-index.json': {
    upstream: [
      'https://spdx.org/licenses/',
      'https://raw.githubusercontent.com/spdx/license-list-data/main/json',
    ],
    license: 'CC0',
    note: 'SPDX License List 元数据（标识符、名称、OSI/FSF 状态、官方文件头是否存在）',
    counts: (json) => ({
      licenses: json.licenses?.length,
      exceptions: json.exceptions?.length,
      version: json.licenseListVersion,
    }),
  },
  'license-texts.json': {
    upstream: ['https://spdx.org/licenses/'],
    license: 'CC0',
    note: 'SPDX 许可证与例外正文，逐字保存',
  },
  'license-enrichment.json': {
    upstream: [
      'https://scancode-licensedb.aboutcode.org/',
      'https://www.osadl.org/Checklists',
      'https://opensource.org/api/licenses',
      'https://gitcode.com/translation/license-translation',
    ],
    license: 'CC-BY-4.0',
    note: 'ScanCode 分类/归属方、OSADL 兼容性、OSI 标签、开放原子中文译稿链接的融合结果',
  },
  'scancode-index.json': {
    upstream: ['https://scancode-licensedb.aboutcode.org/'],
    license: 'CC-BY-4.0',
    note: 'SPDX 未收录的许可证元数据',
    counts: (json) => ({ entries: json.entries?.length }),
  },
  'scancode-texts.json': {
    upstream: ['https://scancode-licensedb.aboutcode.org/'],
    license: 'CC-BY-4.0',
    note: 'ScanCode 独有许可证正文，逐字保存',
  },
  'terms.json': {
    upstream: ['https://github.com/github/choosealicense.com'],
    license: 'CC-BY-3.0',
    note: 'ChooseALicense 的条款标签（专利、商标、改动标注等）',
  },
};

const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { files: {} };
const now = new Date().toISOString();
const checkOnly = process.argv.includes('--check');
const files = {};

for (const name of (await readdir(dataDir))
  .filter((f) => f.endsWith('.json') && f !== 'MANIFEST.json')
  .sort()) {
  const source = SOURCES[name];
  if (!source) {
    console.error(`✗ ${name} 没有登记上游来源，请先在 scripts/write-manifest.mjs 的 SOURCES 里补上`);
    process.exit(1);
  }
  const bytes = readFileSync(join(dataDir, name));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const json = JSON.parse(bytes.toString('utf8'));
  files[name] = {
    bytes: bytes.length,
    sha256,
    // 内容没变就沿用上次的抓取时间，避免"重跑一次全部变成今天"
    fetchedAt: previous.files?.[name]?.sha256 === sha256 ? previous.files[name].fetchedAt : now,
    license: source.license,
    upstream: source.upstream,
    note: source.note,
    ...(source.counts ? { counts: source.counts(json) } : {}),
  };
}

const unreachable = Object.keys(SOURCES).filter((name) => !files[name]);
if (unreachable.length) {
  console.error(`✗ 这些登记过的文件实际不存在：${unreachable.join(', ')}`);
  process.exit(1);
}

if (checkOnly) {
  // CI 用：只核对清单是否和数据一致，不写文件
  const stale = Object.keys(files).filter(
    (name) =>
      previous.files?.[name]?.sha256 !== files[name].sha256 ||
      previous.files?.[name]?.bytes !== files[name].bytes,
  );
  if (stale.length) {
    console.error(`✗ MANIFEST.json 与数据不一致：${stale.join(', ')}`);
    console.error('  数据更新后请重跑 `npm run data:manifest` 并提交清单');
    process.exit(1);
  }
  console.log(`✓ MANIFEST.json 与 ${Object.keys(files).length} 个数据文件一致`);
  process.exit(0);
}

writeFileSync(manifestPath, `${JSON.stringify({ schema: 1, generatedAt: now, files }, null, 2)}\n`, 'utf8');
console.log(`✓ 已更新 public/data/MANIFEST.json（${Object.keys(files).length} 个文件）`);
