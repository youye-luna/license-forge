/**
 * 抓取 ChooseALicense 的**条款标签**，作为条款布尔字段的权威覆盖层。
 *
 * 为什么需要它：本项目此前对 700+ 个长尾许可证的"专利授权 / 商标条款 / 标注改动 /
 * 网络触发 / 文件级 copyleft"这些字段全靠正则从正文猜。ChooseALicense 用一套固定词表
 * 人工标注了 47 个主流许可证，字段语义与我们的完全对应，正好把这批从"推断"升级为"权威"。
 *
 * 关键端点（实测均 200）：
 *   - 词表本体：`_data/rules.yml`（2.8KB，5 permissions + 8 conditions + 4 limitations）
 *   - 逐许可证：`_licenses/<id>.txt`（47 个，YAML front matter + 正文）
 *
 * ⚠️ 一个必须处理的语义陷阱：`patent-use` 这个词在 **permissions 与 limitations 里同名反义**——
 *   在 permissions 里表示"明确授予专利权"，在 limitations 里表示"明确**不**授予专利权"。
 *   合并时若不分 section 就会把 Apache-2.0 与 BSD-3-Clause-Clear 判成同一类。
 *
 * 产出：public/data/terms.json —— 按 SPDX 标识符分键的权威条款字段。
 *
 * 用法：
 *   node scripts/fetch-choosealicense.mjs
 *   node scripts/fetch-choosealicense.mjs --refresh
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '..', '.spdx-cache');
const publicDir = join(here, '..', 'public', 'data');

const RAW = 'https://raw.githubusercontent.com/github/choosealicense.com/gh-pages';
const refresh = process.argv.includes('--refresh');

async function fetchText(url, cacheKey, attempts = 3) {
  const cacheFile = cacheKey ? join(cacheDir, cacheKey) : null;
  if (cacheFile && !refresh && existsSync(cacheFile)) return readFileSync(cacheFile, 'utf8');
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'license-forge-build/0.1' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
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

/** 极简 YAML front matter 解析：只需要处理本项目用到的标量与字符串列表 */
function parseFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const out = {};
  let currentKey = null;
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) continue;
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem && currentKey) {
      if (!Array.isArray(out[currentKey])) out[currentKey] = [];
      out[currentKey].push(listItem[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      currentKey = kv[1];
      const value = kv[2].trim();
      out[currentKey] = value === '' ? [] : value.replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

console.log('1/3 抓取 ChooseALicense 词表与许可证清单…');
const rulesText = await fetchText(`${RAW}/_data/rules.yml`, 'cal-rules.yml');
if (!rulesText) throw new Error('无法获取 rules.yml');

const listRaw = await fetchText(
  'https://api.github.com/repos/github/choosealicense.com/contents/_licenses?ref=gh-pages',
  'cal-licenses-list.json',
);
const files = JSON.parse(listRaw)
  .filter((f) => f.name.endsWith('.txt'))
  .map((f) => f.name);
console.log(`    词表 ${rulesText.length}B；许可证文件 ${files.length} 个`);

console.log('2/3 逐個抓取并解析条款标签…');
const terms = {
  generatedFrom: {
    rules: `${RAW}/_data/rules.yml`,
    licenses: `${RAW}/_licenses/<id>.txt`,
    repo: 'https://github.com/github/choosealicense.com',
    contentLicense: 'CC-BY-3.0',
  },
  /**
   * 词表本体也一并落盘：它定义了每个标签的确切含义，
   * 界面上的标签说明直接从这里取，而不是我们另行解释。
   */
  vocabulary: {},
  licenses: {},
  coverage: { files: files.length, matched: 0, unmatched: [] },
};

// 解析词表：permissions / conditions / limitations 三段，各含 tag / label / description
let section = null;
let currentEntry = null;
for (const line of rulesText.split('\n')) {
  const sectionMatch = /^([a-z]+):\s*$/.exec(line);
  if (sectionMatch) {
    section = sectionMatch[1];
    terms.vocabulary[section] = [];
    currentEntry = null;
    continue;
  }
  const first = /^-\s+description:\s*(.*)$/.exec(line);
  if (first && section) {
    currentEntry = { tag: '', label: '', description: first[1].trim() };
    terms.vocabulary[section].push(currentEntry);
    continue;
  }
  const label = /^\s+label:\s*(.*)$/.exec(line);
  if (label && currentEntry) {
    currentEntry.label = label[1].trim();
    continue;
  }
  const tag = /^\s+tag:\s*(.*)$/.exec(line);
  if (tag && currentEntry) currentEntry.tag = tag[1].trim();
}

console.log(
  `    词表：${terms.vocabulary.permissions?.length ?? 0} permissions · ${terms.vocabulary.conditions?.length ?? 0} conditions · ${terms.vocabulary.limitations?.length ?? 0} limitations`,
);

for (const name of files) {
  const text = await fetchText(`${RAW}/_licenses/${name}`, `cal-licenses/${name}`);
  if (!text) continue;
  const fm = parseFrontMatter(text);
  if (!fm) continue;
  // 上游用的是 SPDX 标识符；个别条目写成 `GPL-3.0` 之类的旧写法，原样保留由合并层处理
  const id = fm['spdx-id'];
  if (!id) continue;

  const permissions = Array.isArray(fm.permissions) ? fm.permissions : [];
  const conditions = Array.isArray(fm.conditions) ? fm.conditions : [];
  const limitations = Array.isArray(fm.limitations) ? fm.limitations : [];

  terms.licenses[id] = {
    title: fm.title,
    nickname: fm.nickname,
    featured: fm.featured === 'true',
    hidden: fm.hidden === 'true',
    permissions,
    conditions,
    limitations,
    /*
     * 把词表翻译成本项目使用的字段。全部由这三个数组派生，不额外解释：
     *  - 专利：permissions 里的 patent-use = 明确授予；limitations 里的 patent-use = 明确不授予
     *  - 商标：limitations 里的 trademark-use = 明确不授予商标权
     *  - 标注改动：conditions 里的 document-changes
     *  - 网络触发：conditions 里的 network-use-disclose
     *  - 同许可范围：same-license（整部作品）/ same-license--file（文件级）/ same-license--library（库场景）
     */
    derived: {
      patentGrant: permissions.includes('patent-use')
        ? 'explicit'
        : limitations.includes('patent-use')
          ? 'none'
          : 'silent',
      trademarkClause: limitations.includes('trademark-use'),
      stateChanges: conditions.includes('document-changes'),
      networkTrigger: conditions.includes('network-use-disclose'),
      sameLicenseWholeWork: conditions.includes('same-license'),
      sameLicensePerFile: conditions.includes('same-license--file'),
      sameLicenseLibrary: conditions.includes('same-license--library'),
      discloseSource: conditions.includes('disclose-source'),
      includeCopyright: conditions.includes('include-copyright'),
      includeCopyrightSourceOnly: conditions.includes('include-copyright--source'),
      commercialUse: permissions.includes('commercial-use'),
      privateUse: permissions.includes('private-use'),
    },
    sourceUrl: `https://choosealicense.com/licenses/${id.toLowerCase()}/`,
  };
  terms.coverage.matched++;
}

console.log('3/3 写出…');

// 自检：拿几个已知答案的许可证验一下解析结果，避免词表合并出错
const EXPECTED = [
  ['Apache-2.0', { patentGrant: 'explicit', trademarkClause: true, stateChanges: true, networkTrigger: false }],
  ['MIT', { patentGrant: 'silent', trademarkClause: false, stateChanges: false, networkTrigger: false }],
  ['GPL-3.0', { patentGrant: 'explicit', stateChanges: true, networkTrigger: false }],
  ['AGPL-3.0', { patentGrant: 'explicit', networkTrigger: true }],
  ['MPL-2.0', { patentGrant: 'explicit', sameLicensePerFile: true, sameLicenseWholeWork: false }],
  ['BSD-3-Clause-Clear', { patentGrant: 'none' }],
];

mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'terms.json'), JSON.stringify(terms), 'utf8');

console.log('');
console.log(`标注了条款的许可证：${terms.coverage.matched} 个`);
console.log('');
console.log('=== 自检（与已知答案比对）===');
let failed = 0;
for (const [id, expect] of EXPECTED) {
  const derived = terms.licenses[id]?.derived;
  if (!derived) {
    console.log(`  ${id.padEnd(20)} ⚠ 不在 ChooseALicense 覆盖范围内`);
    continue;
  }
  const bad = Object.entries(expect).filter(([k, v]) => derived[k] !== v);
  if (bad.length) {
    failed++;
    console.log(`  ${id.padEnd(20)} ✗ ${bad.map(([k, v]) => `${k}=${derived[k]}(期望 ${v})`).join(', ')}`);
  } else {
    console.log(`  ${id.padEnd(20)} ✓`);
  }
}
if (failed) {
  console.log(`\n⚠ ${failed} 个自检失败——词表解析可能出错，请先修好再使用`);
  process.exitCode = 1;
}
console.log('');
console.log('产出：public/data/terms.json');
