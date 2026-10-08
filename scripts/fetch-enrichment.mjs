/**
 * 多源数据融合：在 SPDX 快照之上补齐第三方提供的结构化元数据。
 *
 * 已接入的来源（均实测可用）：
 *
 *  1. **ScanCode LicenseDB**（aboutcode.org，CC-BY-4.0）——提供权威的 `category` 分类。
 *     这是本项目最需要的字段：此前 740 个许可证里只有 32 个人工判定家族，
 *     其余靠正则从正文推断。接入后覆盖率 726/740 = 98.1%。
 *     索引端点：https://scancode-licensedb.aboutcode.org/index.json（约 1MB，一次拿全 2733 条）
 *     它的 `standard_notice` 字段在实测中恒为 null，因此**不**作为文件头来源。
 *
 *  2. **OSI 官方 API**（opensource.org/api/licenses）——提供审批日期与 `keywords`。
 *     注意它的覆盖**不完整**：只有 126 条，连 AGPL/GPL 系列都不在里面，
 *     而 SPDX 标为 OSI-approved 的有 154 个。因此 **OSI 状态一律以 SPDX 为准**，
 *     该 API 只用于补充它独有的 `keywords`（superseded / redundant-with-more-popular /
 *     non-reusable 等），这些恰好是"提示用户别选这个"的有用信号。
 *
 *  3. **OSADL Open Source License Obligations Checklist**（osadl.org，CC-BY-4.0）
 *     提供**兼容性矩阵**：matrix.json 是 {许可证A: {许可证B: 判定}} 的二维表，
 *     覆盖 119 个许可证、约 1.4 万条判定（Yes / No / Same / Unknown / Check dependency）。
 *     另取 copyleft.json 与 sourcedisclosure.json 两张义务表。
 *     这是本次找到的唯一可下载、机器可读、许可宽松的兼容性数据集——
 *     欧盟 JLA 的兼容性检查器是纯前端渲染，无 API、无导出。
 *     注意：矩阵是欧盟/德国法律实务视角的合规指引，文件自带免责声明，不构成法律意见。
 *
 *  4. **开放原子《源译识》审定稿**（GitCode API，译文以 CC0 贡献）
 *     10 个许可证有经评审的中英对照审定稿。这里只记录**链接**，不抓取正文：
 *     译本的法律效力需要读者自己判断，把链接给到官方仓库比内嵌副本更负责。
 *
 * 产出：public/data/license-enrichment.json
 *   按 SPDX 标识符分键，只含第三方补充字段。与 SPDX 快照分离存放，
 *   这样任一方更新都能独立重跑，也便于核对"哪个字段来自哪一家"。
 *
 * 用法：
 *   node scripts/fetch-enrichment.mjs
 *   node scripts/fetch-enrichment.mjs --refresh
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '..', '.spdx-cache');
const publicDir = join(here, '..', 'public', 'data');

const SCANCODE_INDEX = 'https://scancode-licensedb.aboutcode.org/index.json';
const OSI_API = 'https://opensource.org/api/licenses';
const OSADL = 'https://www.osadl.org/fileadmin/checklists';
const GITCODE_CONTENTS = 'https://api.gitcode.com/api/v5/repos/translation/license-translation/contents';
const GITCODE_BLOB = 'https://raw.gitcode.com/translation/license-translation/blobs';
/** 审定稿所在目录（GitCode 的 URL 里需要转义） */
const ZH_FINAL_DIR = '译文评审&审定稿 Review&Final texts';

/**
 * 开源原子《源译识》审定稿文件名 → SPDX 标识符。
 *
 * 仓库里的文件名是给人看的（还带拼写错误，例如 "BDS-3-clause"），
 * 因此在构建期做一次显式映射，而不是靠字符串猜。映射不全时脚本会报告出来。
 */
