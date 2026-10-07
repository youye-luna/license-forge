import { hasCopyrightPlaceholder } from './fill.ts';
import { LICENSE_BY_ID } from './licenses.ts';
import {
  deriveFacts,
  isNonOpenCategory,
  lookupTerms,
  SCANCODE_FAMILY,
  type CatalogLicense,
  type ChineseTextSource,
  type ChooseALicenseTerms,
  type DerivedFacts,
  type EnrichmentRecord,
  type LicenseText,
  type SpdxSnapshot,
} from './spdx.ts';
import type { Family, FillKind, HeaderStyle, LicenseEntry, LicenseFacts } from './types.ts';

/**
 * 统一许可证规格（LicenseSpec）。
 *
 * 站点收录 SPDX 全量许可证，但只有少数做了人工整理的条款字段与双语解读。
 * 与其假装全量都懂，不如把两者明确分层，并让界面把差别告诉用户：
 *
 *  - `curated`：人工整理。条款字段、双语的「你得到什么 / 你放弃什么 / 常见误解」都可信。
 *  - `derived`：从许可证正文推断。只用于展示与基本判定，界面上必须标注"文本推断"。
 *
 * 关键差别在**文件头策略**，因为这直接决定生成进用户仓库的内容：
 *  1. `spdx-official`：SPDX 官方数据自带 standardLicenseHeader（93 个许可证有），
 *     这是权威措辞，且精确区分 `-only` / `-or-later`。优先使用。
 *  2. `gnu-boilerplate`：GNU 家族中官方数据没给模板、但许可证正文自带 "How to Apply" 示例段的情况。
 *  3. `spdx-tag`：其余情况。许可证没有官方头模板，我们**不自造法律措辞**，
 *     只给 SPDX / REUSE 推荐的两行式。
 */

export type HeaderStrategy = 'spdx-official' | 'gnu-boilerplate' | 'spdx-tag';

export interface LicenseSpec {
  id: string;
  name: string;
  /** SPDX 页面地址，用于"文本来源可核查" */
  sourceUrl: string;
  deprecated: boolean;
  osiApproved: boolean;
  fsfLibre: boolean;
  family: Family;
  fill: FillKind;
  headerStrategy: HeaderStrategy;
  /** 官方头模板原文（仅 spdx-official 有） */
  officialHeader?: string;
  /** 该许可证是否必须随附 NOTICE（目前只有人工整理能确定） */
  requiresNotice: boolean;
  /** 与许可证一起使用的例外（`WITH` 表达式） */
  exceptionId?: string;
  exceptionName?: string;
  /** 正文文件名惯例 */
  fileName: string;
  /** 已知的条款事实 */
  facts: LicenseFacts;
  /** facts 是否为推断所得 */
  factsInferred: boolean;
  /** 家族判定的依据来源，界面上要如实交代 */
  familySource?: 'scancode-category' | 'spdx-id' | 'text';
  /** 条款字段的来源：人工标注（ChooseALicense）还是正则推断 */
  termsSource?: 'choosealicense' | 'text';
  /** 人工整理的条目（含双语解读与常见误解） */
  curated: LicenseEntry | null;

  /* ---- 以下来自第三方补充数据（ScanCode LicenseDB / OSI API） ---- */
  /** ScanCode 的粗分类原文，例如 "Copyleft Limited" */
  category?: string;
  /** 分类来自哪一家，用于界面上标注出处 */
  categorySource?: string;
  /** 分类是通过历史 SPDX 标识符回填的，需向用户交代 */
  scancodeMatchedVia?: string;
  /** 许可证的原始归属方（ScanCode 的 owner 字段） */
  owner?: string;
  homepage?: string;
  /** OSI 官方 API 的标签（superseded / non-reusable 等） */
  osiKeywords?: string[];
  osiApprovedDate?: string;
  /** OSADL 的 copyleft 判定：No / Yes / Yes (restricted) / Questionable */
  copyleft?: string;
  /** OSADL 的源码披露义务 */
  sourceDisclosure?: string;
  /** 中文文本来源（审定稿或官方中文正文） */
  chinese?: ChineseTextSource;
  /** ScanCode 分类判定为非开源 */
  nonOpen?: boolean;
  /** 该条目不在 SPDX 列表内（ScanCode 独有），清单字段不能直接写它 */
  nonSpdx?: boolean;
  /** ScanCode 的 license key（非 SPDX 条目才有） */
  scancodeKey?: string;
  /** SPDX 文档里的 LicenseRef 写法（非 SPDX 条目才有） */
  licenseRef?: string;
}

