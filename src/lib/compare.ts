import { FAMILY_LABEL, LICENSE_BY_ID } from './licenses.ts';
import {
  deriveFacts,
  familyFromEntry,
  isNonOpenCategory,
  type ChooseALicenseTerms,
  type EnrichmentRecord,
  type UnifiedEntry,
} from './spdx.ts';
import type { Lang } from './types.ts';

/**
 * 对比用的数据模型与维度定义。
 *
 * 放在不依赖 React 的纯模块里有两个理由：
 *  1. **对比矩阵与对比工作台必须共用同一份定义**。两边各写一套的话，
 *     "矩阵里是一套、工作台里是另一套"会比没有对比更糟；共用才能保证口径一致。
 *  2. 可以被测试直接断言（Node 加载不了 .tsx）。
 */

export interface CompareFacts {
  id: string;
  displayId: string;
  name: string;
  source: 'spdx' | 'scancode';
  family: string;
  facts: {
    patentGrant: 'explicit' | 'none' | 'silent';
    trademarkClause: boolean;
    stateChanges: boolean;
    networkTrigger: boolean;
    sameLicenseWholeWork: boolean;
    sameLicensePerFile: boolean;
    osiApproved: boolean;
    requiresNotice: boolean;
  };
  /** 条款字段的来源：`choosealicense` 表示人工核对/标注，`text` 表示正文推断 */
  termsSource: 'choosealicense' | 'text';
  hasOfficialHeader: boolean;
  copyleft?: string;
  sourceDisclosure?: string;
  category?: string;
  /** 许可证的原始归属方（ScanCode 的 owner 字段），例如 "COSCL - China Open Source Cloud League" */
  owner?: string;
  /** ScanCode 独有条目的官方主页 */
  homepage?: string;
  nonOpen: boolean;
  deprecated: boolean;
}

/**
 * 从一个条目解析出对比用的事实。
 *
 * `licenseText` 可以缺失：有 ChooseALicense 人工标注的条目条款是查表得来的，
 * 不必为了推断去下载正文。这让矩阵能"先渲染、后补正文"，而不是卡在下载上。
 */
export function factsOf(
  entry: UnifiedEntry,
  extra: EnrichmentRecord | undefined,
  terms: ChooseALicenseTerms | null,
  licenseText: string | undefined,
): CompareFacts {
  const key = entry.source === 'spdx' ? entry.id : (entry.scancodeKey ?? '');
  // 家族优先取 enrichment；ScanCode 独有条目在 enrichment 里没有记录（它只覆盖 SPDX 列表），
  // 因此必须退回条目自带的分类，否则会被默认成 permissive——木兰公共型就被这样误判过。
  const facts = deriveFacts(key, licenseText ?? '', entry.osiApproved, familyFromEntry(entry, extra), terms);
  // 人工整理的条目条款是逐条核对的，比推断更可信
  const curated = entry.source === 'spdx' ? LICENSE_BY_ID[entry.id] : undefined;
  return {
    id: entry.id,
    displayId: key,
    name: entry.name,
    source: entry.source,
    family: facts.family,
    facts: {
      patentGrant: facts.patentGrant,
      trademarkClause: facts.trademarkClause,
      stateChanges: facts.stateChanges,
      networkTrigger: facts.networkTrigger,
      sameLicenseWholeWork: facts.sameLicenseWholeWork,
      sameLicensePerFile: facts.sameLicensePerFile,
      osiApproved: entry.osiApproved,
      requiresNotice: curated ? curated.requiresNotice : false,
    },
    termsSource: curated || facts.termsSource === 'choosealicense' ? 'choosealicense' : 'text',
    hasOfficialHeader: entry.hasOfficialHeader,
    copyleft: extra?.copyleft,
    sourceDisclosure: extra?.sourceDisclosure,
    category: entry.category ?? extra?.category,
    // ScanCode 独有条目的归属方在条目自身上（enrichment 不覆盖它们）；
    // SPDX 条目则从 enrichment 取
    owner: entry.owner ?? extra?.owner,
    homepage: entry.homepage ?? extra?.homepage,
    nonOpen: isNonOpenCategory(entry.category ?? extra?.category),
    deprecated: entry.deprecated,
  };
}