const ZH_TRANSLATION_FILES = {
  'MIT with Chinese Translation.md': 'MIT',
  'Apache-2.0 with Chinese Translation.md': 'Apache-2.0',
  'BDS-3-clause with Chinese Translation.md': 'BSD-3-Clause',
  'EPLv2 with Chinese Translation.md': 'EPL-2.0',
  'GPL-2.0 with Chinese Translation.md': 'GPL-2.0-only',
  'GPL-3.0 with Chinese Translation.md': 'GPL-3.0-only',
  'LGPL-2.1 with Chinese Translation.md': 'LGPL-2.1-only',
  'LGPL-3.0 with Chinese Translation.md': 'LGPL-3.0-only',
  'AGPL-3.0 with Chinese Translation.md': 'AGPL-3.0-only',
  'MPL-2.0 with Chinese Translation.md': 'MPL-2.0',
};

/** 官方/权威中文文本的其他来源（这些许可证自带中文正文，可继续分发） */
const OFFICIAL_CHINESE_TEXT = {
  'MulanPSL-1.0': {
    url: 'https://spdx.org/licenses/MulanPSL-1.0.html',
    note: {
      zh: '木兰宽松许可证第 1 版正文为中英双语。第 2 版还写了"以中文版为准"，第 1 版同样适用该系列的中文效力约定。',
      en: 'MulanPSL v1 ships a bilingual Chinese-English text, like v2 of the same family.',
    },
  },
  'MulanPSL-2.0': {
    url: 'https://spdx.org/licenses/MulanPSL-2.0.html',
    note: {
      zh: '木兰宽松许可证第 2 版正文为中英双语，且其第 6 条明确"以中文版为准"。这是少数中文具有优先效力的许可证。',
      en: 'MulanPSL-2.0 ships a bilingual Chinese-English text whose section 6 states the Chinese version prevails — one of very few licenses where Chinese is authoritative.',
    },
  },
  'CC-BY-4.0': {
    url: 'https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans',
    note: {
      zh: 'Creative Commons 官方简体中文译本。CC 官方说明这是英文版的"语言翻译"，引用任一官方译本均可履行署名条件。',
      en: 'The official Creative Commons Simplified Chinese translation. CC describes it as a linguistic translation of the English text; citing any official translation satisfies the attribution condition.',
    },
  },
  'CC-BY-SA-4.0': {
    url: 'https://creativecommons.org/licenses/by-sa/4.0/legalcode.zh-hans',
    note: {
      zh: 'Creative Commons 官方简体中文译本（语言翻译，非本地化版本）。',
      en: 'The official Creative Commons Simplified Chinese translation (a linguistic translation, not a ported version).',
    },
  },
  'CC0-1.0': {
    url: 'https://creativecommons.org/publicdomain/zero/1.0/legalcode.zh-Hans',
    note: { zh: 'Creative Commons 官方简体中文译本。', en: 'The official Creative Commons Simplified Chinese translation.' },
  },
  'EUPL-1.2': {
    url: 'https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12',
    note: {
      zh: '欧盟 EUPL-1.2 提供 23 种欧盟官方语言的同等效力正式文本——但**不含中文**。这里给出官方文本入口。',
      en: 'EUPL-1.2 has equally authentic texts in 23 EU official languages — but not Chinese. This links to the official texts.',
    },
  },
};

/**
 * 同样的"官方中文文本入口"，但对象是 **ScanCode 独有的条目**（不在 SPDX 名录里）。
 *
 * 单独一张表是因为键空间不同：`OFFICIAL_CHINESE_TEXT` 按 SPDX 标识符分键，
 * 写进 `licenses[id].chinese`；这里按 ScanCode 的键分键，写进
 * `chinese[key]`（那个顶层字段本来就是为此预留的）。混在一张表里迟早会有人
 * 把 ScanCode 的键写进 SPDX 那张，然后困惑为什么界面上不显示。
 *
 * 木兰公共许可证就是典型：SPDX 名录里**根本没有它**，所以只能从 ScanCode 拿到，
 * 而 ScanCode 那份是**纯英文**副本。官方正文其实是中英双语（与木兰宽松一样
 * 以中文版为准），因此这里给出官方地址，并在说明里如实讲清站内文本的来源。
 */