/** 人工整理的许可证所用的文件名惯例 */
function fileNameForCurated(entry: LicenseEntry): string {
  return entry.fileName;
}

function safeFamily(f: string): Family {
  return f as Family;
}

/**
 * 由人工整理的条目构造规格。
 *
 * 条款字段仍以人工整理为准（那是逐条核对的），但需要**如实标注来源**：
 * 如果这个许可证也在 ChooseALicense 的 47 个标注范围内，两套数据互相印证，
 * 界面就可以给出比"推断"更高的置信度。
 */
function fromCurated(
  entry: LicenseEntry,
  text: LicenseText | undefined,
  enrichment?: EnrichmentRecord,
  terms?: ChooseALicenseTerms | null,
): LicenseSpec {
  const official = text?.standardLicenseHeader;
  // GNU 家族的官方头在 SPDX 数据里其实是全的；只有数据缺失时才回落到本地措辞
  const headerStrategy: HeaderStrategy = official
    ? 'spdx-official'
    : entry.headerStyle === 'official-boilerplate'
      ? 'gnu-boilerplate'
      : 'spdx-tag';
  const cal = lookupTerms(terms, entry.id);
  return {
    id: entry.id,
    name: entry.name,
    sourceUrl: text?.url ?? `https://spdx.org/licenses/${entry.id}.html`,
    deprecated: Boolean(text?.deprecated),
    osiApproved: entry.facts.osiApproved,
    fsfLibre: false,
    family: entry.family,
    fill: entry.fill,
    headerStrategy,
    officialHeader: official,
    requiresNotice: entry.requiresNotice,
    fileName: fileNameForCurated(entry),
    facts: entry.facts,
    factsInferred: false,
    // 人工整理的家族判定不来自第三方分类，如实标注
    familySource: 'spdx-id',
    // 在 ChooseALicense 标注范围内时，条款字段有第二份独立来源印证
    termsSource: cal ? 'choosealicense' : 'text',
    curated: entry,
    // 第三方补充数据一律透传：人工整理只覆盖条款解读，
    // 分类 / 义务判定 / 中文来源这些来自外部，必须照搬而不是丢掉。
    category: enrichment?.category,
    categorySource: enrichment?.category ? 'ScanCode LicenseDB' : undefined,
    scancodeMatchedVia: enrichment?.scancodeMatchedVia,
    owner: enrichment?.owner,
    homepage: enrichment?.homepage,
    osiKeywords: enrichment?.osiKeywords,
    osiApprovedDate: enrichment?.osiApprovedDate,
    copyleft: enrichment?.copyleft,
    sourceDisclosure: enrichment?.sourceDisclosure,
    chinese: enrichment?.chinese,
    nonOpen: isNonOpenCategory(enrichment?.category),
  };
}

