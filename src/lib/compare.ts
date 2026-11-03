import { LICENSE_BY_ID } from './licenses.ts';
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
 * 对比用的数据模型与简介生成。
 *
 * 放在不依赖 React 的纯模块里，是为了让测试能直接断言（Node 加载不了 .tsx）。
 * 条款框的三组词表与渲染在 ProPicker 里，与详情面板共用同一个组件。
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
  /** 条款字段的来源：`choosealicense` 表示精校/上游标注，`text` 表示正文推断 */
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
 * `licenseText` 可以缺失：有 ChooseALicense 上游标注的条目条款是查表得来的，
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
  // 精校的条目条款是逐条核对的，比推断更可信
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

/**
 * 为没有现成简介的许可证**生成**一段中文/英文简介。
 *
 * 数据全部来自已核实的字段（家族、专利判定、归属方、来源），
 * 不编造许可证没有写过的内容；每句话都能在条款或元数据里找到依据。
 * 精校的 32 个许可证不经过这里——它们有手写的 tagline，措辞更有观点。
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