/** 「允许闭源衍生」的判定：宽松型 / 公共领域 / 内容类，以及文件级著佐权 */
export function allowsClosedSource(r: CompareFacts): boolean {
  return (
    r.family === 'permissive' ||
    r.family === 'public-domain' ||
    r.family === 'content' ||
    r.facts.sameLicensePerFile
  );
}

/**
 * 为没有人工简介的许可证**生成**一段中文/英文简介。
 *
 * 数据全部来自已核实的字段（家族、专利判定、归属方、来源），
 * 不编造许可证没有写过的内容；每句话都能在条款或元数据里找到依据。
 * 人工整理的 32 个许可证不经过这里——它们有手写的 tagline，措辞更有观点。
 */
export function generatedIntro(r: CompareFacts, lang: Lang): string {
  const zh = lang === 'zh';
  const parts: string[] = [];

  /* ---- 1. 家族定位（开头一句必须回答"这是什么类型的许可"） ---- */
  if (r.nonOpen) {
    parts.push(
      zh
        ? '这不是一份开源许可证：它对使用、修改或再分发设有专门限制，采用前请逐条确认这些限制对你的项目意味着什么。'
        : 'This is not an open-source license: it restricts use, modification or redistribution in specific ways. Read every clause before adopting it.',
    );
  } else {
    const familyOpeners: Record<string, { zh: string; en: string }> = {
      permissive: {
        zh: '这是一份宽松型许可证：允许商用、修改与闭源再分发，条件极少。',
        en: 'A permissive license: commercial use, modification and closed-source redistribution are allowed, with very few conditions.',
      },
      'weak-copyleft': {
        zh: '这是一份弱著佐权许可证：被修改的文件必须保持同许可，但整个作品仍可以闭源。',
        en: 'A weak-copyleft license: modified files must stay under the same license, while the larger work may remain closed.',
      },
      'strong-copyleft': {
        zh: '这是一份强著佐权许可证：基于它的衍生作品整体必须以同一许可开源。',
        en: 'A strong-copyleft license: derivative works as a whole must be released under the same license.',
      },
      'network-copyleft': {
        zh: '这是一份网络著佐权许可证：把代码跑成在线服务也必须开放源码——这是它与普通强著佐权的关键差别。',
        en: 'A network-copyleft license: running the code as an online service also requires releasing source — the key difference from ordinary strong copyleft.',
      },
      'public-domain': {
        zh: '这份文本把作品放入公共领域：作者不保留任何权利，使用者零负担。',
        en: 'This text dedicates the work to the public domain: the author keeps no rights and users carry no obligations.',
      },
      content: {
        zh: '这是一份内容/数据类许可证：适用于文档、图片与数据集——Creative Commons 官方不建议将其用于软件。',
        en: 'A content/data license for docs, images and datasets — Creative Commons itself advises against using it for software.',
      },
    };
    parts.push((familyOpeners[r.family] ?? {
      zh: '这份条款的类别尚不明确，采用前请通读正文。',
      en: 'The nature of these terms is unclear; read the full text before adopting them.',
    })[lang]);
  }

  /* ---- 2. 专利（企业法务最先看的一条） ---- */
  if (r.facts.patentGrant === 'explicit') {
    parts.push(zh ? '它明确授予专利许可。' : 'It grants patent rights explicitly.');
  } else if (r.facts.patentGrant === 'none') {
    parts.push(zh ? '它明确不授予专利许可——想保留专利主张时选这一类。' : 'It explicitly grants no patent rights — relevant when you want to reserve patent claims.');
  }

  /* ---- 3. 网络触发（只有少数许可有，值得单独说） ---- */
  if (r.facts.networkTrigger) {
    parts.push(zh ? '通过网络提供服务也会触发开源义务。' : 'Providing it as a network service also triggers the open-source obligations.');
  }

  /* ---- 4. 归属方（谁家的许可证，用户经常想知道） ---- */
  if (r.owner) {
    parts.push(zh ? `由 ${r.owner} 发布。` : `Published by ${r.owner}.`);
  }

  /* ---- 5. 来源与可用性（决定"接下来能拿它做什么"） ---- */
  if (r.source === 'scancode') {
    parts.push(
      zh
        ? `正文由 ScanCode LicenseDB 收录；它在 SPDX 文档里的写法是 ${r.displayId}（LicenseRef），不能填进 package.json 的 license 字段。`
        : `The text is curated in ScanCode LicenseDB; in SPDX documents it is written as ${r.displayId} (a LicenseRef), which cannot go into a package.json license field.`,
    );
  } else {
    parts.push(
      zh
        ? '正文来自 SPDX License List，标识符可用于包管理器清单。'
        : 'The text comes from the SPDX License List and its identifier is valid for package manifests.',
    );
  }

  /* ---- 6. 废弃提示（历史项目需要，但新项目该知道） ---- */
  if (r.deprecated) {
    parts.push(zh ? '注意：SPDX 已将其标记为废弃标识符，新项目建议改用现行写法。' : 'Note: SPDX marks this identifier as deprecated; new projects should use a current form.');
  }

  return parts.join('');
}