/** 由 SPDX 目录 + 多源补充数据 + 正文推断出规格 */
export function fromCatalog(
  item: CatalogLicense,
  text: LicenseText | undefined,
  enrichment?: EnrichmentRecord,
  terms?: ChooseALicenseTerms | null,
): LicenseSpec {
  const entry = LICENSE_BY_ID[item.id];
  if (entry) return fromCurated(entry, text, enrichment, terms);

  const raw = text?.licenseText ?? '';
  // 家族优先取 ScanCode 的权威分类，条款字段优先取 ChooseALicense 的人工标注，
  // 两者都拿不到才回落到正文正则推断
  const facts: DerivedFacts = deriveFacts(item.id, raw, item.osiApproved, enrichment?.family, terms);
  const hasOfficialHeader = Boolean(text?.standardLicenseHeader);

  // GNU 惯例：GPL 家族用 COPYING，LGPL 另存 COPYING.LESSER，其余用 LICENSE
  const fileName = /^AGPL-|^GPL-/.test(item.id) ? 'COPYING' : /^LGPL-/.test(item.id) ? 'COPYING.LESSER' : 'LICENSE';

  return {
    id: item.id,
    name: text?.name ?? item.name,
    sourceUrl: text?.url ?? `https://spdx.org/licenses/${encodeURIComponent(item.id)}.html`,
    deprecated: item.deprecated,
    osiApproved: item.osiApproved,
    fsfLibre: item.fsfLibre,
    family: safeFamily(facts.family),
    // 正文里带版权占位符的许可证，其正文本身就是"待填"的；其余保持逐字原样。
    // 判定共用 fill.ts 里那套限定在版权行区域内的探测（避免被免责声明里的大写词误伤）。
    fill: hasCopyrightPlaceholder(raw) ? 'copyright-line' : 'metadata-only',
    headerStrategy: hasOfficialHeader ? 'spdx-official' : 'spdx-tag',
    officialHeader: text?.standardLicenseHeader,
    // 长尾许可证的 NOTICE 义务需要逐条读条款才能确定，这里一律不声称"必须"，
    // 只作为可选项提供，避免给出没有依据的强制结论。
    requiresNotice: false,
    fileName,
    facts: {
      // 整体透传 deriveFacts 的结论，**不要在这里逐个手挑字段**。
      // 曾经是手挑的，结果新增 endorsement 时漏掉一列，详情面板永远显示
      // "正文没写"——而 resolveSpec 之外的路径却是对的，很难察觉。
      // 只有下面两项是这里独有的（deriveFacts 不管这两个）。
      ...facts,
      osiApproved: item.osiApproved,
      irrevocable: !/revocable|may be revoked/i.test(raw),
    },
    factsInferred: true,
    familySource: facts.familySource,
    termsSource: facts.termsSource,
    curated: null,
    // 第三方补充数据，用于界面展示"分类来自哪一家"与"是否非开源/已被取代"
    category: enrichment?.category,
    categorySource: enrichment?.category ? 'ScanCode LicenseDB' : undefined,
    scancodeMatchedVia: enrichment?.scancodeMatchedVia,
    owner: enrichment?.owner,
    homepage: enrichment?.homepage,
    osiKeywords: enrichment?.osiKeywords,
    osiApprovedDate: enrichment?.osiApprovedDate,
    copyleft: enrichment?.copyleft,
    sourceDisclosure: enrichment?.sourceDisclosure,
    chinese: enrichment?.chinese,
    nonOpen: isNonOpenCategory(enrichment?.category),
  };
}

/**
 * 由 ScanCode 独有的条目（非 SPDX 许可证）构造规格。
 *
 * 这类条目的定位与 SPDX 许可证不同，必须区别对待：
 *  - 没有 SPDX 标识符，`spdx_license_key` 是 `LicenseRef-scancode-<key>`；
 *    这个字面量**不能**写进 package.json 的 license 字段，只能用在 SPDX 文档里。
 *  - 拿不到 OSI/FSF 认证结论，也不声称 NOTICE 义务。
 *  - 正文一律逐字保留：这些文本没有经过 SPDX 式的字段规范，任何"填充"都可能是篡改。
 */
