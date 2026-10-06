/**
 * 通过 SPDX 官方 License List API 抓取**全量**许可证与例外，生成站点的本地快照。
 *
 * API 端点（官方，无需 key）：
 *   - 索引：https://raw.githubusercontent.com/spdx/license-list-data/main/json/licenses.json
 *   - 例外：https://raw.githubusercontent.com/spdx/license-list-data/main/json/exceptions.json
 *   - 详情：https://spdx.org/licenses/<SPDX-ID>.json
 *     （GitHub 镜像的 json/details/ 只覆盖许可证，例外的详情只在 spdx.org 上，所以两类分开取）
 *
 * 为什么在构建期抓取、而不是运行时直连 API：
 *   本站是纯静态站点，运行时直连会引入跨域失败、限流与离线不可用三类问题，
 *   也与"隐私优先、数据不出浏览器"的定位冲突。构建期取一份快照，运行时只读本地文件。
 *   SPDX 自身也把 GitHub 仓库定义为可分发的数据副本，正是鼓励这种用法。
 *   解析逻辑单独放在 src/lib/spdx.ts 的 fromSpdxLicenseList / fromSpdxExceptionList /
 *   fromSpdxDetail 里，所以任何拿到实时 API 响应的人都能复用同一套解析。
 *
 * 产出：
 *   public/data/license-index.json   全量元数据（首屏加载，用于搜索与筛选）
 *   public/data/license-texts.json   全量正文，按 ID 分键（按需加载单个许可证）
 *
 * 用法：
 *   node scripts/fetch-spdx.mjs            使用缓存，缺失的才联网
 *   node scripts/fetch-spdx.mjs --refresh  忽略缓存，全部重新抓取
 *   node scripts/fetch-spdx.mjs --concurrency=12
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '..', '.spdx-cache');
const publicDir = join(here, '..', 'public', 'data');

const GITHUB_JSON = 'https://raw.githubusercontent.com/spdx/license-list-data/main/json';
/**
 * 详情端点有两条路径，且返回的字段名不同（这是实测出来的，不是文档写明的）：
 *   - 许可证：json/details/<ID>.json  → licenseText / standardLicenseHeader
 *   - 例外：  json/exceptions/<ID>.json → licenseExceptionText / licenseExceptionTemplate
 * 例外没有详情版 standardLicenseHeader，因此例外的文件头由本站按 SPDX 语法组装
 * （`SPDX-License-Identifier: <ID> WITH <exception>`），而不是伪造声明措辞。
 */
const SPDX_DETAIL = 'https://spdx.org/licenses';
const GH_DETAIL = `${GITHUB_JSON}/details`;
const GH_EXCEPTION = `${GITHUB_JSON}/exceptions`;

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? Number(concurrencyArg.split('=')[1]) : 8;
const RETRIES = 3;

/* ------------------------------------------------------------------ *
 * 带缓存与重试的抓取
 * ------------------------------------------------------------------ */

async function fetchText(url, { cacheKey, attempts = RETRIES } = {}) {
  const cacheFile = cacheKey ? join(cacheDir, cacheKey) : null;
  if (cacheFile && !refresh && existsSync(cacheFile)) {
    return readFileSync(cacheFile, 'utf8');
  }
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'license-forge-build/0.1' } });
      if (res.status === 404) return null; // 明确的"不存在"，不重试
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (cacheFile) {
        mkdirSync(dirname(cacheFile), { recursive: true });
        writeFileSync(cacheFile, text, 'utf8');
      }
      return text;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw new Error(`抓取失败 ${url}：${lastError?.message ?? '未知错误'}`);
}

