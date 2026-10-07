import type { Family } from './types.ts';
// licenses.ts 只依赖 types.ts，不会与本文件形成循环
import { LICENSES } from './licenses.ts';

/**
 * 人工逐条核对过的家族判定。这 32 个的结论**优先于任何上游分类与正则推导**——
 * 它们是人按许可证实际条款逐条看过定下来的，上游的粗分类与推导都只是近似。
 *
 * 必须在这里生效而不是只放在 licenses.ts：`familyFromEntry` 读的是 enrichment
 * 里的上游 family，人工整理的值并没有写进那份数据，所以不加这一步的话，
 * 列表筛选用的仍是上游值，与详情面板（读人工值）对不上。
 */
const CURATED_FAMILY = new Map(LICENSES.map((l) => [l.id, l.family]));

/**
 * SPDX 官方 License List 的读取与解析层。
 *
 * 数据链路（见 scripts/fetch-spdx.mjs）：
 *   SPDX License List API ──构建期抓取──▶ public/data/license-index.json（元数据，首屏加载）
 *                                      └▶ public/data/license-texts.json（正文，按需加载）
 *
 * 这里的 JSON 形状刻意按 GitHub 官方仓库 `json/` 目录的原始结构定义，
 * 并配套 fromSpdxLicenseList / fromSpdxExceptionList / fromSpdxLicenseDetail 三个解析函数。
 * 这样任何直接调用实时 API（
 *   https://raw.githubusercontent.com/spdx/license-list-data/main/json/licenses.json 等）
 * 的人都能复用同一套解析，也便于将来核对快照与上游是否一致。
 */

/* ------------------------------------------------------------------ *
 * 上游 JSON 形状（官方仓库原样）
 * ------------------------------------------------------------------ */

export interface SpdxLicenseListItem {
  reference: string;
  isDeprecatedLicenseId: boolean;
  detailsUrl: string;
  referenceNumber?: number;
  name: string;
  licenseId: string;
  seeAlso?: string[];
  isOsiApproved: boolean;
  isFsfLibre?: boolean;
}

export interface SpdxLicenseList {
  licenseListVersion: string;
  licenses: SpdxLicenseListItem[];
}

export interface SpdxExceptionListItem {
  reference: string;
  isDeprecatedLicenseId: boolean;
  detailsUrl: string;
  referenceNumber?: number;
  name: string;
  licenseExceptionId: string;
  seeAlso?: string[];
}

export interface SpdxExceptionList {
  licenseListVersion: string;
  exceptions: SpdxExceptionListItem[];
}

/** 许可证详情（json/details/<ID>.json） */
export interface SpdxLicenseDetail {
  isDeprecatedLicenseId: boolean;
  isFsfLibre?: boolean;
  name: string;
  licenseId: string;
  licenseText: string;
  /** 由许可证自身给出的文件头模板；缺省表示该许可证没有官方模板 */
  standardLicenseHeader?: string;
  standardLicenseTemplate?: string;
  isOsiApproved: boolean;
  seeAlso?: string[];
}

/** 例外详情（json/exceptions/<ID>.json）——注意字段名与许可证不同 */
export interface SpdxExceptionDetail {
  isDeprecatedLicenseId: boolean;
  name: string;
  licenseExceptionId: string;
  licenseExceptionText: string;
  licenseExceptionTemplate?: string;
  licenseComments?: string;
  seeAlso?: string[];
}

/* ------------------------------------------------------------------ *
 * 解析为本站模型
 * ------------------------------------------------------------------ */

export interface CatalogLicense {
  id: string;
  name: string;
  deprecated: boolean;
  osiApproved: boolean;
  fsfLibre: boolean;
  hasText: boolean;
  textLength: number;
  /** 该许可证是否自带官方文件头模板（决定我们能否给出官方声明措辞） */
  hasOfficialHeader: boolean;
  seeAlso: string[];
}

export interface CatalogException {
  id: string;
  name: string;
  deprecated: boolean;
  hasText: boolean;
  textLength: number;
  seeAlso: string[];
}

export interface SpdxSnapshot {
  licenseListVersion: string;
  generatedFrom: string;
  licenses: CatalogLicense[];
  exceptions: CatalogException[];
}

/** 一个许可证的正文与官方头模板 */
export interface LicenseText {
  name: string;
  url: string;
  osiApproved?: boolean;
  deprecated?: boolean;
  licenseText: string;
  standardLicenseHeader?: string;
}

export interface ExceptionText {
  name: string;
  url: string;
  licenseText: string;
}

export interface SpdxTexts {
  licenses: Record<string, LicenseText>;
  exceptions: Record<string, ExceptionText>;
}

/** 上游索引 → 本站目录条目 */
export function fromSpdxLicenseList(list: SpdxLicenseList, details?: Record<string, SpdxLicenseDetail>): CatalogLicense[] {
  return list.licenses.map((l) => {
    const detail = details?.[l.licenseId];
    return {
      id: l.licenseId,
      name: l.name,
      deprecated: Boolean(l.isDeprecatedLicenseId),
      osiApproved: Boolean(l.isOsiApproved),
      fsfLibre: Boolean(l.isFsfLibre),
      hasText: detail ? Boolean(detail.licenseText) : true,
      textLength: detail?.licenseText.length ?? 0,
      hasOfficialHeader: Boolean(detail?.standardLicenseHeader?.trim()),
      seeAlso: l.seeAlso ?? [],
    };
  });
}

export function fromSpdxExceptionList(
  list: SpdxExceptionList,
  details?: Record<string, SpdxExceptionDetail>,
): CatalogException[] {
  return list.exceptions.map((e) => {
    const detail = details?.[e.licenseExceptionId];
    return {
      id: e.licenseExceptionId,
      name: e.name,
      deprecated: Boolean(e.isDeprecatedLicenseId),
      hasText: detail ? Boolean(detail.licenseExceptionText) : true,
      textLength: detail?.licenseExceptionText.length ?? 0,
      seeAlso: e.seeAlso ?? [],
    };
  });
}

export function fromSpdxLicenseDetail(detail: SpdxLicenseDetail): LicenseText {
  return {
    name: detail.name,
    url: `https://spdx.org/licenses/${encodeURIComponent(detail.licenseId)}.html`,
    osiApproved: Boolean(detail.isOsiApproved),
    deprecated: Boolean(detail.isDeprecatedLicenseId),
    licenseText: detail.licenseText,
    standardLicenseHeader: detail.standardLicenseHeader?.trim() || undefined,
  };
}

