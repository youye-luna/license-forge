/**
 * 抓取 ScanCode LicenseDB 的**非 SPDX 部分**。
 *
 * LicenseDB 有 2733 条（2441 许可证 + 292 例外），其中约 1736 个许可证不在 SPDX 列表里——
 * 这些恰恰是真实代码库里会撞到、但 SPDX 查不到的东西：
 *   "Anti 996" License、ActiveState Community License、各类厂商的 Proprietary Free /
 *   Non-Commercial / Source-available 条款，以及大量 Fedora/开源项目的历史变体。
 * 对做合规审计的人，这部分比 SPDX 那 740 个更有价值。
 *
 * 接入方式：
 *  - 索引：https://scancode-licensedb.aboutcode.org/index.json（一次拿全 2733 条元数据）
 *  - 正文：索引里每条自带 `license` 字段给出纯文本 URL，按它取，而不是自己拼 key
 *    （拼 key 会踩到大小写与特殊字符的坑；索引给的才是权威 URL）
 *  - 兜底：若 `.LICENSE` 取不到，退化到 `<key>.json` 的 `text` 字段
 *
 * 重要区别（界面上必须讲清）：
 *  ScanCode 的 license key 与 SPDX 标识符是两套体系。非 SPDX 条目在 SPDX 文档里的写法是
 *  `LicenseRef-scancode-<key>`，**这个字面量不能直接写进 package.json 的 license 字段**，
 *  也不能据此声明"OSI 认证"。因此这部分条目定位为**参考与审计**，而不是可直接选用的许可。
 *
 * 产出：
 *   public/data/scancode-index.json   约 1736 条元数据（与 SPDX 快照合并后供检索）
 *   public/data/scancode-texts.json   对应正文（按 key 分键，按需加载）
 *
 * 用法：
 *   node scripts/fetch-scancode-extra.mjs
 *   node scripts/fetch-scancode-extra.mjs --refresh
 *   node scripts/fetch-scancode-extra.mjs --concurrency=12
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '..', '.spdx-cache');
const publicDir = join(here, '..', 'public', 'data');

const INDEX_URL = 'https://scancode-licensedb.aboutcode.org/index.json';
const BASE = 'https://scancode-licensedb.aboutcode.org';

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const CONCURRENCY = Number(args.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 10);
const RETRIES = 3;

async function fetchText(url, cacheKey, attempts = RETRIES) {
  const cacheFile = cacheKey ? join(cacheDir, cacheKey) : null;
  if (cacheFile && !refresh && existsSync(cacheFile)) return readFileSync(cacheFile, 'utf8');
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'license-forge-build/0.1' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // 该站 404 时返回 HTML，长度很大；用内容嗅探挡住，避免把错误页当正文
      if (/^\s*<!DOCTYPE html>/i.test(text)) return null;
      if (cacheFile) {
        mkdirSync(dirname(cacheFile), { recursive: true });
        writeFileSync(cacheFile, text, 'utf8');
      }
      return text;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw new Error(`抓取失败 ${url}：${lastError?.message ?? '未知错误'}`);
}

/** 并发池：要取上千个正文，串行不可接受 */
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
      if (onProgress && done % 100 === 0) onProgress(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

console.log('1/3 读取 ScanCode 索引与 SPDX 快照…');
const indexRaw = await fetchText(INDEX_URL, 'scancode-index.json');
const index = JSON.parse(indexRaw);
const spdx = JSON.parse(readFileSync(join(publicDir, 'license-index.json'), 'utf8'));
const spdxIds = new Set(spdx.licenses.map((l) => l.id));
const spdxKeysLower = new Set(spdx.licenses.map((l) => l.id.toLowerCase()));

/** 判断一条 ScanCode 记录是否已经在 SPDX 收录范围内 */
function isInSpdx(entry) {
  const spdxKey = entry.spdx_license_key;
  if (spdxKey && !String(spdxKey).startsWith('LicenseRef')) {
    return spdxIds.has(spdxKey) || spdxKeysLower.has(String(spdxKey).toLowerCase());
  }
  // 没有正式 SPDX 标识符时，再用 key 本身兜一层（例如 `json`、`x11`）
  return spdxKeysLower.has(entry.license_key);
}

const extras = index.filter((e) => !isInSpdx(e));
console.log(`    LicenseDB ${index.length} 条；其中非 SPDX 部分 ${extras.length} 条`);

console.log('2/3 抓取这些条目的正文与名称（并发 ' + CONCURRENCY + '）…');

/**
 * 索引里**只有 key 与 category，没有名称**，因此每条都必须拉一次详情 JSON。
 * 这一步不能省：少了它，界面上的名称字段全是 undefined（木兰族就是这么暴露出来的）。
 */
const texts = await pool(
  extras,
  CONCURRENCY,
  async (entry) => {
    // 详情 JSON：给出 short_name / name / owner / homepage，同时兜底提供 text
    let detail = null;
    const jsonRaw = await fetchText(`${BASE}/${entry.license_key}.json`, join('scancode-json', `${entry.license_key}.json`));
    if (jsonRaw) {
      try {
        detail = JSON.parse(jsonRaw);
      } catch {
        detail = null;
      }
    }

    // 正文：优先用索引给出的纯文本 URL
    const textUrl = entry.license ? `${BASE}/${entry.license}` : `${BASE}/${entry.license_key}.LICENSE`;
    let text = await fetchText(textUrl, join('scancode-texts', `${entry.license_key}.LICENSE`));
    if (!text) text = detail?.text ?? null;

    return { text, detail };
  },
  (done, total) => console.log(`    详情与正文 ${done}/${total}`),
);

console.log('3/3 写出…');

const scancodeIndex = {
  generatedFrom: INDEX_URL,
  license: 'CC-BY-4.0',
  note: 'ScanCode LicenseDB 中不在 SPDX 列表内的条目。license key 与 SPDX 标识符是两套体系。',
  entries: extras.map((e, i) => {
    const detail = texts[i]?.detail;
    const short = detail?.short_name ?? e.license_key;
    const long = detail?.name;
    return {
      key: e.license_key,
      name: short,
      // 长名与短名不同时才带上，避免前端多显示一份重复文本
      longName: long && long !== short ? long : undefined,
      category: e.category,
      isException: Boolean(e.is_exception),
      deprecated: Boolean(e.is_deprecated),
      /** SPDX 文档里的写法；注意这是 LicenseRef，不是 SPDX 标识符 */
      spdxLicenseKey: e.spdx_license_key,
      otherSpdxKeys: e.other_spdx_license_keys?.length ? e.other_spdx_license_keys : undefined,
      /** 原始归属方，用于界面展示"这是谁家的许可证" */
      owner: detail?.owner && detail.owner !== 'Unspecified' ? detail.owner : undefined,
      homepage: detail?.homepage_url || undefined,
      textLength: texts[i]?.text?.length ?? 0,
      hasText: Boolean(texts[i]?.text),
    };
  }),
};

const scancodeTexts = {};
let missing = 0;
for (let i = 0; i < extras.length; i++) {
  const text = texts[i]?.text;
  if (!text) {
    missing++;
    continue;
  }
  scancodeTexts[extras[i].license_key] = text;
}

mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'scancode-index.json'), JSON.stringify(scancodeIndex), 'utf8');
writeFileSync(join(publicDir, 'scancode-texts.json'), JSON.stringify(scancodeTexts), 'utf8');

const byCat = {};
for (const e of scancodeIndex.entries) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
const totalChars = Object.values(scancodeTexts).reduce((n, t) => n + t.length, 0);

console.log('');
console.log(`非 SPDX 许可证：${scancodeIndex.entries.length} 条，取到正文 ${Object.keys(scancodeTexts).length} 条${missing ? `（${missing} 条取不到）` : ''}`);
console.log(`正文总量：${(totalChars / 1024).toFixed(0)} KB`);
console.log('分类分布：');
for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${c}`);
}
console.log('');
console.log('产出：');
console.log('  public/data/scancode-index.json');
console.log('  public/data/scancode-texts.json');
