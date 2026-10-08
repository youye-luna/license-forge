import { deriveFacts, familyFromEntry, type ChooseALicenseTerms, type Enrichment, type UnifiedEntry } from './spdx.ts';
import { subjectsOf, type Subject } from './subject.ts';

/**
 * 列表排序。
 *
 * 抽成纯模块有两个理由：可以被测试直接断言；以及排序依据必须能被界面如实说明。
 *
 * 前三项**只靠元数据就能算准**——家族来自 ScanCode 分类（覆盖 98%）或 SPDX 标识符，
 * 适用对象来自标识符规则（覆盖 100%）。所以对全部 2469 个条目都成立。
 *
 * 「专利授权」不同：没有正文时 `deriveFacts` 只能给出 "未提及"，而正文是按需加载的
 * （列表不会为了排序去下载 5~13MB）。因此这一项只对已人工核对或人工标注的许可有
 * 区分度，界面会把这件事说明白，而不是假装排得准。
 */
export type SortKey = 'id' | 'family' | 'subject' | 'patent';

export const SORTS: { id: SortKey; zh: string; en: string; needsText?: boolean }[] = [
  { id: 'id', zh: '标识符', en: 'Identifier' },
  { id: 'family', zh: '宽松程度', en: 'Permissiveness' },
  { id: 'subject', zh: '适用对象', en: 'Subject matter' },
  { id: 'patent', zh: '专利授权', en: 'Patent grant', needsText: true },
];

/** 家族排序：从最宽松到最强著佐权，非开源与未知排在最后 */
export const FAMILY_RANK: Record<string, number> = {
  permissive: 0,
  'public-domain': 1,
  content: 2,
  'weak-copyleft': 3,
  'strong-copyleft': 4,
  'network-copyleft': 5,
  proprietary: 6,
  unknown: 7,
};

/**
 * 适用对象的排序次序：**从最专门到最通用**。
 * 选这一项通常是想回答"哪些许可不是给代码的"，所以把代码排在最后。
 */
export const SUBJECT_RANK: Record<Subject, number> = {
  hardware: 0,
  font: 1,
  spec: 2,
  docs: 3,
  media: 4,
  data: 5,
  model: 6,
  any: 7,
  code: 8,
};

/** 专利排序：明确授予 → 明确不授 → 未提及 */
export const PATENT_RANK: Record<string, number> = { explicit: 0, none: 1, silent: 2 };

/** 条目在合并目录里的稳定标识（SPDX 标识符或 ScanCode key） */
export function keyOf(entry: UnifiedEntry): string {
  return entry.source === 'spdx' ? entry.id : (entry.scancodeKey ?? '');
}

export interface SortContext {
  enrichment: Enrichment | null;
  terms: ChooseALicenseTerms | null;
  /** 已加载的正文（通常只有对比工作台里的条目有）；缺失时专利判定退化为"未提及" */
  licenseTexts: Record<string, string>;
}

/** 一个条目在某一维度上的排序键 */
function rankOf(entry: UnifiedEntry, sortKey: SortKey, ctx: SortContext): number {
  const key = keyOf(entry);
  const extra = ctx.enrichment?.licenses[key];

  if (sortKey === 'family') return FAMILY_RANK[familyFromEntry(entry, extra) ?? 'unknown'] ?? 8;
  if (sortKey === 'subject') return SUBJECT_RANK[subjectsOf(key, familyFromEntry(entry, extra)).subjects[0]] ?? 9;
  const facts = deriveFacts(key, ctx.licenseTexts[entry.id] ?? '', entry.osiApproved, familyFromEntry(entry, extra), ctx.terms);
  return PATENT_RANK[facts.patentGrant] ?? 3;
}

/**
 * 排序入口。
 *
 * 先算每项的排序键再排（装饰-排序-去装饰），而不是在比较函数里现算：
 * 400 项 × log n 次比较，现算会把家族与适用对象判定重复上千次。
 * 同 rank 时按标识符兜底，保证结果稳定（同样的输入永远同样的顺序）。
 */
export function sortLicenses(entries: UnifiedEntry[], sortKey: SortKey, ctx: SortContext): UnifiedEntry[] {
  if (sortKey === 'id') {
    return [...entries].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  }
  return entries
    .map((e) => ({ e, rank: rankOf(e, sortKey, ctx), id: keyOf(e) }))
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
    .map((d) => d.e);
}

/** 这个排序维度是否依赖正文——界面据此决定要不要给出"只有部分条目排得准"的提示 */
export function needsLicenseText(sortKey: SortKey): boolean {
  return SORTS.find((s) => s.id === sortKey)?.needsText === true;
}