const SCANCODE_CHINESE = {
  'mulanpubl-2.0': {
    url: 'http://license.coscl.org.cn/MulanPubL-2.0',
    note: {
      zh: '木兰公共许可证第 2 版的官方正文是**中英双语**，且与木兰宽松一样以中文版为准。但站内文本取自 ScanCode 的纯英文副本，构建期取不到官方双语正文（官方站点当时不可用），因此这里给出官方地址。',
      en: 'The official Mulan PubL v2 text is bilingual Chinese-English and, as with MulanPSL, the Chinese version prevails. The text shown here comes from ScanCode’s English-only copy — the official bilingual text could not be fetched at build time (the official site was unavailable), so this links to it.',
    },
  },
  'mulanpubl-1.0': {
    url: 'http://license.coscl.org.cn/MulanPubL-1.0',
    note: {
      zh: '同第 2 版：官方正文为中英双语，此处给出官方地址；站内文本来自 ScanCode 的纯英文副本。',
      en: 'As with v2: the official text is bilingual Chinese-English, linked here; the text shown comes from ScanCode’s English-only copy.',
    },
  },
};

const refresh = process.argv.includes('--refresh');

async function fetchText(url, cacheKey, attempts = 3) {
  const cacheFile = cacheKey ? join(cacheDir, cacheKey) : null;
  if (cacheFile && !refresh && existsSync(cacheFile)) return readFileSync(cacheFile, 'utf8');
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'license-forge-build/0.1' } });
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

/* ------------------------------------------------------------------ *
 * ScanCode 分类 → 本站家族
 *
 * ScanCode 的 category 是它自己为 SCA 与策略实现设计的粗分类，
 * 官方明确说明"不具备法律精确性"。因此这里只做**单向映射**：
 * 分类只用来确定家族（宽松 / 弱著佐权 / 强著佐权 / 公共领域 / 内容 / 非开源），
 * 条款布尔字段仍由正文推断或人工整理承担。
 * ------------------------------------------------------------------ */

const SCANCODE_FAMILY = {
  Permissive: 'permissive',
  'Copyleft Limited': 'weak-copyleft',
  Copyleft: 'strong-copyleft',
  'Public Domain': 'public-domain',
  'Free Restricted': 'permissive',
  'Source-available': 'source-available',
  'Proprietary Free': 'proprietary',
  Commercial: 'proprietary',
  'Non-Commercial': 'proprietary',
  'Unstated License': 'unknown',
  'Patent License': 'unknown',
  CLA: 'unknown',
};

/** ScanCode 判定为"非开源"的分类——生成时必须给出明确警告 */
const NON_OPEN_CATEGORIES = new Set([
  'Proprietary Free',
  'Commercial',
  'Non-Commercial',
  'Source-available',
  'Unstated License',
]);

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

console.log('1/3 读取 SPDX 快照…');
const spdxFile = join(publicDir, 'license-index.json');
if (!existsSync(spdxFile)) {
  console.error('缺少 public/data/license-index.json，请先运行 npm run data');
  process.exit(1);
}
const spdx = JSON.parse(readFileSync(spdxFile, 'utf8'));
console.log(`    SPDX ${spdx.licenseListVersion}：${spdx.licenses.length} 个许可证 + ${spdx.exceptions.length} 个例外`);

console.log('2/4 抓取 ScanCode LicenseDB 索引与 OSI API…');
const scanIndexRaw = await fetchText(SCANCODE_INDEX, 'scancode-index.json');
const scanIndex = JSON.parse(scanIndexRaw);
const osiRaw = await fetchText(OSI_API, 'osi-licenses.json');
const osiList = JSON.parse(osiRaw);
console.log(`    ScanCode ${scanIndex.length} 条，OSI ${osiList.length} 条`);

