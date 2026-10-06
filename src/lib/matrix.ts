import { LICENSES } from './licenses.ts';
import type { Lang, LicenseEntry } from './types.ts';

/** 对比矩阵的维度定义：每一列都是对许可条款的机械归纳，不含主观评价 */
export interface MatrixColumn {
  id: string;
  label: { zh: string; en: string };
  /** 该列的一句话说明 */
  hint: { zh: string; en: string };
  value: (l: LicenseEntry) => string | boolean | { zh: string; en: string };
}

export const MATRIX_COLUMNS: MatrixColumn[] = [
  {
    id: 'spdx',
    label: { zh: 'SPDX 标识符', en: 'SPDX identifier' },
    hint: { zh: '写进 package.json / Cargo.toml 的就是它', en: 'What goes into package.json / Cargo.toml' },
    value: (l) => l.id,
  },
  {
    id: 'commercial',
    label: { zh: '允许商用', en: 'Commercial use' },
    hint: {
      zh: '本站收录的**每一个**许可证都允许商用。这条列在这里，是为了纠正"GPL 不能商用"这个流传极广的错误说法。',
      en: 'Every license listed here permits commercial use. The column exists to correct the widespread claim that the GPL forbids it.',
    },
    value: () => true,
  },
  {
    id: 'closed',
    label: { zh: '允许闭源衍生', en: 'Closed-source forks' },
    hint: { zh: '宽松与著佐权的根本分界。', en: 'The fundamental permissive/copyleft divide.' },
    value: (l) => l.family === 'permissive' || l.family === 'public-domain' || l.family === 'content' || l.facts.sameLicensePerFile,
  },
  {
    id: 'network',
    label: { zh: '网络服务触发开源', en: 'Network use triggers' },
    hint: {
      zh: '把代码跑成在线服务、不发布软件本体时是否也要开源。只有 AGPL 家族与 EUPL 覆盖这一点。',
      en: 'Whether running the code as a service, without distributing it, also requires sharing source. Only the AGPL family and the EUPL cover this.',
    },
    value: (l) => l.facts.networkTrigger,
  },
  {
    id: 'patent',
    label: { zh: '专利条款', en: 'Patent terms' },
    hint: {
      zh: '"明确授权" / "明确不授权" / "只字未提"。沉默不等于没有风险，这正是企业法务最在意的一栏。',
      en: 'Explicit grant, explicit refusal, or silence. Silence is not safety — this is the column corporate legal looks at first.',
    },
    value: (l) =>
      l.facts.patentGrant === 'explicit'
        ? { zh: '明确授权', en: 'Explicit grant' }
        : l.facts.patentGrant === 'none'
          ? { zh: '明确不授权', en: 'Explicitly none' }
          : { zh: '未提及', en: 'Silent' },
  },
  {
    id: 'notice',
    label: { zh: 'NOTICE 义务', en: 'NOTICE required' },
    hint: {
      zh: 'Apache-2.0 §4(d) 要求在分发时随附归属声明，这不是可选项。绝大多数生成器都不提示这一点。',
      en: 'Apache-2.0 §4(d) requires attribution notices to accompany distributions. Not optional, and almost no generator mentions it.',
    },
    value: (l) => l.requiresNotice,
  },
  {
    id: 'stateChanges',
    label: { zh: '须标注改动', en: 'Mark changes' },
    hint: { zh: '修改原文件后必须在文件中说明"已修改"。', en: 'Modified files must state that they were changed.' },
    value: (l) => l.facts.stateChanges,
  },
  {
    id: 'trademark',
    label: { zh: '含商标条款', en: 'Trademark clause' },
    hint: { zh: '含该条款意味着许可明确**不**授予商标权。', en: 'A clause here means the license explicitly grants no trademark rights.' },
    value: (l) => l.facts.trademarkClause,
  },
  {
    id: 'osi',
    label: { zh: 'OSI 认证', en: 'OSI approved' },
    hint: { zh: '是否是 Open Source Initiative 认证的开源许可。', en: 'Whether the Open Source Initiative has approved it.' },
    value: (l) => l.facts.osiApproved,
  },
  {
    id: 'header',
    label: { zh: '有官方文件头', en: 'Official file header' },
    hint: {
      zh: 'GPL 家族在许可证正文里自带声明段原文；其余许可证**没有**官方 per-file 模板，只能用 SPDX 推荐的两行式，而不是自己编。',
      en: 'The GPL family ships notice wording inside the license text. Every other license has no official per-file template, so the SPDX two-line form is the honest option.',
    },
    value: (l) => l.headerStyle === 'official-boilerplate',
  },
  {
    id: 'chinese',
    label: { zh: '有官方中文文本', en: 'Official Chinese text' },
    hint: {
      zh: '只有 MulanPSL-2.0 与 EUPL-1.2 等少数许可提供官方中文/多语言正式文本。注意：界面中文不等于许可证正文有中文效力。',
      en: 'Few licenses, notably MulanPSL-2.0 and EUPL-1.2, provide official Chinese or multilingual texts. A Chinese interface does not mean the license text has Chinese legal effect.',
    },
    value: (l) => l.id === 'MulanPSL-2.0' || l.id === 'EUPL-1.2',
  },
  {
    id: 'reversible',
    label: { zh: '可撤销授权', en: 'Revocable' },
    hint: { zh: '开源许可一旦授予即不可撤销；这不是缺点，是它可靠的原因。', en: 'Once granted, an open-source license cannot be revoked. That is a feature, not a flaw.' },
    value: (l) => !l.facts.irrevocable,
  },
];