export function fromSpdxExceptionDetail(detail: SpdxExceptionDetail): ExceptionText {
  return {
    name: detail.name,
    url: `https://spdx.org/licenses/${encodeURIComponent(detail.licenseExceptionId)}.html`,
    licenseText: detail.licenseExceptionText,
  };
}

/* ------------------------------------------------------------------ *
 * 浏览器端的目录与正文加载
 * ------------------------------------------------------------------ */

let catalogPromise: Promise<SpdxSnapshot> | null = null;
let textsPromise: Promise<SpdxTexts> | null = null;

/** 加载全量目录（约 220KB，首屏就要，用于搜索与筛选） */
export function loadCatalog(basePath = ''): Promise<SpdxSnapshot> {
  catalogPromise ??= fetch(`${basePath}/data/license-index.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`无法加载许可证目录（HTTP ${r.status}）`);
      return r.json() as Promise<SpdxSnapshot>;
    })
    .catch((error: unknown) => {
      // 失败不缓存，避免一次网络抖动让本次会话永久无法重试
      catalogPromise = null;
      throw error;
    });
  return catalogPromise;
}

/**
 * 加载全部正文（约 5.3MB）。
 *
 * 之所以整包加载而不是逐个许可证请求：用户会反复切换许可证做比较，
 * 逐个请求会让每次切换都等一个网络往返；而 5MB 在生成页打开时下载一次、
 * 之后完全离线可用，整体体验更好。首屏不受影响——它只加载上面的目录。
 */
export function loadTexts(basePath = ''): Promise<SpdxTexts> {
  textsPromise ??= fetch(`${basePath}/data/license-texts.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`无法加载许可证正文（HTTP ${r.status}）`);
      return r.json() as Promise<SpdxTexts>;
    })
    .catch((error: unknown) => {
      textsPromise = null;
      throw error;
    });
  return textsPromise;
}

/* ------------------------------------------------------------------ *
 * 多源补充数据（ScanCode LicenseDB + OSI API）
 *
 * 与 SPDX 快照分开存放：SPDX 是正文与标识符的权威来源，
 * 补充数据只提供分类、归属方与"已被取代"这类信号。任一方更新都能独立重跑。
 * ------------------------------------------------------------------ */

/** 中文文本来源 */
export interface ChineseTextSource {
  /**
   * `reviewed-translation` —— 开放原子《源译识》经评审的中英对照审定稿（译文以 CC0 贡献）
   * `official-text` —— 许可证自带或权利人发布的官方中文正文
   */
  kind: 'reviewed-translation' | 'official-text';
  url: string;
  repo?: string;
  license?: string;
  note?: { zh: string; en: string };
}

export interface EnrichmentRecord {
  /** ScanCode 的粗分类，例如 "Permissive" / "Copyleft Limited" / "Source-available" */
  category?: string;
  /** 由分类映射出的家族；仅在人工整理条目缺席时使用 */
  family?: string;
  owner?: string;
  homepage?: string;
  scancodeKey?: string;
  /** 分类是通过历史标识符回填的，需要向用户交代 */
  scancodeMatchedVia?: string;
  /** OSI 官方 API 的标签，含 superseded / redundant-with-more-popular / non-reusable 等 */
  osiKeywords?: string[];
  osiApprovedDate?: string;
  /** OSADL 的 copyleft 判定：No / Yes / Yes (restricted) / Questionable */
  copyleft?: string;
  /** OSADL 的源码披露义务：No / Yes / Delayed … */
  sourceDisclosure?: string;
  /** 中文文本来源 */
  chinese?: ChineseTextSource;
}

export interface Enrichment {
  generatedFrom: Record<string, unknown>;
  licenses: Record<string, EnrichmentRecord>;
  exceptions: Record<string, { category?: string; owner?: string }>;
  /** 兼容性矩阵：{许可证A: {许可证B: 判定}}，已裁剪到 SPDX 收录范围 */
  compatibility: Record<string, Record<string, string>>;
  chinese: Record<string, ChineseTextSource>;
  coverage: {
    spdxLicenses: number;
    scancodeMatched: number;
    osiMatched: number;
    withCategory: number;
    nonOpen: number;
    superseded: number;
    osadlMatched: number;
    compatibilityEdges: number;
    chineseTranslations: number;
    unmatched: string[];
  };
}

/**
 * OSADL 兼容性判定的含义。
 * 判定值来自 matrix.json，原文是英文单词，这里给出中英说明，
 * 并且**不把它包装成法律结论**——矩阵本身是合规指引，带自己的免责声明。
 */
export const COMPATIBILITY_VERDICT: Record<string, { zh: string; en: string; tone: 'yes' | 'no' | 'warn' }> = {
  Yes: { zh: '可以组合', en: 'may be combined', tone: 'yes' },
  Same: { zh: '同一许可证', en: 'same license', tone: 'yes' },
  No: { zh: '不可组合', en: 'may not be combined', tone: 'no' },
  Unknown: { zh: 'OSADL 未给出判定', en: 'no verdict from OSADL', tone: 'warn' },
  'Check dependency': { zh: '取决于依赖的具体情况', en: 'depends on the dependency', tone: 'warn' },
};

let enrichmentPromise: Promise<Enrichment> | null = null;