console.log('3/4 抓取 OSADL 兼容矩阵与义务表…');
const osadlMatrixRaw = await fetchText(`${OSADL}/matrix.json`, 'osadl-matrix.json');
const osadlCopyleftRaw = await fetchText(`${OSADL}/copyleft.json`, 'osadl-copyleft.json');
const osadlSourceRaw = await fetchText(`${OSADL}/sourcedisclosure.json`, 'osadl-sourcedisclosure.json');
const osadlMatrix = JSON.parse(osadlMatrixRaw);
const osadlCopyleft = JSON.parse(osadlCopyleftRaw).copyleft ?? {};
// 注意键名是 `disclosure` 而不是 `sourcedisclosure`（文件名与内部键名不一致）
const osadlSource = JSON.parse(osadlSourceRaw).disclosure ?? {};
// matrix.json 顶层混了时间戳等元数据字段，需要剔除
const OSADL_META = new Set(['timeformat', 'timestamp', 'title', 'license', 'attribution', 'copyright', 'disclaimer']);
const osadlIds = Object.keys(osadlMatrix).filter((k) => !OSADL_META.has(k));
console.log(`    矩阵 ${osadlIds.length} 个许可证；copyleft ${Object.keys(osadlCopyleft).length} 条；源码披露 ${Object.keys(osadlSource).length} 条`);

console.log('4/4 抓取开源原子中文审定稿清单…');
let zhTranslations = {};
try {
  // 注意：GitCode 的 git/trees?recursive=1 只返回顶层，不递归展开子目录，
  // 因此这里直接列审定稿目录的内容。
  const listRaw = await fetchText(`${GITCODE_CONTENTS}/${encodeURIComponent(ZH_FINAL_DIR)}`, 'gitcode-zh-final.json');
  const entries = JSON.parse(listRaw);
  const byName = new Map(entries.map((e) => [e.name, e]));
  for (const [fileName, spdxId] of Object.entries(ZH_TRANSLATION_FILES)) {
    const entry = byName.get(fileName);
    if (!entry || !entry.path || !entry.sha) {
      console.log(`    注意：审定稿清单里没有找到 ${fileName}`);
      continue;
    }
    zhTranslations[spdxId] = {
      url: `${GITCODE_BLOB}/${entry.sha}/${entry.path}`,
      repo: 'https://gitcode.com/translation/license-translation',
      license: 'CC0',
    };
  }
  console.log(`    匹配到 ${Object.keys(zhTranslations).length} 个审定稿`);
} catch (error) {
  // 中文译本是附加信息，抓取失败不应让整条流水线失败
  console.log(`    中文译本清单抓取失败（${error.message}），跳过该部分`);
  zhTranslations = {};
}

console.log('5/5 融合并写出…');

/* ---- ScanCode：先建含历史标识符的查找表 ---- */
const scanBySpdx = new Map();
for (const entry of scanIndex) {
  // other_spdx_license_keys 保存了旧写法（如 GPL-3.0、GPL-3.0+），
  // SPDX 快照里恰好还有这些废弃标识符，用它们可以把覆盖率从 95% 提到 98%+
  for (const key of [entry.spdx_license_key, ...(entry.other_spdx_license_keys ?? [])]) {
    if (key && !scanBySpdx.has(key)) scanBySpdx.set(key, entry);
  }
}

/* ---- OSI：按 spdx_id 建表（大小写不敏感） ---- */
const osiBySpdx = new Map();
for (const entry of osiList) {
  const key = (entry.spdx_id || entry.id || '').toLowerCase();
  if (key) osiBySpdx.set(key, entry);
}

const enrichment = {
  generatedFrom: {
    scancode: SCANCODE_INDEX,
    osi: OSI_API,
    osadl: {
      matrix: `${OSADL}/matrix.json`,
      copyleft: `${OSADL}/copyleft.json`,
      sourcedisclosure: `${OSADL}/sourcedisclosure.json`,
      license: 'CC-BY-4.0',
    },
    zhTranslations: `${GITCODE_CONTENTS}/${encodeURIComponent(ZH_FINAL_DIR)}`,
  },
  licenses: {},
  exceptions: {},
  /** 兼容性矩阵：只保留 SPDX 快照里存在的行与列，避免把 119×119 全表塞进前端包 */
  compatibility: {},
  /** 中文文本来源：审定稿链接与官方中文正文入口 */
  chinese: {},
  /** 覆盖率统计，界面上要如实说明数据来自哪几家、补了多少 */
  coverage: {
    spdxLicenses: spdx.licenses.length,
    scancodeMatched: 0,
    osiMatched: 0,
    withCategory: 0,
    nonOpen: 0,
    superseded: 0,
    osadlMatched: 0,
    compatibilityEdges: 0,
    chineseTranslations: 0,
    unmatched: [],
  },
};

