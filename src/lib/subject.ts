/**
 * 「适用于」——这个许可证是用来授权**什么作品**的。
 *
 * 这是一个经常被忽略、但选错代价很大的维度：MIT 与 CC-BY-SA-4.0 都是"宽松"，
 * 但一个写给源代码、一个写给文本与媒体。用 CC 许可授权代码，或用软件许可授权
 * 一篇长文，都会让条款与实际作品对不上。
 *
 * 数据来源分三层，界面会如实标注是哪一层（与条款字段的做法一致）：
 *   curated  人工指定——准确，覆盖 32 个常用许可
 *   rule     标识符/名称命中一条**明确**规则（如 `OFL-` 前缀 = 字体许可）
 *   default  默认按源代码处理，界面标为"推断"
 *
 * 为什么 default 值得存在：SPDX 与 ScanCode 里的条目 95% 以上确实是软件许可，
 * 默认值是对的；但如果不说清这是默认值，就等于把推断当成了事实。
 * 刻意**不做**宽泛的关键词匹配：实测 `databricks-db`、`ms-sql-server-data-tools`
 * 这类名字里带 data 的其实是软件协议，"看到 data 就判数据"会大量误判。
 */
export type Subject = 'code' | 'docs' | 'media' | 'data' | 'font' | 'hardware' | 'spec' | 'model' | 'any';

export const SUBJECT_LABEL: Record<Subject, { zh: string; en: string }> = {
  code: { zh: '源代码 / 软件', en: 'Source code' },
  docs: { zh: '文档 / 说明书', en: 'Documentation' },
  media: { zh: '文本 / 图片 / 音视频', en: 'Text, images, media' },
  data: { zh: '数据 / 数据库', en: 'Data, databases' },
  font: { zh: '字体 / 字形', en: 'Fonts' },
  hardware: { zh: '硬件设计', en: 'Hardware designs' },
  spec: { zh: '规范 / 标准文本', en: 'Specifications' },
  model: { zh: 'AI 模型 / 权重', en: 'AI models, weights' },
  any: { zh: '各类作品', en: 'Any kind of work' },
};

export interface SubjectVerdict {
  subjects: Subject[];
  source: 'curated' | 'rule' | 'default';
  /** 需要提醒用户的一句话（例如 CC 官方不建议用于软件） */
  note?: { zh: string; en: string };
}

const CC_NOTE = {
  zh: 'Creative Commons 官方明确不建议把 CC 许可用于软件——它不涉及源代码分发与专利，用它对代码授权会造成条款与作品不匹配。',
  en: 'Creative Commons itself advises against using CC licenses for software: they address neither source distribution nor patents, so the terms will not fit the work.',
};

const FONT_NOTE = {
  zh: '字体许可处理的是字形的使用、嵌入与再分发，与源代码许可的义务不同。',
  en: 'Font licenses govern use, embedding and redistribution of glyphs — different obligations from a source-code license.',
};

const HW_NOTE = {
  zh: '硬件许可是为设计文件（原理图、PCB、CAD）写的，"源码"指你偏好的修改形式。',
  en: 'Hardware licenses are written for design files (schematics, PCBs, CAD); "source" means your preferred form for modification.',
};

/**
 * 人工指定：32 个常用许可。
 *
 * 只列**与"源代码"不同**或需要特别说明的；其余留空表示走默认的源代码。
 * 这样这份表只承载真正的判断，不是把 32 行重复一遍。
 */