/** 加载第三方补充数据（约 60KB，与目录一起在首屏取） */
export function loadEnrichment(basePath = ''): Promise<Enrichment> {
  enrichmentPromise ??= fetch(`${basePath}/data/license-enrichment.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`无法加载许可证补充数据（HTTP ${r.status}）`);
      return r.json() as Promise<Enrichment>;
    })
    .catch((error: unknown) => {
      enrichmentPromise = null;
      throw error;
    });
  return enrichmentPromise;
}

/** 查询兼容性判定（双向取一次，矩阵本身是单向存储的） */
export function compatibilityOf(
  enrichment: Enrichment | null | undefined,
  a: string,
  b: string,
): { verdict: string; note: { zh: string; en: string; tone: 'yes' | 'no' | 'warn' } } | null {
  if (!enrichment) return null;
  const direct = enrichment.compatibility[a]?.[b];
  const reverse = enrichment.compatibility[b]?.[a];
  const verdict = direct ?? reverse;
  if (!verdict) return null;
  const note = COMPATIBILITY_VERDICT[verdict] ?? COMPATIBILITY_VERDICT.Unknown;
  return { verdict, note };
}

/** 某个许可证在矩阵里"不可组合"的对手清单，用于界面上提前给出警告 */
export function knownIncompatibilities(
  enrichment: Enrichment | null | undefined,
  id: string,
  limit = 30,
): { id: string; verdict: string }[] {
  if (!enrichment) return [];
  const row = enrichment.compatibility[id];
  if (!row) return [];
  return Object.entries(row)
    .filter(([other, verdict]) => other !== id && verdict === 'No')
    .map(([other, verdict]) => ({ id: other, verdict }))
    .slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * ScanCode LicenseDB 的非 SPDX 部分
 *
 * LicenseDB 有 2400+ 个许可证，其中约 2000 个不在 SPDX 列表里——这些恰恰是真实代码库里
 * 会撞到、但 SPDX 查不到的东西（"Anti 996" License、ActiveState Community License、
 * 各类厂商的 Proprietary Free / Non-Commercial / Source-available 条款……）。
 *
 * **重要区别**：ScanCode 的 license key 与 SPDX 标识符是两套体系。
 * 非 SPDX 条目在 SPDX 文档里的写法是 `LicenseRef-scancode-<key>`，
 * 这个字面量**不能直接写进 package.json 的 license 字段**，也不能据此声称 OSI 认证。
 * 因此这部分条目定位为**参考与审计**，界面上必须把这条讲清楚。
 * ------------------------------------------------------------------ */

export interface ScancodeEntry {
  key: string;
  name: string;
  longName?: string;
  category: string;
  isException: boolean;
  deprecated: boolean;
  /** SPDX 文档里的写法（LicenseRef 形式） */
  spdxLicenseKey?: string;
  otherSpdxKeys?: string[];
  /** 原始归属方，例如 "COSCL - China Open Source Cloud League" */
  owner?: string;
  homepage?: string;
  textLength: number;
  hasText: boolean;
}

export interface ScancodeCatalog {
  generatedFrom: string;
  license: string;
  note: string;
  entries: ScancodeEntry[];
}

let scancodeIndexPromise: Promise<ScancodeCatalog> | null = null;
let scancodeTextsPromise: Promise<Record<string, string>> | null = null;

/** 加载非 SPDX 许可证目录（约 370KB） */
export function loadScancodeCatalog(basePath = ''): Promise<ScancodeCatalog> {
  scancodeIndexPromise ??= fetch(`${basePath}/data/scancode-index.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`无法加载 ScanCode 目录（HTTP ${r.status}）`);
      return r.json() as Promise<ScancodeCatalog>;
    })
    .catch((error: unknown) => {
      scancodeIndexPromise = null;
      throw error;
    });
  return scancodeIndexPromise;
}

/** 加载非 SPDX 许可证正文（约 13MB，只在真正需要时取一次） */
export function loadScancodeTexts(basePath = ''): Promise<Record<string, string>> {
  scancodeTextsPromise ??= fetch(`${basePath}/data/scancode-texts.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`无法加载 ScanCode 正文（HTTP ${r.status}）`);
      return r.json() as Promise<Record<string, string>>;
    })
    .catch((error: unknown) => {
      scancodeTextsPromise = null;
      throw error;
    });
  return scancodeTextsPromise;
}

/** 非 SPDX 条目的 SPDX 文档写法 */
export function licenseRefOf(key: string): string {
  return `LicenseRef-scancode-${key}`;
}

/* ------------------------------------------------------------------ *
 * 统一目录：SPDX 优先，ScanCode 独有的条目补在后面
 * ------------------------------------------------------------------ */

export type CatalogSource = 'spdx' | 'scancode';

export interface UnifiedEntry {
  /** 检索用的稳定 ID：SPDX 用标识符，ScanCode 独有条目用 `scancode:<key>` */
  id: string;
  source: CatalogSource;
  name: string;
  deprecated: boolean;
  osiApproved: boolean;
  category?: string;
  hasOfficialHeader: boolean;
  textLength: number;
  /** ScanCode 独有条目才有 */
  scancodeKey?: string;
  isException?: boolean;
  /** 原始归属方（仅 ScanCode 独有条目携带，来自其详情 JSON） */
  owner?: string;
  homepage?: string;
}

let unifiedPromise: Promise<UnifiedEntry[]> | null = null;

/**
 * 合并两个目录为一张可检索的表。
 *
 * 不去重：SPDX 与 ScanCode 的条目并不一一对应（ScanCode 会用
 * `LanguageRef-scancode-*` 表示自己的历史变体），强行合并反而会丢信息。
 * 两者的区分通过 `source` 字段暴露给界面。
 */
export function loadUnifiedCatalog(spdx: SpdxSnapshot, scancode: ScancodeCatalog | null): UnifiedEntry[] {
  const out: UnifiedEntry[] = spdx.licenses.map((l) => ({
    id: l.id,
    source: 'spdx' as const,
    name: l.name,
    deprecated: l.deprecated,
    osiApproved: l.osiApproved,
    hasOfficialHeader: l.hasOfficialHeader,
    textLength: l.textLength,
  }));
  if (scancode) {
    for (const e of scancode.entries) {
      if (e.isException) continue; // 例外不在"选一个许可证"的语境里
      out.push({
        id: `scancode:${e.key}`,
        source: 'scancode',
        name: e.longName ?? e.name ?? e.key,
        deprecated: e.deprecated,
        osiApproved: false, // 非 SPDX 条目无法据此声称 OSI 认证
        category: e.category,
        hasOfficialHeader: false,
        textLength: e.textLength,
        scancodeKey: e.key,
        // 归属方与主页直接来自 ScanCode 详情：enrichment 不覆盖这些条目，
        // 简介与详情页需要从这里取"这是谁家的许可证"
        owner: e.owner,
        homepage: e.homepage,
      });
    }
  }
  return out;
}

/** 带缓存的合并目录 */
export function getUnifiedCatalog(): Promise<UnifiedEntry[]> {
  unifiedPromise ??= Promise.all([loadCatalog(), loadScancodeCatalog().catch(() => null)]).then(([spdx, scancode]) =>
    loadUnifiedCatalog(spdx, scancode),
  );
  return unifiedPromise;
}

/** 在合并目录上检索 */
export function searchUnified(entries: UnifiedEntry[], query: string, limit = 400): UnifiedEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice(0, limit);
  const exact: UnifiedEntry[] = [];
  const starts: UnifiedEntry[] = [];
  const contains: UnifiedEntry[] = [];
  for (const e of entries) {
    const id = e.id.toLowerCase();
    const name = e.name.toLowerCase();
    const key = (e.scancodeKey ?? '').toLowerCase();
    if (id === q || key === q) exact.push(e);
    else if (id.startsWith(q) || key.startsWith(q)) starts.push(e);
    else if (id.includes(q) || name.includes(q)) contains.push(e);
  }
  return [...exact, ...starts, ...contains].slice(0, limit);
}

/** ScanCode 目录的统计 */
export function scancodeStats(catalog: ScancodeCatalog) {
  const byCategory: Record<string, number> = {};
  for (const e of catalog.entries) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  return {
    total: catalog.entries.length,
    withText: catalog.entries.filter((e) => e.hasText).length,
    deprecated: catalog.entries.filter((e) => e.deprecated).length,
    nonOpen: catalog.entries.filter((e) => isNonOpenCategory(e.category)).length,
    byCategory,
  };
}
/* ------------------------------------------------------------------ *
 * ChooseALicense 的条款标签（权威覆盖层）
 *
 * 这是本项目**唯一**能拿到"条款布尔字段"精确标注的来源：它用固定词表人工标注了
 * 47 个主流许可证，字段语义与我们的完全对应。因此条款字段的合并优先级是：
 *   人工整理的条目 > ChooseALicense 标签 > 正文正则推断
 * 前两者之外的部分仍然只能推断，并如实标注来源。
 * ------------------------------------------------------------------ */

export interface TermTag {
  tag: string;
  label: string;
  description: string;
}

export interface ChooseALicenseTerms {
  generatedFrom: Record<string, string>;
  vocabulary: Record<string, TermTag[]>;
  licenses: Record<
    string,
    {
      title: string;
      nickname?: string;
      featured: boolean;
      hidden: boolean;
      permissions: string[];
      conditions: string[];
      limitations: string[];
      derived: {
        patentGrant: 'explicit' | 'none' | 'silent';
        trademarkClause: boolean;
        stateChanges: boolean;
        networkTrigger: boolean;
        sameLicenseWholeWork: boolean;
        sameLicensePerFile: boolean;
        sameLicenseLibrary: boolean;
        discloseSource: boolean;
        includeCopyright: boolean;
        includeCopyrightSourceOnly: boolean;
        commercialUse: boolean;
        privateUse: boolean;
      };
      sourceUrl: string;
    }
  >;
  coverage: { files: number; matched: number; unmatched: string[] };
}

let termsPromise: Promise<ChooseALicenseTerms> | null = null;

export function loadTerms(basePath = ''): Promise<ChooseALicenseTerms> {
  termsPromise ??= fetch(`${basePath}/data/terms.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`无法加载条款标签数据（HTTP ${r.status}）`);
      return r.json() as Promise<ChooseALicenseTerms>;
    })
    .catch((error: unknown) => {
      termsPromise = null;
      throw error;
    });
  return termsPromise;
}