export function fromScancodeEntry(
  entry: {
    key: string;
    name: string;
    longName?: string;
    category: string;
    spdxLicenseKey?: string;
    deprecated: boolean;
    textLength: number;
  },
  rawText: string,
  enrichment?: EnrichmentRecord,
  terms?: ChooseALicenseTerms | null,
): LicenseSpec {
  const facts = deriveFacts(
    entry.key,
    rawText,
    false,
    // 分类 → 家族的映射只有一份，放在 spdx.ts 里，避免两份副本走偏
    SCANCODE_FAMILY[entry.category],
    terms,
  );
  const licenseRef = entry.spdxLicenseKey?.startsWith('LicenseRef')
    ? entry.spdxLicenseKey
    : `LicenseRef-scancode-${entry.key}`;

  return {
    id: licenseRef,
    name: entry.longName ?? entry.name ?? entry.key,
    sourceUrl: `https://scancode-licensedb.aboutcode.org/${entry.key}.html`,
    deprecated: entry.deprecated,
    osiApproved: false,
    fsfLibre: false,
    family: safeFamily(facts.family),
    fill: 'metadata-only',
    headerStrategy: 'spdx-tag',
    requiresNotice: false,
    fileName: 'LICENSE',
    facts: {
      // 同 fromCatalog：整体透传，避免新增维度时又漏掉一列
      ...facts,
      osiApproved: false,
      irrevocable: !/revocable|may be revoked/i.test(rawText),
    },
    factsInferred: true,
    familySource: facts.familySource,
    termsSource: facts.termsSource,
    curated: null,
    // 非 SPDX 归属：界面据此给出"不能写进清单字段"的提示
    nonSpdx: true,
    scancodeKey: entry.key,
    licenseRef,
    category: entry.category,
    categorySource: 'ScanCode LicenseDB',
    owner: enrichment?.owner,
    nonOpen: isNonOpenCategory(entry.category),
  };
}

/** 解析器：目录 + 正文 + 第三方补充 + 可选例外 → 统一规格 */
export function resolveSpec(
  id: string,
  snapshot: SpdxSnapshot | null,
  texts: { licenses: Record<string, LicenseText>; exceptions: Record<string, { name: string }> } | null,
  exceptionId?: string,
  enrichment?: Record<string, EnrichmentRecord>,
  terms?: ChooseALicenseTerms | null,
): LicenseSpec | null {
  const text = texts?.licenses[id];
  const catalogItem = snapshot?.licenses.find((l) => l.id === id);
  const extra = enrichment?.[id];

  let spec: LicenseSpec | null = null;
  if (catalogItem) spec = fromCatalog(catalogItem, text, extra, terms);
  else if (text) {
    // 快照里没有但正文有（例如手动注入）——照样构造一个规格
    spec = fromCatalog(
      {
        id,
        name: text.name,
        deprecated: Boolean(text.deprecated),
        osiApproved: Boolean(text.osiApproved),
        fsfLibre: false,
        hasText: true,
        textLength: text.licenseText.length,
        hasOfficialHeader: Boolean(text.standardLicenseHeader),
        seeAlso: [],
      },
      text,
      extra,
      terms,
    );
  } else {
    // 人工整理的许可证即使正文还没加载出来也要能展示
    const entry = LICENSE_BY_ID[id];
    if (entry) spec = fromCurated(entry, undefined, extra, terms);
  }

  if (spec && exceptionId && texts?.exceptions[exceptionId]) {
    spec = { ...spec, exceptionId, exceptionName: texts.exceptions[exceptionId].name };
  }
  return spec;
}

/** 带例外的完整 SPDX 表达式，例如 `GPL-2.0-only WITH Classpath-exception-2.0` */
export function expressionOf(spec: LicenseSpec): string {
  return spec.exceptionId ? `${spec.id} WITH ${spec.exceptionId}` : spec.id;
}

/** 人工整理（有完整条款字段与双语解读）的许可证数量，用于界面说明覆盖范围 */
export function curatedCount(): number {
  return Object.keys(LICENSE_BY_ID).length;
}