export interface CellRendering {
  kind: 'yes' | 'no' | 'text';
  text: string;
}

export function renderCell(col: MatrixColumn, license: LicenseEntry, lang: Lang): CellRendering {
  const raw = col.value(license);
  if (typeof raw === 'boolean') {
    return { kind: raw ? 'yes' : 'no', text: raw ? (lang === 'zh' ? '是' : 'Yes') : lang === 'zh' ? '否' : 'No' };
  }
  if (typeof raw === 'string') return { kind: 'text', text: raw };
  return { kind: 'text', text: raw[lang] };
}

/** 只显示与给定许可"可共存"的许可（用于兼容性提示） */
export function mutualCompatibility(l: LicenseEntry): { compatible: string[]; incompatible: string[]; note: { zh: string; en: string } } {
  const id = l.id;
  const compatible: string[] = [];
  const incompatible: string[] = [];
  for (const other of LICENSES) {
    if (other.id === id) continue;
    if (other.variantsOf === id || l.variantsOf === other.id) continue;
    const sameFamily = other.family === l.family;
    const onePermissive =
      (l.family === 'permissive' || l.family === 'public-domain') &&
      (other.family === 'permissive' || other.family === 'public-domain');
    if (sameFamily || onePermissive) compatible.push(other.id);
    else if (l.family === 'permissive' && other.family !== 'content') compatible.push(other.id);
    else incompatible.push(other.id);
  }
  return {
    compatible,
    incompatible,
    note: {
      zh: '这里给出的是常见组合的经验性判断，**不是法律意见**。真实项目里请以许可证原文、FSF 的兼容性清单与你的法务意见为准；跨许可合并前务必逐条核对。',
      en: 'These are empirical rules of thumb, not legal advice. For a real project, check the license texts, the FSF compatibility list and your own counsel before combining code.',
    },
  };
}

/** 统计信息，用于首页展示"我们和别处有什么不同" */
export function coverageStats() {
  return {
    total: LICENSES.length,
    gnuVariants: LICENSES.filter((l) => l.needsVersionChoice || l.id.startsWith('GPL') || l.id.startsWith('LGPL') || l.id.startsWith('AGPL')).length,
    withNotice: LICENSES.filter((l) => l.requiresNotice).length,
    withOfficialHeader: LICENSES.filter((l) => l.headerStyle === 'official-boilerplate').length,
    chineseNative: LICENSES.filter((l) => l.id === 'MulanPSL-2.0' || l.id === 'EUPL-1.2').length,
  };
}