/**
 * 在 ChooseALicense 的标签表里查一个 SPDX 标识符。
 *
 * 上游用的是它自己的写法（`GPL-3.0`、`AGPL-3.0`、`LGPL-2.1`），而这些在 SPDX 里
 * 已经是废弃或含混形式。因此这里做一次规范化匹配：
 * 精确匹配 → 忽略 `-only` / `-or-later` 后缀匹配。
 * 这一步很关键：没有它，GPL 家族的标签会全部对不上。
 */
export function lookupTerms(
  terms: ChooseALicenseTerms | null | undefined,
  spdxId: string,
): ChooseALicenseTerms['licenses'][string] | null {
  if (!terms) return null;
  const exact = terms.licenses[spdxId];
  if (exact) return exact;

  const normalize = (s: string) => s.toLowerCase().replace(/-(only|or-later)$/, '');
  const target = normalize(spdxId);
  for (const [id, value] of Object.entries(terms.licenses)) {
    if (normalize(id) === target) return value;
  }
  return null;
}

/** ScanCode 分类 → 本站家族。**唯一的一份**，界面与解析都从这里取，避免两份副本走偏。 */
export const SCANCODE_FAMILY: Record<string, string> = {
  Permissive: 'permissive',
  'Copyleft Limited': 'weak-copyleft',
  Copyleft: 'strong-copyleft',
  'Public Domain': 'public-domain',
  'Free Restricted': 'permissive',
  'Source-available': 'proprietary',
  'Proprietary Free': 'proprietary',
  Commercial: 'proprietary',
  'Non-Commercial': 'proprietary',
  'Unstated License': 'unknown',
  'Patent License': 'unknown',
  CLA: 'unknown',
};

/**
 * 从条目上现取家族。
 *
 * 优先用 enrichment（SPDX 那 740 个走这条），拿不到就退回 ScanCode 条目自带的分类——
 * 后者是必须的：enrichment 只覆盖 SPDX 列表内的许可证，ScanCode 独有的 2000 多个
 * 条目在上面找不到记录，早先因此全部被默认成 permissive（木兰公共型就被误判过）。
 *
 * ⚠️ 第三方分类**区分不出两件事**，必须在这里补判：
 *  1. 网络著佐权。ScanCode 把 AGPL 与 GPL 同归 `Copyleft`，enrichment 里
 *     AGPL-3.0 的 family 也直接写成 strong-copyleft——但 AGPL 多一条
 *     "做成网站给别人用也要开源"的义务，那是它与 GPL 最实质的差别。
 *     所以按正文里的网络条款重新判定（这与详情面板的「做成网站给别人用」同一依据）。
 *  2. 内容与数据许可。CC-BY、GFDL 这类被归进 permissive / weak-copyleft，
 *     但对用户来说"这是给文字图片用的"比"宽松程度"更有用。
 */
export function familyFromEntry(
  entry: { source: 'spdx' | 'scancode'; category?: string; id?: string; scancodeKey?: string },
  extra?: EnrichmentRecord,
): string | undefined {
  const id = entry.id ?? entry.scancodeKey ?? '';
  // 人工核对过的（32 个）以核对结果为准，不用上游分类也不用推导
  const curated = CURATED_FAMILY.get(id);
  if (curated) return curated;
  const base = extra?.family ?? (entry.category ? SCANCODE_FAMILY[entry.category] : undefined);
  return refineFamily(id, base);
}