const CURATED: Record<string, { subjects: Subject[]; note?: { zh: string; en: string } }> = {
  // 字体
  'OFL-1.1': { subjects: ['font'], note: FONT_NOTE },
  // 硬件
  'CERN-OHL-S-2.0': { subjects: ['hardware'], note: HW_NOTE },
  // 内容与媒体
  'CC-BY-4.0': { subjects: ['media', 'data'], note: CC_NOTE },
  'CC-BY-SA-4.0': { subjects: ['media', 'data'], note: CC_NOTE },
  // 公共领域奉献：不限定作品类型
  'CC0-1.0': {
    subjects: ['any'],
    note: {
      zh: 'CC0 是权利放弃声明，不区分作品类型，代码与数据都常用；但它不含专利授权，用于代码时需自行考虑这一点。',
      en: 'CC0 is a rights waiver that does not distinguish subject matter and is common for both code and data — but it grants no patent rights, which matters if you use it for code.',
    },
  },
  WTFPL: { subjects: ['any'] },
  // 明确写给软件、且社区就是这么用的
  'MIT': { subjects: ['code'] },
  'MIT-0': { subjects: ['code'] },
  '0BSD': { subjects: ['code'] },
  ISC: { subjects: ['code'] },
  'BSD-2-Clause': { subjects: ['code'] },
  'BSD-3-Clause': { subjects: ['code'] },
  'BSD-3-Clause-Clear': { subjects: ['code'] },
  'Apache-2.0': {
    subjects: ['code'],
    note: {
      zh: 'Apache-2.0 也常被用于规范与接口文档，但它带的专利授权与"必须附归属声明"这些要求，都是为软件分发设计的。',
      en: 'Apache-2.0 is also used for specifications and interface docs, but its patent grant and its "you must include the attribution notice" rule are designed around software distribution.',
    },
  },
  'BSL-1.0': { subjects: ['code'] },
  Zlib: { subjects: ['code'] },
  'MPL-2.0': { subjects: ['code'] },
  'EPL-2.0': { subjects: ['code'] },
  'CDDL-1.0': { subjects: ['code'] },
  'LGPL-2.1-only': { subjects: ['code'] },
  'LGPL-2.1-or-later': { subjects: ['code'] },
  'LGPL-3.0-only': { subjects: ['code'] },
  'LGPL-3.0-or-later': { subjects: ['code'] },
  'GPL-2.0-only': { subjects: ['code'] },
  'GPL-2.0-or-later': { subjects: ['code'] },
  'GPL-3.0-only': { subjects: ['code'] },
  'GPL-3.0-or-later': { subjects: ['code'] },
  'AGPL-3.0-only': { subjects: ['code'] },
  'AGPL-3.0-or-later': { subjects: ['code'] },
  Unlicense: { subjects: ['code'] },
  'EUPL-1.2': { subjects: ['code'] },
  'MulanPSL-2.0': { subjects: ['code'] },
};

/**
 * 长尾条目的判定规则。**只收信号明确的**，宁可落到 default 也不猜。
 * 顺序有意义：先匹配到的生效。
 */
const RULES: { re: RegExp; subjects: Subject[]; note?: { zh: string; en: string } }[] = [
  // 字体：OFL/UFL 与 LPPL 是专门写给字体与排版资源的
  { re: /^(?:ofl|ufl)-\d|^lppl-|^bitstream-|^adobe-glyph$|^lucida-bitmap-fonts$|^ubuntu-font|^ipa-font/i, subjects: ['font'], note: FONT_NOTE },
  // 硬件
  { re: /^cern-ohl|^tapr-ohl|^solderpad|^bohl-|^openhardware/i, subjects: ['hardware'], note: HW_NOTE },
  // 数据与数据库（ODC 家族与 ODbL 是明确为数据库写的）
  { re: /^odbl-|^odc-(?:by|1\.0)|^pddl-/i, subjects: ['data'] },
  // 文档：GFDL 是写给手册的
  { re: /^gfdl-|^fdl-/i, subjects: ['docs'] },
  // 规范与标准文本
  { re: /^w3c|^unicode-|^iso-permission$|^community-spec-|^open-group|^ietf|^rfc-/i, subjects: ['spec'] },
  // AI 模型与权重（这一类近年才出现，条款与传统软件许可差别很大）
  { re: /-model(?:-|$)|^bigscience-|^openrail|^llama|^fair-ai-|model-license|model-tou/i, subjects: ['model'] },
  // Creative Commons：内容与媒体
  { re: /^cc0-|^cc-by(?:-|$)/i, subjects: ['media', 'data'], note: CC_NOTE },
];

/**
 * 判定一个许可证适用于什么作品。
 *
 * @param id     SPDX 标识符或 ScanCode key
 * @param family 已判定的家族；`content` 家族即使没有命中规则也按媒体处理
 */
export function subjectsOf(id: string, family?: string): SubjectVerdict {
  const curated = CURATED[id];
  if (curated) return { subjects: curated.subjects, source: 'curated', note: curated.note };

  for (const rule of RULES) {
    if (rule.re.test(id)) return { subjects: rule.subjects, source: 'rule', note: rule.note };
  }

  // 家族兜底：内容类许可基本不会是给源代码的
  if (family === 'content') {
    return { subjects: ['media', 'data'], source: 'rule', note: CC_NOTE };
  }

  return { subjects: ['code'], source: 'default' };
}