/** 并发池：SPDX 详情端点有数百个，串行会非常慢 */
async function pool(items, limit, worker, onProgress) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
      done++;
      if (onProgress && done % 50 === 0) onProgress(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

console.log('1/3 抓取 SPDX License List 索引…');
const licenseIndexRaw = await fetchText(`${GITHUB_JSON}/licenses.json`, { cacheKey: 'licenses.json' });
const exceptionIndexRaw = await fetchText(`${GITHUB_JSON}/exceptions.json`, { cacheKey: 'exceptions.json' });

const licenseIndex = JSON.parse(licenseIndexRaw);
const exceptionIndex = JSON.parse(exceptionIndexRaw);

console.log(
  `    许可证 ${licenseIndex.licenses.length} 个（废弃 ${licenseIndex.licenses.filter((l) => l.isDeprecatedLicenseId).length}），` +
    `例外 ${exceptionIndex.exceptions.length} 个，列表版本 ${licenseIndex.licenseListVersion}`,
);

console.log('2/3 抓取每个许可证与例外的详情（含正文与官方文件头）…');
const licenseIds = licenseIndex.licenses.map((l) => l.licenseId);
const exceptionIds = exceptionIndex.exceptions.map((e) => e.licenseExceptionId);

const detailCacheName = (kind, id) => join(kind, `${id}.json`);

const licenseDetails = await pool(
  licenseIds,
  CONCURRENCY,
  async (id) => {
    const raw = await fetchText(`${GH_DETAIL}/${encodeURIComponent(id)}.json`, {
      cacheKey: detailCacheName('licenses', id),
      attempts: 4,
    });
    return raw ? JSON.parse(raw) : null;
  },
  (done, total) => console.log(`    许可证详情 ${done}/${total}`),
);

const exceptionDetails = await pool(
  exceptionIds,
  CONCURRENCY,
  async (id) => {
    const raw = await fetchText(`${GH_EXCEPTION}/${encodeURIComponent(id)}.json`, {
      cacheKey: detailCacheName('exceptions', id),
      attempts: 4,
    });
    return raw ? JSON.parse(raw) : null;
  },
  (done, total) => console.log(`    例外详情 ${done}/${total}`),
);

console.log('3/3 生成站点数据文件…');

/* ---- 索引：保持精简，首屏要加载它 ---- */
const index = {
  licenseListVersion: licenseIndex.licenseListVersion,
  generatedFrom: 'https://github.com/spdx/license-list-data (json API)',
  licenses: licenseIndex.licenses.map((l, i) => {
    const detail = licenseDetails[i];
    return {
      id: l.licenseId,
      name: l.name,
      deprecated: Boolean(l.isDeprecatedLicenseId),
      osiApproved: Boolean(l.isOsiApproved),
      fsfLibre: Boolean(l.isFsfLibre),
      // 详情端点已经拿到，直接用；万一失败就退化为 null，界面上标注"未知"
      hasText: Boolean(detail?.licenseText),
      textLength: detail?.licenseText?.length ?? 0,
      hasOfficialHeader: Boolean(detail?.standardLicenseHeader?.trim()),
      seeAlso: l.seeAlso ?? [],
    };
  }),
  exceptions: exceptionIndex.exceptions.map((e, i) => {
    const detail = exceptionDetails[i];
    const text = detail?.licenseExceptionText ?? '';
    return {
      id: e.licenseExceptionId,
      name: e.name,
      deprecated: Boolean(e.isDeprecatedLicenseId),
      hasText: Boolean(text),
      textLength: text.length,
      seeAlso: e.seeAlso ?? [],
    };
  }),
};

/* ---- 正文：按 ID 分键，运行时可只请求需要的部分 ---- */
const texts = {};
let missingText = 0;
for (let i = 0; i < licenseIds.length; i++) {
  const detail = licenseDetails[i];
  if (!detail?.licenseText) {
    missingText++;
    continue;
  }
  texts[licenseIds[i]] = {
    name: detail.name,
    url: `https://spdx.org/licenses/${encodeURIComponent(licenseIds[i])}.html`,
    osiApproved: Boolean(detail.isOsiApproved),
    deprecated: Boolean(detail.isDeprecatedLicenseId),
    licenseText: detail.licenseText,
    // SPDX 规范里由许可证自身给出的文件头模板；为空表示该许可证没有官方模板
    standardLicenseHeader: detail.standardLicenseHeader?.trim() || undefined,
  };
}
const exceptionTexts = {};
let missingExceptionText = 0;
for (let i = 0; i < exceptionIds.length; i++) {
  const detail = exceptionDetails[i];
  const text = detail?.licenseExceptionText;
  if (!text) {
    missingExceptionText++;
    continue;
  }
  exceptionTexts[exceptionIds[i]] = {
    name: detail.name,
    url: `https://spdx.org/licenses/${encodeURIComponent(exceptionIds[i])}.html`,
    licenseText: text,
    // 例外在 SPDX 数据里没有 standardLicenseHeader，出处见文件顶部说明
  };
}

mkdirSync(publicDir, { recursive: true });
// 不格式化输出：这些文件是机器读的，压掉空白能显著减小体积
writeFileSync(join(publicDir, 'license-index.json'), JSON.stringify(index), 'utf8');
writeFileSync(
  join(publicDir, 'license-texts.json'),
  JSON.stringify({ licenses: texts, exceptions: exceptionTexts }),
  'utf8',
);

/* ---- 自检 ---- */
const withHeader = Object.values(texts).filter((t) => t.standardLicenseHeader).length;
const totalChars = Object.values(texts).reduce((n, t) => n + t.licenseText.length, 0);
const exceptionChars = Object.values(exceptionTexts).reduce((n, t) => n + t.licenseText.length, 0);
console.log('');
console.log(`许可证索引：${index.licenses.length} 条（含正文 ${index.licenses.filter((l) => l.hasText).length}）`);
console.log(`例外索引：${index.exceptions.length} 条（含正文 ${index.exceptions.filter((e) => e.hasText).length}）`);
console.log(`官方文件头模板：${withHeader} 个许可证自带`);
console.log(`正文总字符：许可证 ${(totalChars / 1024).toFixed(0)} KB + 例外 ${(exceptionChars / 1024).toFixed(0)} KB`);
if (missingText) console.log(`注意：${missingText} 个许可证没有取到正文`);
if (missingExceptionText) console.log(`注意：${missingExceptionText} 个例外没有取到正文`);
console.log('');
console.log('产出：');
console.log('  public/data/license-index.json');
console.log('  public/data/license-texts.json');