/**
 * 网络著佐权：**只有 AGPL 系列**多一条"做成网站给别人用也要开源"的义务。
 * 而 ScanCode 把 AGPL 与 GPL 同归 `Copyleft`，enrichment 也直接写成
 * strong-copyleft——那是它与 GPL 最实质的差别，必须按标识符补判。
 *
 * ⚠️ 两处都别写宽：
 *  · 不能写成 `(A|L)?GPL`——那样会把 **GPL-3.0 也算进来**，而 GPL 没有网络条款
 *    （详情面板的「做成网站给别人用」对这一条有明确说明）。
 *  · **不要加 EUPL**。EUPL 常被误认为有网络条款，实际正文里没有
 *    network/interact 相关的要求（已逐句核对过 EUPL-1.2）。
 */
const NETWORK_ID = /^AGPL-/i;

/**
 * 内容与数据许可：给文字、图片、数据用的。
 *
 * 不含这几类：
 *  · CC-BY-SA —— 它要求衍生品同许可，属著作权型
 *  · CC0      —— 是权利放弃，属公共领域型
 *  · OFL      —— 字体许可，另有归属
 */
const CONTENT_ID = /^(CC-BY-\d|GFDL-|CC-PDDC|OGL-)/i;

/**
 * 在第三方分类的基础上做两处细分。抽出来是为了**可测**——
 * 这两条都曾经因为"第三方分类够用"的假设而缺失，导致：
 *  · AGPL 在列表里被归进"著作权型 · 整个项目"，而它在详情面板显示"含网络使用"，
 *    列表与详情对不上；
 *  · CC-BY 这类内容许可被混进"宽松型"，用户按内容找许可时找不到。
 *
 * 放在第三方分类**之后**覆盖，是因为这些判定比上游的粗分类更贴合本站的分类口径；
 * 但只覆盖少数几类，其余一律沿用上游结果。
 */
function refineFamily(id: string, base: string | undefined): string | undefined {
  if (NETWORK_ID.test(id)) return 'network-copyleft';
  // 公共领域优先于内容型：CC0 是权利放弃，不该被算作"内容与数据许可"
  if (/^(CC0-|CC-PDDC|Unlicense|WTFPL)/i.test(id)) return 'public-domain';
  if (CONTENT_ID.test(id)) return 'content';
  return base;
}

/** ScanCode 分类判定为"非开源"的那几类：生成时必须给出明确警告 */
export const NON_OPEN_CATEGORIES = new Set([
  'Proprietary Free',
  'Commercial',
  'Non-Commercial',
  'Source-available',
  'Unstated License',
]);

export function isNonOpenCategory(category: string | undefined): boolean {
  return Boolean(category && NON_OPEN_CATEGORIES.has(category));
}

/** OSI 标签的说明，用于界面提示（这些标签只有 OSI 官方 API 提供） */
export const OSI_KEYWORD_NOTE: Record<string, { zh: string; en: string }> = {
  superseded: {
    zh: '已被 OSI 标记为"被取代"，新项目不建议使用',
    en: 'marked superseded by OSI; not recommended for new projects',
  },
  'redundant-with-more-popular': {
    zh: '与更流行的许可证重复，建议改用后者',
    en: 'redundant with a more popular license; prefer that one',
  },
  'non-reusable': { zh: 'OSI 标记为不可复用', en: 'marked non-reusable by OSI' },
  'voluntarily-retired': { zh: '已被权利人主动撤回', en: 'voluntarily retired by its steward' },
  legacy: { zh: '历史遗留许可', en: 'legacy license' },
  'special-purpose': { zh: '面向特定用途', en: 'special-purpose license' },
  'popular-strong-community': { zh: '社区基础广泛', en: 'broad community backing' },
};

/* ------------------------------------------------------------------ *
 * 从正文推断条款事实
 *
 * 长尾许可证没有人工整理的条款字段。家族优先取第三方权威分类（ScanCode），
 * 拿不到时才退回**正文关键词**推断；其余条款字段只能靠文本推断，
 * 并始终标记为 inferred，在界面上明示"这是文本推断，不是权威认定"。
 * 宁可承认不确定，也不要给用户一个看起来确定、实际靠猜的勾。
 * ------------------------------------------------------------------ */

export interface DerivedFacts {
  family: Family;
  /** 家族判定的依据：第三方权威分类 / SPDX 标识符 / 正文文本 */
  familySource: 'scancode-category' | 'spdx-id' | 'text';
  patentGrant: 'explicit' | 'none' | 'silent';
  /** 是否含商标条款（有则明确不授予商标权） */
  trademarkClause: boolean;
  /** 修改文件时是否必须在文件中标注改动 */
  stateChanges: boolean;
  /** 是否要求衍生作品整体同许可（强著佐权） */
  sameLicenseWholeWork: boolean;
  /** 是否只要求被修改的文件保持同许可（文件级著佐权） */
  sameLicensePerFile: boolean;
  /** 是否通过网络提供服务即触发开源义务 */
  networkTrigger: boolean;
  /**
   * 分发时要不要附上版权声明与许可证全文：
   *  - `required`     要（绝大多数许可）
   *  - `source-only`  只要求在源码形式里保留，二进制不必（BSL-1.0、Zlib）
   *  - `not-required` 明确不要求（0BSD、CC0-1.0、MIT-0、Unlicense、WTFPL）
   *  - `silent`       正文里没找到相关要求（长尾条目，只能读正文）
   */
  includeCopyright: 'required' | 'source-only' | 'not-required' | 'silent';
  /**
   * 能不能拿作者/贡献者的名义表示**认可或支持**（背书）。
   *
   * 与 `promote` 是两种不同性质的行为，条款里也常分开写：
   *   背书 = 意见表达（"XX 官方推荐本产品"）——借别人的信誉为你增信
   *   促销 = 市场行为（"本产品基于 XX 的技术"）——借别人的知名度吸引流量
   * BSD-3-Clause 把两者并列禁掉，但实测有 53 个许可**只禁背书**、
   * 4 个**只禁促销**，所以必须是两个独立的维度，不能合成一个。
   *
   *  - `prohibited` 明确禁止
   *  - `silent`     正文没写。没写不等于可以——拿别人名义宣传通常要另行取得同意。
   */
  endorse: 'prohibited' | 'silent';
  /** 能不能拿作者/贡献者的名义为你的产品做**推广促销**；语义同 `endorse` */
  promote: 'prohibited' | 'silent';
  /** 条款字段的来源；`choosealicense` 表示人工标注，`text` 表示正则推断 */
  termsSource: 'choosealicense' | 'text';
  /** 全部非权威结论都来自文本匹配，必须标注 */
  inferred: true;
}

