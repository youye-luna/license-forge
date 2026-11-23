'use client';

import { FAMILY_LABEL } from '../../lib/licenses.ts';
import { needsLicenseText, SORTS, type SortKey } from '../../lib/ordering.ts';
import type { UnifiedEntry } from '../../lib/spdx.ts';
import { SUBJECT_LABEL, type Subject } from '../../lib/subject.ts';
import type { Lang } from '../../lib/types.ts';

export type SourceFilter = 'all' | 'spdx' | 'scancode';

export type Filter =
  // 按许可类型分（宽松型 / 公共领域型 / 著作权型 …）——用户最常按这个找
  | 'permissive'
  | 'public-domain-family'
  | 'weak-copyleft'
  | 'strong-copyleft'
  | 'network-copyleft'
  | 'content'
  | 'proprietary'
  | 'featured'
  | 'osi'
  | 'china'
  | 'deprecated'
  | 'all';

export const FILTERS: {
  id: Filter;
  zh: string;
  en: string;
  family?: string;
  test?: (l: UnifiedEntry, family: string) => boolean;
}[] = [
  // ── 按许可类型分类（文案与详情面板的「许可类型」共用 FAMILY_LABEL，两处必定一致）──
  { id: 'featured', zh: '最常用', en: 'Most used' },
  { id: 'permissive', zh: FAMILY_LABEL.permissive.zh, en: FAMILY_LABEL.permissive.en, family: 'permissive' },
  {
    id: 'public-domain-family',
    zh: FAMILY_LABEL['public-domain'].zh,
    en: FAMILY_LABEL['public-domain'].en,
    family: 'public-domain',
  },
  {
    id: 'weak-copyleft',
    zh: FAMILY_LABEL['weak-copyleft'].zh,
    en: FAMILY_LABEL['weak-copyleft'].en,
    family: 'weak-copyleft',
  },
  {
    id: 'strong-copyleft',
    zh: FAMILY_LABEL['strong-copyleft'].zh,
    en: FAMILY_LABEL['strong-copyleft'].en,
    family: 'strong-copyleft',
  },
  {
    id: 'network-copyleft',
    zh: FAMILY_LABEL['network-copyleft'].zh,
    en: FAMILY_LABEL['network-copyleft'].en,
    family: 'network-copyleft',
  },
  { id: 'content', zh: FAMILY_LABEL.content.zh, en: FAMILY_LABEL.content.en, family: 'content' },
  {
    id: 'proprietary',
    zh: FAMILY_LABEL.proprietary.zh,
    en: FAMILY_LABEL.proprietary.en,
    family: 'proprietary',
  },
  // ── 其它分组 ──
  { id: 'osi', zh: 'OSI 认证过', en: 'OSI approved', test: (l) => l.osiApproved && !l.deprecated },
  { id: 'deprecated', zh: '旧名字（已废弃）', en: 'Deprecated names', test: (l) => l.deprecated },
  { id: 'china', zh: '中国主导的', en: 'China-led', test: (l) => /^Mulan/.test(l.id) },
  { id: 'all', zh: '全部', en: 'All' },
];

/**
 * 「用来授权」筛选项：按作品类型筛，选错这一项后面条款再对也没用。
 *
 * 与「最常用」等筛选是**不同维度**：那些是"这批许可证属于哪个集合"，
 * 这一项是"它给什么作品用"。所以做成一个下拉，而不是再往筛选行里塞 9 个胶囊
 * ——筛选行已经够挤了，而且用户一次只会关心一两种作品类型。
 */
const SUBJECT_FILTERS: (Subject | 'all')[] = [
  'all',
  'code',
  'docs',
  'media',
  'data',
  'font',
  'hardware',
  'spec',
  'model',
  'any',
];

/**
 * 左侧所有筛选控件共用的下拉样式。
 *
 * 集中成一处是因为它被四组用到（来源 / 用来授权 / 筛选 / 排序），
 * 各写一份必然会走形。
 *
 * 视觉上让"这一项**不是**默认值"时变成实心深色——用户扫一眼就知道
 * 自己改过哪几项，不必逐个去读选项文字。
 */
function selectClass(active: boolean): string {
  return [
    'min-w-0 flex-1 rounded-lg border px-2 py-2 text-xs outline-none transition',
    'focus:border-ink-900',
    active
      ? 'border-ink-900 bg-ink-900 font-medium text-white'
      : 'border-ink-900/15 bg-white hover:border-ink-900/40',
  ].join(' ');
}