const spdxIds = new Set(spdx.licenses.map((l) => l.id));
// 矩阵是二维的，行列都裁剪到 SPDX 已有的标识符
const osadlInScope = new Set(osadlIds.filter((id) => spdxIds.has(id)));
for (const rowId of osadlInScope) {
  const row = osadlMatrix[rowId];
  const trimmed = {};
  for (const [colId, verdict] of Object.entries(row)) {
    if (osadlInScope.has(colId)) trimmed[colId] = verdict;
  }
  if (Object.keys(trimmed).length) {
    enrichment.compatibility[rowId] = trimmed;
    enrichment.coverage.compatibilityEdges += Object.keys(trimmed).length;
    enrichment.coverage.osadlMatched++;
  }
}

for (const license of spdx.licenses) {
  const scan = scanBySpdx.get(license.id);
  const osi = osiBySpdx.get(license.id.toLowerCase());
  const record = {};

  if (scan) {
    enrichment.coverage.scancodeMatched++;
    if (scan.category) {
      enrichment.coverage.withCategory++;
      record.category = scan.category;
      record.family = SCANCODE_FAMILY[scan.category] ?? 'unknown';
      if (NON_OPEN_CATEGORIES.has(scan.category)) enrichment.coverage.nonOpen++;
    }
    if (scan.owner && scan.owner !== 'Unspecified') record.owner = scan.owner;
    if (scan.homepage_url) record.homepage = scan.homepage_url;
    if (scan.key) record.scancodeKey = scan.key;
    // 出处标注：回填时用的是历史标识符，要让界面能说清"这个分类来自哪条记录"
    if (scan.spdx_license_key && scan.spdx_license_key !== license.id) {
      record.scancodeMatchedVia = scan.spdx_license_key;
    }
  } else {
    enrichment.coverage.unmatched.push(license.id);
  }

  if (osi) {
    enrichment.coverage.osiMatched++;
    if (osi.keywords?.length) {
      record.osiKeywords = osi.keywords;
      if (osi.keywords.includes('superseded')) enrichment.coverage.superseded++;
    }
    if (osi.approval_date) record.osiApprovedDate = osi.approval_date;
  }

  // OSADL 义务表：copyleft 与"是否要求披露源码"
  const copyleft = osadlCopyleft[license.id];
  if (typeof copyleft === 'string') record.copyleft = copyleft;
  const source = osadlSource[license.id];
  if (typeof source === 'string') record.sourceDisclosure = source;

  // 中文文本来源：审定稿优先，其次是许可证自带的官方中文正文
  const zh = zhTranslations[license.id];
  if (zh) {
    record.chinese = { kind: 'reviewed-translation', ...zh };
    enrichment.coverage.chineseTranslations++;
  } else if (OFFICIAL_CHINESE_TEXT[license.id]) {
    record.chinese = { kind: 'official-text', ...OFFICIAL_CHINESE_TEXT[license.id] };
    enrichment.coverage.chineseTranslations++;
  }

  if (Object.keys(record).length) enrichment.licenses[license.id] = record;
}

/* ---- 例外：ScanCode 用 is_exception 标记，覆盖 SPDX 例外的一部分 ---- */
for (const exception of spdx.exceptions) {
  const scan = scanIndex.find(
    (e) => e.is_exception && (e.spdx_license_key === exception.id || e.license_key === exception.id.toLowerCase()),
  );
  if (scan) {
    enrichment.exceptions[exception.id] = {
      category: scan.category,
      ...(scan.owner && scan.owner !== 'Unspecified' ? { owner: scan.owner } : {}),
    };
  }
}

/* ---- ScanCode 独有条目的"官方中文文本"入口（见 SCANCODE_CHINESE 的说明） ---- */
for (const [key, source] of Object.entries(SCANCODE_CHINESE)) {
  enrichment.chinese[key] = { kind: 'official-text', ...source };
  enrichment.coverage.chineseTranslations++;
}