/**
 * "通过网络提供服务即触发开源"的标志。
 *
 * 两个实测出来的坑：
 *  1. 宽泛的 `use ... over a network` 会误报——MPL-2.0 第 3.2 节里就出现
 *     "making the Covered Software available over a network"，而那一句恰好在说**不**触发义务。
 *  2. **不能拿 "Affero" 当标志**：GPL-3.0 与 MPL-2.0 的正文里都提到 GNU Affero GPL——
 *    前者是第 13 节的合并条款，后者把它列为 "Secondary License"。它们本身都不是网络著佐权。
 * 因此只保留各许可证真正用来**施加**网络义务的固定句子。
 */
const NETWORK_MARKERS = [
  /Remote Network Interaction/i,
  /interacting with it remotely through a computer network/i,
  /users interacting with it remotely/i,
  /network interaction/i,
  /use of the (?:Work|Program).{0,60}over a network/i,
];

const WHOLE_WORK_MARKERS = [
  /share ?alike/i,
  /must (?:be|remain) (?:licensed |distributed )?under (?:the )?same/i,
  /license the entire work/i,
  /copyleft/i,
  /reciprocal/i,
];

/**
 * 文件级著佐权的标志。
 * MPL / EPL 这类"只有被修改的文件需要回馈"的许可，其正文不会出现
 * "Modify any file" 这种直白说法，因此不能只靠字面匹配。
 */
const PER_FILE_MARKERS = [
  /Mozilla Public License/i,
  /Eclipse Public License/i,
  /file-level/i,
  /files? (?:that|which) (?:you|were) modif/i,
  /Modify any (?:Covered Software )?file/i,
  /Source Code Form/i,
  /the Licensor.{0,80}file/i,
];

const PATENT_GRANT_MARKERS = [
  /patent license/i,
  /grant.{0,60}patent/i,
  /royalty-free, non-exclusive.{0,40}patent/i,
  /patent.{0,40}retaliat/i,
];

/**
 * 明确**整体上**不授予专利的表述（意味着"这个许可证没有专利授权"）。
 *
 * 刻意不收录 "no patent license is granted" 这类**局部**限制：MPL-2.0 就有这一句
 * （"no patent license is granted by a Contributor: (a) for any ..."），
 * 但它同时明文授予了专利许可。把局部排除当成整体拒绝会造成误判——
 * 这是实测 MPL-2.0 时发现的坑。
 */
const PATENT_DENY_MARKERS = [
  /does not grant.{0,60}patent/i,
  /expressly.{0,20}(?:no|not).{0,30}patent/i,
  /(?:no|not).{0,40}patent.{0,60}(?:granted|are granted|is granted)/i,
  /patent rights are (?:not|never) granted/i,
];