/**
 * 一组筛选：左侧固定宽度的标签 + 右侧下拉。
 *
 * 标签用固定宽度而不是跟着文字走，这样四组的下拉框左边缘会对齐成一条线。
 */
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-right text-xs text-ink-400">{label}</span>
      {children}
    </div>
  );
}

/** "最常用"是精选的高频短名单，而不是按字母序的前几十个 */
export const FEATURED = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
  'EPL-2.0',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'Unlicense',
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'MulanPSL-2.0',
  'BSL-1.0',
  'Zlib',
  'OFL-1.1',
  'EUPL-1.2',
  'CERN-OHL-S-2.0',
  'MIT-0',
  '0BSD',
];

/**
 * 左栏的筛选控件（搜索框 + 四组下拉 + 排序说明）。
 *
 * 拆成独立组件后，ProPicker 只负责持有筛选状态；这里不碰数据，
 * 只把当前值与改动回调转给下拉——四组的样式与标签宽度因此保持一致。
 */
export function PickerFilters({
  lang,
  query,
  onQueryChange,
  source,
  onSourceChange,
  subject,
  onSubjectChange,
  filter,
  onFilterChange,
  sortKey,
  onSortChange,
  total,
  licenseCount,
  scancodeTotal,
}: {
  lang: Lang;
  query: string;
  onQueryChange: (value: string) => void;
  source: SourceFilter;
  onSourceChange: (value: SourceFilter) => void;
  subject: Subject | 'all';
  onSubjectChange: (value: Subject | 'all') => void;
  filter: Filter;
  onFilterChange: (value: Filter) => void;
  sortKey: SortKey;
  onSortChange: (value: SortKey) => void;
  total: number;
  licenseCount: number;
  scancodeTotal: number;
}) {
  const zh = lang === 'zh';
  return (
    <>
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={zh ? '搜名字，例如 MPL、996' : 'Search by name, e.g. MPL, 996'}
        className="w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-900"
      />

      {/* 四组筛选：统一为「标签 + 下拉」，标签定宽所以左边缘对齐 */}
      <FilterRow label={zh ? '来源' : 'Source'}>
        <select
          value={source}
          onChange={(e) => onSourceChange(e.target.value as SourceFilter)}
          className={selectClass(source !== 'all')}
          aria-label={zh ? '按来源筛选' : 'Filter by source'}
        >
          <option value="all">{zh ? `全部来源（${total}）` : `All sources (${total})`}</option>
          <option value="spdx">
            {zh ? `官方名录里有的（${licenseCount}）` : `On the official list (${licenseCount})`}
          </option>
          <option value="scancode">
            {zh ? `其它来源（${scancodeTotal}）` : `Other sources (${scancodeTotal})`}
          </option>
        </select>
      </FilterRow>

      {/* 「用来授权」：按作品类型筛，与"属于哪个集合"是不同维度 */}
      <FilterRow label={zh ? '用来授权' : 'Used for'}>
        <select
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value as Subject | 'all')}
          className={selectClass(subject !== 'all')}
          aria-label={zh ? '按作品类型筛选' : 'Filter by subject matter'}
        >
          <option value="all">{zh ? '不限作品类型' : 'Any kind of work'}</option>
          {SUBJECT_FILTERS.filter((s) => s !== 'all').map((s) => (
            <option key={s} value={s}>
              {SUBJECT_LABEL[s][lang]}
            </option>
          ))}
        </select>
      </FilterRow>

      <FilterRow label={zh ? '分类' : 'Category'}>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as Filter)}
          className={selectClass(filter !== 'featured')}
          aria-label={zh ? '按许可类型分类' : 'Filter by license category'}
        >
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {zh ? f.zh : f.en}
            </option>
          ))}
        </select>
      </FilterRow>

      <FilterRow label={zh ? '排序' : 'Sort'}>
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className={selectClass(sortKey !== 'id')}
          aria-label={zh ? '排序方式' : 'Sort order'}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {(zh ? s.zh : s.en) + (s.needsText ? (zh ? '（需正文）' : ' (needs text)') : '')}
            </option>
          ))}
        </select>
      </FilterRow>
      {needsLicenseText(sortKey) ? (
        <p className="rounded-lg border border-advisory/30 bg-advisory/5 p-2 text-xs text-advisory">
          {zh
            ? '「专利授权」需要正文才能判定。列表为了速度不下载全文，所以只有已精校或上游标注的许可能排准，其余按"未提及"排在后面——点开某个许可证看详情时才会按正文推断。'
            : '"Patent grant" needs the license text. The list does not download full texts just to sort, so only licenses with known terms order correctly; the rest fall back to "silent". Open a license to see its text-based inference.'}
        </p>
      ) : null}
    </>
  );
}