export interface Dimension {
  /**
   * 稳定标识。**渲染逻辑必须按它分支，不能按 label**——
   * label 是给人看的文案，改文案时不该连带改坏样式。
   */
  key: DimensionKey;
  label: string;
  hint?: string;
  /** 渲染成 React 节点；纯数据模块不引入 React，因此交给调用方包装 */
  cell: (r: CompareFacts) => string | boolean | null;
  /** 单元格的渲染形态，决定界面上用勾叉还是文字 */
  kind: 'yesno' | 'text' | 'muted-text' | 'warn-text' | 'ok-text' | 'danger-text';
}

export type DimensionKey =
  | 'source'
  | 'family'
  | 'conclusion-source'
  | 'patent'
  | 'closed-source'
  | 'network'
  | 'state-changes'
  | 'trademark'
  | 'notice'
  | 'official-header'
  | 'osi'
  | 'copyleft'
  | 'source-disclosure'
  | 'category';

/**
 * 对比维度定义。矩阵（行=许可证）与工作台（列=许可证）共用它，
 * 保证同一行在两处含义完全一致。
 */
export function compareDimensions(lang: Lang): Dimension[] {
  const zh = lang === 'zh';
  return [
    {
      key: 'source',
      label: zh ? '来源' : 'Source',
      hint: zh
        ? '不在官方名录里的许可证，名字不能填进 package.json 的 license 字段'
        : 'Licenses outside the official list have names that cannot go into a package.json license field',
      kind: 'text',
      cell: (r) => (r.source === 'spdx' ? (zh ? '官方名录' : 'official list') : zh ? '不在名录里' : 'not listed'),
    },
    {
      key: 'family',
      label: zh ? '许可类型' : 'License type',
      hint: zh ? '见右侧详情：优先用第三方数据库的分类，其次看名字' : 'See the detail panel: a third-party category first, then the name',
      kind: 'text',
      cell: (r) => FAMILY_LABEL[r.family as keyof typeof FAMILY_LABEL]?.[lang] ?? r.family,
    },
    {
      key: 'conclusion-source',
      label: zh ? '结论怎么来的' : 'How it was decided',
      hint: zh ? '人工核对或人工标注的远比机器猜的可靠' : 'Hand-checked or hand-labelled is far more reliable than machine inference',
      kind: 'text',
      cell: (r) => (r.termsSource === 'text' ? (zh ? '机器猜的' : 'inferred') : zh ? '有人标注过' : 'hand-labelled'),
    },
    {
      key: 'patent',
      label: zh ? '专利' : 'Patents',
      hint: zh ? '"没提到"不等于安全：算不算隐含授权，法律上一直有争议' : '"Not mentioned" is not safety: whether a grant is implied is genuinely disputed',
      kind: 'text',
      cell: (r) => r.facts.patentGrant,
    },
    {
      key: 'closed-source',
      label: zh ? '能不能闭源改' : 'Closed-source forks',
      hint: zh ? '宽松型和公共领域可以；要求开源的许可不行' : 'Permissive and public-domain licences allow it; copyleft does not',
      kind: 'yesno',
      cell: (r) => allowsClosedSource(r),
    },
    {
      key: 'network',
      label: zh ? '做成网站也要开源吗' : 'Publishing as a service',
      hint: zh ? '把代码跑成在线服务，是否也要把源码公开。只有 AGPL 系列和 EUPL 管这件事' : 'Whether running the code as a service also requires publishing source; only the AGPL family and the EUPL cover this',
      kind: 'yesno',
      cell: (r) => r.facts.networkTrigger,
    },
    {
      key: 'state-changes',
      label: zh ? '改了要写明吗' : 'Note your changes',
      hint: zh ? '改了别人的文件，要在文件里注明"已修改"' : 'Modified files must state that they were changed',
      kind: 'yesno',
      cell: (r) => r.facts.stateChanges,
    },
    {
      key: 'trademark',
      label: zh ? '商标' : 'Trademarks',
      hint: zh ? '提到商标，通常意味着明确不授权给你用它的名字' : 'A clause here usually means the license grants you no rights to the name',
      kind: 'yesno',
      cell: (r) => r.facts.trademarkClause,
    },
    {
      key: 'notice',
      label: zh ? '要放 NOTICE 吗' : 'NOTICE required',
      hint: zh ? 'Apache-2.0 §4(d) 要求分发时附上归属声明，这条不能省' : 'Apache-2.0 §4(d) requires attribution notices with distributions. Not optional.',
      kind: 'yesno',
      cell: (r) => r.facts.requiresNotice,
    },
    {
      key: 'official-header',
      label: zh ? '有官方声明模板吗' : 'Official header template',
      hint: zh ? '官方资料里有没有给源文件开头的声明模板；没有的话我们不会自己编' : 'Whether the official data ships a source-header template; where it does not, we will not invent wording',
      kind: 'yesno',
      cell: (r) => r.hasOfficialHeader,
    },
    { key: 'osi', label: 'OSI', hint: zh ? '是否通过 OSI 认证（以官方名录为准）' : 'OSI approval, per the official list', kind: 'yesno', cell: (r) => r.facts.osiApproved },
    {
      key: 'copyleft',
      label: zh ? '要不要开源' : 'Must stay open',
      hint: zh ? 'OSADL 义务清单的判定：不要 / 要 / 要（有条件）' : 'OSADL obligations checklist: No / Yes / Yes (restricted)',
      kind: 'muted-text',
      cell: (r) => r.copyleft ?? null,
    },
    {
      key: 'source-disclosure',
      label: zh ? '要给出源码吗' : 'Must ship source',
      hint: zh ? 'OSADL 判定你要不要把衍生作品的源码一并提供' : 'OSADL verdict on whether you must ship the corresponding source',
      kind: 'muted-text',
      cell: (r) => r.sourceDisclosure ?? null,
    },
    {
      key: 'category',
      label: zh ? '分类' : 'Category',
      hint: zh ? 'ScanCode LicenseDB 的粗分类；其官方文档说明该分类不具备法律精确性' : 'ScanCode LicenseDB category; its own docs note it is not legally precise',
      kind: 'text',
      cell: (r) => r.category ?? null,
    },
  ];
}