/** 明确的整体拒绝表述（全大写句式，如 Clear BSD）单独匹配，避免和小写局部限制混淆 */
const PATENT_DENY_UPPER = [/NO EXPRESS OR IMPLIED LICENSES TO ANY PARTY'S PATENT RIGHTS ARE GRANTED/i];

const TRADEMARK_MARKERS = [/trademark/i, /trade name/i, /service mark/i];

const STATE_CHANGE_MARKERS = [
  /must carry prominent notices stating that you (?:modified|changed)/i,
  /state (?:the )?changes/i,
  /indicate if changes were made/i,
  /mark.{0,30}(?:as |the )?(?:modified|changed)/i,
  /must inform.{0,120}modif/i,
  /notify.{0,60}(?:that|of).{0,40}modif/i,
];

/**
 * 「不得用作者名义背书 / 促销」的正文特征。
 *
 * 这是 BSD-3-Clause 第 3 条那一类，而且**两个动词要分开判**：
 *  - 背书（endorse）：拿别人的名义表示"他认可/推荐你的产品"
 *  - 促销（promote）：拿别人的名义为你的产品吸引流量
 * 实测 234 个许可两者都禁、7 个只禁背书、106 个只禁促销——
 * 合成一个值会让这 113 个的结论失真。
 *
 * **判据以"名字 + 动词"同现为准，而不是只数动词出现次数**：
 * 正文里出现 `promote` 字样未必是在禁这件事（可能是"promotes the progress of…"
 * 这类无关表述）。因此六条规则都要求句子里同时有"名字/名义"与那个动词。
 *
 * ⚠️ 这里踩过两个坑，改规则时留意：
 *  1. 窗口不能太窄。AAL 写的是 `Neither the name nor any trademark of the Author
 *     may be used to endorse or promote`——`name` 与 `endorse` 之间隔了 26 个字符，
 *     塞得下；但若把窗口压到很短（曾用过 60），这类写法会漏判。
 *  2. 并列短语要单独认。`endorse or promote` / `endorse and promote` 一出现，
 *     说明**两者都被禁**。实测有 341 个许可用了这种并列写法，早期规则漏判了其中 105 个
 *     （AAL、AFL 全系列、APSL…），把它们错标成"只禁促销"。
 *
 * **必须与商标条款区分开**：Apache-2.0 的 §6 讲的是不能用人家的商品名，
 * 它并不禁止背书/促销；把两者混起来会把 Apache-2.0 判错。
 */
const NAME_THEN = (verb: string) => [
  // "Neither the name (of X) nor … may be used to <verb>"
  new RegExp(`neither the name[^.]{0,200}${verb}`, 'i'),
  // "the names of its contributors … may be used to <verb>"
  new RegExp(`names? of[^.]{0,160}${verb}`, 'i'),
  // "may not be used to <verb>"
  new RegExp(`may (?:not|not be) be? ?used to ${verb}`, 'i'),
  // "the name … is not used to <verb>"
  new RegExp(`name[^.]{0,80}not[^.]{0,50}used to ${verb}`, 'i'),
];

const ENDORSE_MARKERS = [
  ...NAME_THEN('endorse'),
  // 并列写法：一出现就说明两者都被禁
  /endorse\s*[,/]?\s*(?:or|and)\s*promote/i,
];

const PROMOTE_MARKERS = [
  ...NAME_THEN('promote'),
  /endorse\s*[,/]?\s*(?:or|and)\s*promote/i,
  /promote[^.]{0,90}without (?:specific )?(?:prior )?written permission/i,
];

/**
 * 「必须附上版权声明与许可证全文」的正文特征。
 *
 * 刻意让"保留/附上"这个动作与"版权/声明/许可证"这个对象**同时出现在一句里**，
 * 否则会把无关的 must 也算进来（例如"不得再分发"之类）。
 *
 * 动词刻意列得很宽：这类条款的措辞非常发散，实测
 * "must conspicuously display, without modification, this License and the notice"
 * （Anti-996）用的就是 display，而 retain / reproduce / include / keep 都不命中。
 * 长尾许可证只能这样判，因此结果一律标注为正文推断。
 */
const INCLUDE_COPYRIGHT_VERBS =
  'retain|reproduce|include|keep|display|attach|provide|accompany|furnish|give|be\\s+included|be\\s+reproduced|be\\s+kept';

const INCLUDE_COPYRIGHT_MARKERS = [
  new RegExp(`must\\s+(?:[a-z]+ly\\s+)?(?:${INCLUDE_COPYRIGHT_VERBS})[^.]{0,90}(?:copyright|notice|licen[cs]e)`, 'i'),
  new RegExp(`shall\\s+(?:be\\s+)?(?:${INCLUDE_COPYRIGHT_VERBS})[^.]{0,90}(?:copyright|notice)`, 'i'),
  /(?:retain|reproduce|include|keep|display)\s+the\s+above\s+copyright/i,
  /(?:copyright|notice|licen[cs]e)[^.]{0,70}must\s+be\s+included/i,
  /above\s+copyright\s+notice\s+and\s+this\s+permission\s+notice/i,
  // "…shall be included in all copies…"——对象常写成 Software 而不是 notice
  /shall\s+be\s+included\s+in\s+all\s+copies/i,
];

/** 从 SPDX 标识符本身就能看出的家族信息（比文本匹配更可靠，优先使用） */
function familyFromId(id: string): Family | null {
  if (/^(A|L)?GPL-/.test(id)) {
    if (/^AGPL-/.test(id)) return 'network-copyleft';
    if (/^LGPL-/.test(id)) return 'weak-copyleft';
    return 'strong-copyleft';
  }
  if (/^(MPL|EPL|CDDL|CPL|EUPL-1\.[01]|CeCILL-C)/.test(id)) return 'weak-copyleft';
  if (/^(EUPL|CECILL-[12])/.test(id)) return 'strong-copyleft';
  if (/^(CC0|Unlicense|WTFPL|0BSD|CC-PDDC|CC-PDM)/.test(id)) return 'public-domain';
  if (/^CC-BY/.test(id)) return 'content';
  if (/^(CERN-OHL|TAPR-OHL|Solderpad)/.test(id)) return 'strong-copyleft';
  return null;
}

/**
 * 推断条款事实。
 *
 * 家族判定的优先级（越靠前越权威）：
 *   1. `categoryFamily` —— ScanCode LicenseDB 的粗分类（覆盖 98% 的 SPDX 许可证）。
 *      它是第三方人工策展的结果，比正则可靠得多，但仍不是法律认定。
 *   2. SPDX 标识符前缀 —— 例如 `GPL-*` 一定是强著佐权。
 *   3. 正文关键词 —— 只在前两者都拿不到时使用（约 1% 的条目）。
 */
export function deriveFacts(
  id: string,
  licenseText: string,
  osiApproved: boolean,
  categoryFamily?: string,
  chooseALicense?: ChooseALicenseTerms | null,
): DerivedFacts {
  const t = licenseText;

  let family: Family;
  let familySource: DerivedFacts['familySource'];

  const fromCategory = categoryFamily && categoryFamily !== 'unknown' ? (categoryFamily as Family) : null;
  const fromId = familyFromId(id);

  if (fromCategory) {
    family = fromCategory;
    familySource = 'scancode-category';
  } else if (fromId) {
    family = fromId;
    familySource = 'spdx-id';
  } else {
    // 两者都拿不到时才退回文本匹配。`GPL-3.0-only` 的正文里并没有稳定的
    // "copyleft" 关键词（实际用的是 "The work must carry prominent notices..."），
    // 所以文本匹配只作为最后手段。
    const perFileText = PER_FILE_MARKERS.some((re) => re.test(t));
    const wholeText = WHOLE_WORK_MARKERS.some((re) => re.test(t));
    const networkText = NETWORK_MARKERS.some((re) => re.test(t));
    family = perFileText
      ? 'weak-copyleft'
      : wholeText
        ? networkText
          ? 'network-copyleft'
          : 'strong-copyleft'
        : 'permissive';
    familySource = 'text';
  }

  // 网络触发：先看人工标注（ChooseALicense 覆盖的 47 个里只有 4 个是真网络条款），
  // 再退到正文匹配。分类里没有这个维度，而 AGPL 与 GPL 在 ScanCode 里同属 copyleft 大类。
  const cal = lookupTerms(chooseALicense, id);
  const networkTrigger = cal ? cal.derived.networkTrigger : NETWORK_MARKERS.some((re) => re.test(t));
  if (networkTrigger && family === 'strong-copyleft') family = 'network-copyleft';

  const perFileFamily = family === 'weak-copyleft';
  const wholeWorkFamily = family === 'strong-copyleft' || family === 'network-copyleft';

  /*
   * 条款字段：有 ChooseALicense 的人工标注就直接用它，没有才回落到正则推断。
   * 这是本合同项目里唯一能把"猜"升级为"查"的地方，因此优先级的处理必须明确。
   * 注意上游的 `patent-use` 在 permissions 与 limitations 里同名反义，
   * 那一步的区分在 fetch-choosealicense.mjs 里完成（分别落到 explicit / none）。
   */
  let patentGrant: DerivedFacts['patentGrant'];
  let trademarkClause: boolean;
  let stateChanges: boolean;
  let sameLicenseWholeWork: boolean;
  let sameLicensePerFile: boolean;
  const termsSource: DerivedFacts['termsSource'] = cal ? 'choosealicense' : 'text';

  if (cal) {
    patentGrant = cal.derived.patentGrant;
    trademarkClause = cal.derived.trademarkClause;
    stateChanges = cal.derived.stateChanges;
    // 上游的 same-license--library（库场景的弱著佐权）在本项目里归入文件级/库级，
    // 与 same-license--file 一样都属于"不要求整部作品同许可"。
    sameLicenseWholeWork = cal.derived.sameLicenseWholeWork;
    sameLicensePerFile = cal.derived.sameLicensePerFile || cal.derived.sameLicenseLibrary;
  } else {
    // 先判"明确不授权"，再判"授权"：BSD-3-Clause-Clear 的正文里同时出现
    // "PATENT RIGHTS ARE GRANTED"（否定句里的一部分）与授权类关键词，
    // 顺序反了就会把明确拒绝判成明确授权。
    patentGrant = 'silent';
    if (PATENT_DENY_UPPER.some((re) => re.test(t)) || PATENT_DENY_MARKERS.some((re) => re.test(t))) {
      patentGrant = 'none';
    } else if (PATENT_GRANT_MARKERS.some((re) => re.test(t))) {
      patentGrant = 'explicit';
    }
    trademarkClause = TRADEMARK_MARKERS.some((re) => re.test(t));
    stateChanges = STATE_CHANGE_MARKERS.some((re) => re.test(t));
    sameLicenseWholeWork = wholeWorkFamily;
    sameLicensePerFile = perFileFamily;
  }

  /*
   * 要不要随分发附上版权声明与许可证全文。
   *
   * 这是最基础的义务（几乎每份许可都要求），但**五个许可明确不要求**：
   * 0BSD、CC0-1.0、MIT-0、Unlicense、WTFPL——它们连署名都不要求。
   * 另有 BSL-1.0 与 Zlib 只要求在源码形式里保留，二进制分发不必。
   * 这个区分对使用者很重要，所以单独作为一条呈现，而不是笼统说"都要保留"。
   */
  let includeCopyright: DerivedFacts['includeCopyright'];
  if (cal) {
    includeCopyright = cal.derived.includeCopyright
      ? 'required'
      : cal.derived.includeCopyrightSourceOnly
        ? 'source-only'
        : 'not-required';
  } else {
    // 长尾条目只能读正文。只用"版权/声明 + 必须保留"同时出现的句式，
    // 避免把"不得再分发"这类无关的 must 也算进来。
    includeCopyright = INCLUDE_COPYRIGHT_MARKERS.some((re) => re.test(t)) ? 'required' : 'silent';
  }

  return {
    family,
    familySource,
    patentGrant,
    trademarkClause,
    stateChanges,
    sameLicenseWholeWork,
    sameLicensePerFile,
    networkTrigger,
    includeCopyright,
    // 背书与促销分开判：条款里常分开写，合成一个值会让"只禁其中一项"的许可失真
    endorse: ENDORSE_MARKERS.some((re) => re.test(t)) ? 'prohibited' : 'silent',
    promote: PROMOTE_MARKERS.some((re) => re.test(t)) ? 'prohibited' : 'silent',
    termsSource,
    inferred: true,
  };
}

/** 统计信息，用于界面展示"收录了多少" */
export function catalogStats(snapshot: SpdxSnapshot) {
  return {
    licenses: snapshot.licenses.length,
    active: snapshot.licenses.filter((l) => !l.deprecated).length,
    deprecated: snapshot.licenses.filter((l) => l.deprecated).length,
    osiApproved: snapshot.licenses.filter((l) => l.osiApproved).length,
    fsfLibre: snapshot.licenses.filter((l) => l.fsfLibre).length,
    withOfficialHeader: snapshot.licenses.filter((l) => l.hasOfficialHeader).length,
    exceptions: snapshot.exceptions.length,
    version: snapshot.licenseListVersion,
  };
}

/** 搜索：按标识符、名称匹配，标识符前缀命中优先 */
export function searchCatalog(snapshot: SpdxSnapshot, query: string, limit = 300): CatalogLicense[] {
  const q = query.trim().toLowerCase();
  if (!q) return snapshot.licenses.slice(0, limit);
  const starts: CatalogLicense[] = [];
  const contains: CatalogLicense[] = [];
  for (const l of snapshot.licenses) {
    const id = l.id.toLowerCase();
    const name = l.name.toLowerCase();
    // 完全相同的标识符优先返回，但**不能提前 return**：像 `GPL-3.0-only` 这种查询
    // 本身也是 `GPL-3.0` 的前缀，提前返回会把用户真正想找的长标识符挡掉。
    if (id === q) starts.unshift(l);
    else if (id.startsWith(q)) starts.push(l);
    else if (id.includes(q) || name.includes(q)) contains.push(l);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** 按 SPDX 标识符的常见族前缀归类，用于"按类别分"的浏览体验 */
export const ID_PREFIX_GROUPS: { label: { zh: string; en: string }; test: (id: string) => boolean }[] = [
  { label: { zh: 'MIT 家族', en: 'MIT family' }, test: (id) => /^MIT/.test(id) },
  { label: { zh: 'Apache 家族', en: 'Apache family' }, test: (id) => /^Apache/.test(id) },
  { label: { zh: 'BSD 家族', en: 'BSD family' }, test: (id) => /^BSD|^0BSD/.test(id) },
  { label: { zh: 'GNU GPL 家族', en: 'GNU GPL family' }, test: (id) => /^(A|L)?GPL/.test(id) },
  { label: { zh: 'Mozilla / Eclipse / CDDL', en: 'Mozilla, Eclipse, CDDL' }, test: (id) => /^(MPL|EPL|CDDL|CPL)/.test(id) },
  { label: { zh: 'Creative Commons', en: 'Creative Commons' }, test: (id) => /^CC/.test(id) },
  { label: { zh: '欧盟 / 法国政府', en: 'EU and French public' }, test: (id) => /^(EUPL|CECILL)/.test(id) },
  { label: { zh: '开源硬件', en: 'Open hardware' }, test: (id) => /OHL|^TAPR|Solderpad/.test(id) },
  { label: { zh: '字体', en: 'Fonts' }, test: (id) => /^(OFL|Ubuntu-font|Bitstream|Arphic|Baekmuk|IPA|LPPL)/.test(id) },
  { label: { zh: '中国主导', en: 'China-led' }, test: (id) => /^Mulan/.test(id) },
];