/*
 * 同一份正文的其它标识符，继承已有的中文入口。
 *
 * 必要性：`ZH_TRANSLATION_FILES` 按 SPDX 标识符精确分键，于是
 * `GPL-3.0-only` 拿到了审定稿，而正文完全相同的 `GPL-3.0-or-later`
 * 反而没有——问卷与详情页推荐的恰恰是 `-or-later` 那个。同理
 * `AGPL-3.0-or-later`、`LGPL-3.0-or-later`、`GPL-2.0-or-later` 都漏了。
 *
 * 判据用**归一化正文哈希**而不是按名字去猜变体关系：正文一致才继承，
 * 避免把 -invariants / -no-RFN 这类"同名但其实另有一份正则"的条目误连起来。
 */
const normHash = (t) =>
  createHash('sha256')
    .update(String(t ?? '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, ''))
    .digest('hex');
// 正文文件由上一步 `data:spdx` 产出；缺失时直接跳过继承，不让 enrichment 因此失败
const licenseTexts = existsSync(join(publicDir, 'license-texts.json'))
  ? JSON.parse(readFileSync(join(publicDir, 'license-texts.json'), 'utf8'))
  : null;
// **只从 license-texts.json 建哈希表**，不依赖 spdx.licenses 的字段形状：
// 早先写成 `spdx.licenses.map(l => [l.id, …])`，那批缓存的字段名与预期不同，
// 取到的键全是 undefined，于是所有条目哈希相同、互相继承，中文入口从十几个涨到 724 个。
const textHashById = new Map();
for (const [id, rec] of Object.entries(licenseTexts?.licenses ?? {})) {
  const h = normHash(rec?.licenseText ?? '');
  if (id && h) textHashById.set(id, h);
}
if (!textHashById.size) console.log('  ⚠ 取不到许可证正文，跳过中文入口的同正文继承');
const hashToChinese = new Map();
for (const [id, record] of Object.entries(enrichment.licenses)) {
  if (!record.chinese) continue;
  const h = textHashById.get(id);
  // 正文取不到就没有依据——**绝不能**把 undefined 当键存进 Map：
  // 那样之后凡是哈希为 undefined 的条目（正文缺失的一大类）都会互相"继承"，
  // 中文入口会从十几个膨胀到七百多个。
  if (h) hashToChinese.set(h, record.chinese);
}
let inherited = 0;
for (const [id, record] of Object.entries(enrichment.licenses)) {
  if (record.chinese) continue;
  const h = textHashById.get(id);
  const zh = h ? hashToChinese.get(h) : undefined;
  if (zh) {
    enrichment.licenses[id] = { ...record, chinese: { ...zh, inherited: true } };
    inherited++;
    enrichment.coverage.chineseTranslations++;
  }
}
if (inherited) console.log(`  同正文继承的中文入口：${inherited} 个`);

writeFileSync(join(publicDir, 'license-enrichment.json'), JSON.stringify(enrichment), 'utf8');

/* ---- 自检 ---- */
const c = enrichment.coverage;
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
console.log('');
console.log(`ScanCode 分类覆盖：${c.scancodeMatched}/${c.spdxLicenses} = ${pct(c.scancodeMatched, c.spdxLicenses)}`);
console.log(`OSADL 兼容矩阵：${c.osadlMatched} 个许可证、${c.compatibilityEdges} 条判定`);
console.log(`OSI keywords 覆盖：${c.osiMatched}/${c.spdxLicenses} = ${pct(c.osiMatched, c.spdxLicenses)}`);
console.log(`中文文本来源：${c.chineseTranslations} 个许可证`);
console.log(`判定为非开源的分类：${c.nonOpen} 个（生成时须警告）`);
console.log(`OSI 标记 superseded：${c.superseded} 个`);
console.log(`例外补充：${Object.keys(enrichment.exceptions).length}/${spdx.exceptions.length}`);
if (c.unmatched.length) {
  console.log(`未匹配到任何第三方数据的 ${c.unmatched.length} 个：${c.unmatched.slice(0, 20).join(', ')}${c.unmatched.length > 20 ? ' …' : ''}`);
}
console.log('');
console.log('产出：public/data/license-enrichment.json');
