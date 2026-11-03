'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Info, X } from './Icons';
import { FAMILY_LABEL, LICENSE_BY_ID } from '../lib/licenses.ts';
import { factsOf, generatedIntro } from '../lib/compare.ts';
import { matchesSubject, SUBJECT_LABEL, subjectsOf, type Subject } from '../lib/subject.ts';
import { needsLicenseText, sortLicenses, SORTS, type SortKey } from '../lib/ordering.ts';
import {
  catalogStats,
  COMPATIBILITY_VERDICT,
  deriveFacts,
  familyFromEntry,
  getUnifiedCatalog,
  ID_PREFIX_GROUPS,
  isNonOpenCategory,
  loadCatalog,
  loadEnrichment,
  loadScancodeCatalog,
  loadTerms,
  loadTexts,
  lookupTerms,
  OSI_KEYWORD_NOTE,
  scancodeStats,
  searchUnified,
  type CatalogLicense,
  type ChooseALicenseTerms,
  type Enrichment,
  type EnrichmentRecord,
  type ScancodeCatalog,
  type SpdxSnapshot,
  type UnifiedEntry,
} from '../lib/spdx.ts';
import type { Lang } from '../lib/types.ts';

interface Props {
  lang: Lang;
  pickedId: string | null;
  exceptionId: string | null;
  onPick: (id: string, exceptionId?: string | null) => void;
}

type SourceFilter = 'all' | 'spdx' | 'scancode';

/* ------------------------------------------------------------------ *
 * 白话对照表
 *
 * 详情面板是给"正在发第一个开源项目的人"看的，不是给法务看的。
 * 术语本身保留（搜索、对照资料时要用到），但每个术语旁边补一句
 * **"这意味着我该怎么做"**——否则看到"弱著佐权"四个字仍然不知道要不要开源。
 * ------------------------------------------------------------------ */

/** 许可类型：术语 + 一句"这意味着什么" */
const FAMILY_PLAIN: Record<string, { zh: string; en: string }> = {
  permissive: { zh: '随便用，改了也不必开源', en: 'use it freely; forks need not stay open' },
  'public-domain': { zh: '作者基本放弃了权利，几乎没有条件', en: 'the author waived their rights; almost no conditions' },
  content: { zh: '给文字、图片、数据用的，不是给代码用的', en: 'for text, images and data — not for code' },
  'weak-copyleft': { zh: '改过的那几个文件要跟着开源，整个项目可以不开源', en: 'modified files must stay open; the wider project need not' },
  'strong-copyleft': { zh: '用了它，整个项目发布时都要用同一个许可开源', en: 'the whole project must ship under the same license' },
  'network-copyleft': { zh: '做成网站给别人用，也要把源码公开', en: 'running it as a service also requires publishing source' },
  proprietary: { zh: '这不是开源许可，对使用和分发有限制', en: 'not open source; it restricts use and distribution' },
  unknown: { zh: '类型不明确，请直接看原文', en: 'unclear — read the text' },
};

/** OSADL 的 Yes / No / Yes (restricted) 说成人话 */
function plainVerdict(v: string, zh: boolean): string {
  if (/^yes\s*\(restricted\)/i.test(v)) return zh ? '要（有条件）' : 'yes, with conditions';
  if (/^yes$/i.test(v)) return zh ? '要' : 'yes';
  if (/^no$/i.test(v)) return zh ? '不要' : 'no';
  return v;
}

/** 字数：上万就说"约几万字"，否则直接给数字 */
function plainLength(n: number, zh: boolean): string {
  if (!zh) return `${n.toLocaleString()} characters`;
  return n >= 10000 ? `约 ${(n / 10000).toFixed(1)} 万字` : `${n.toLocaleString()} 字`;
}

type Filter =
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

const FILTERS: { id: Filter; zh: string; en: string; family?: string; test?: (l: UnifiedEntry, family: string) => boolean }[] = [
  // ── 按许可类型分类（文案与详情面板的「许可类型」共用 FAMILY_LABEL，两处必定一致）──
  { id: 'featured', zh: '最常用', en: 'Most used' },
  { id: 'permissive', zh: FAMILY_LABEL.permissive.zh, en: FAMILY_LABEL.permissive.en, family: 'permissive' },
  { id: 'public-domain-family', zh: FAMILY_LABEL['public-domain'].zh, en: FAMILY_LABEL['public-domain'].en, family: 'public-domain' },
  { id: 'weak-copyleft', zh: FAMILY_LABEL['weak-copyleft'].zh, en: FAMILY_LABEL['weak-copyleft'].en, family: 'weak-copyleft' },
  { id: 'strong-copyleft', zh: FAMILY_LABEL['strong-copyleft'].zh, en: FAMILY_LABEL['strong-copyleft'].en, family: 'strong-copyleft' },
  { id: 'network-copyleft', zh: FAMILY_LABEL['network-copyleft'].zh, en: FAMILY_LABEL['network-copyleft'].en, family: 'network-copyleft' },
  { id: 'content', zh: FAMILY_LABEL.content.zh, en: FAMILY_LABEL.content.en, family: 'content' },
  { id: 'proprietary', zh: FAMILY_LABEL.proprietary.zh, en: FAMILY_LABEL.proprietary.en, family: 'proprietary' },
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
    active ? 'border-ink-900 bg-ink-900 font-medium text-white' : 'border-ink-900/15 bg-white hover:border-ink-900/40',
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
const FEATURED = [
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'EPL-2.0',
  'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
  'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later',
  'AGPL-3.0-only', 'AGPL-3.0-or-later', 'Unlicense', 'CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0',
  'MulanPSL-2.0', 'BSL-1.0', 'Zlib', 'OFL-1.1', 'EUPL-1.2', 'CERN-OHL-S-2.0', 'MIT-0', '0BSD',
];

export default function ProPicker({ lang, pickedId, exceptionId, onPick }: Props) {
  const zh = lang === 'zh';
  const [spdx, setSpdx] = useState<SpdxSnapshot | null>(null);
  const [scancode, setScancode] = useState<ScancodeCatalog | null>(null);
  const [unified, setUnified] = useState<UnifiedEntry[] | null>(null);
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const [terms, setTerms] = useState<ChooseALicenseTerms | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('featured');
  const [source, setSource] = useState<SourceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [focus, setFocus] = useState<UnifiedEntry | null>(null);
  /** 「用来授权」筛选项：按作品类型筛（源代码 / 文档 / 字体 / 硬件 …） */
  const [subject, setSubject] = useState<Subject | 'all'>('all');
  /** 按需加载的许可证正文（对比工作台里的条目会用到；列表排序不下载正文） */
  const [licenseTexts, setLicenseTexts] = useState<Record<string, string>>({});
  /** 对比工作台：最多 4 项，用 key 而不是 SPDX 标识符以便容纳 ScanCode 独有条目 */
  const [compareKeys, setCompareKeys] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    // ScanCode 目录是可选增强：拿不到也应当能正常用 SPDX 那部分
    Promise.all([loadCatalog(), loadScancodeCatalog().catch(() => null)])
      .then(([s, sc]) => {
        if (!alive) return;
        setSpdx(s);
        setScancode(sc);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    getUnifiedCatalog()
      .then((u) => alive && setUnified(u))
      .catch(() => undefined);
    loadEnrichment()
      .then((e) => alive && setEnrichment(e))
      .catch(() => undefined);
    // 条款标签是可选增强：拿不到就退回正文推断，界面会如实标注依据
    loadTerms()
      .then((t) => alive && setTerms(t))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const stats = spdx ? catalogStats(spdx) : null;
  const scStats = scancode ? scancodeStats(scancode) : null;

  const results = useMemo(() => {
    if (!unified) return [];
    const bySource = unified.filter((e) =>
      source === 'all' ? true : source === 'spdx' ? e.source === 'spdx' : e.source === 'scancode',
    );
    // 「用来授权」是独立维度，与"属于哪个集合"的筛选叠加生效
    const bySubject = bySource.filter((e) =>
      matchesSubject(e, subject, familyFromEntry(e, enrichment?.licenses[e.source === 'spdx' ? e.id : (e.scancodeKey ?? '')])),
    );
    if (query.trim()) return searchUnified(bySubject, query, 400);
    const active = FILTERS.find((f) => f.id === filter);
    if (filter === 'featured') {
      return FEATURED.map((id) => bySubject.find((e) => e.id === id)).filter((e): e is UnifiedEntry => Boolean(e));
    }
    // 按许可类型分类：判定与详情面板同一套，所以筛出来的与点开看到的一致
    if (active?.family) {
      return bySubject
        .filter(
          (e) =>
            familyFromEntry(e, enrichment?.licenses[e.source === 'spdx' ? e.id : (e.scancodeKey ?? '')]) === active.family,
        )
        .slice(0, 400);
    }
    if (!active?.test) return bySubject.slice(0, 400);
    return bySubject.filter((e) => active.test!(e, '')).slice(0, 400);
  }, [unified, query, filter, source, subject, enrichment]);


  const addToCompare = (id: string) =>
    setCompareKeys((prev) => (prev.includes(id) || prev.length >= 4 ? prev : [...prev, id]));
  const removeFromCompare = (id: string) => setCompareKeys((prev) => prev.filter((k) => k !== id));

  // 对比项按加入顺序解析回条目；找不到的静默丢弃（例如数据源更新后条目消失）
  const compareEntries = useMemo(
    () =>
      compareKeys
        .map((k) => unified?.find((e) => e.id === k))
        .filter((e): e is UnifiedEntry => Boolean(e)),
    [compareKeys, unified],
  );

  /** 排序后的列表。排序依据由 lib/ordering.ts 决定，并被测试覆盖 */
  const sortedResults = useMemo(
    () => sortLicenses(results, sortKey, { enrichment, terms, licenseTexts }),
    [results, sortKey, enrichment, terms, licenseTexts],
  );

  /** 对比工作台需要正文才能对长尾条目做推断——按需取一次并缓存 */
  useEffect(() => {
    if (!unified) return;
    // 需要正文的只有"没有 ChooseALicense 上游标注、且还没有正文"的条目：
    // 有标注的条目条款是查表得来的，不必为了推断去下载正文。
    const candidates = compareEntries;
    const need = (e: UnifiedEntry) => {
      if (licenseTexts[e.id] !== undefined) return false;
      const key = e.source === 'spdx' ? e.id : (e.scancodeKey ?? '');
      return !lookupTerms(terms, key);
    };
    const wantSpdx = candidates.filter((e) => e.source === 'spdx' && need(e));
    const wantScancode = candidates.filter((e) => e.source === 'scancode' && need(e));
    if (!wantSpdx.length && !wantScancode.length) return;

    let alive = true;
    const jobs: Promise<void>[] = [];
    if (wantSpdx.length) {
      jobs.push(
        loadTexts()
          .then((t) => {
            if (!alive) return;
            setLicenseTexts((prev) => {
              const next = { ...prev };
              for (const e of wantSpdx) if (t.licenses[e.id]) next[e.id] = t.licenses[e.id].licenseText;
              return next;
            });
          })
          .catch(() => undefined),
      );
    }
    if (wantScancode.length) {
      jobs.push(
        import('../lib/spdx.ts')
          .then(({ loadScancodeTexts }) => loadScancodeTexts())
          .then((t) => {
            if (!alive) return;
            setLicenseTexts((prev) => {
              const next = { ...prev };
              for (const e of wantScancode) {
                if (e.scancodeKey && t[e.scancodeKey]) next[e.id] = t[e.scancodeKey];
              }
              return next;
            });
          })
          .catch(() => undefined),
      );
    }
    void Promise.all(jobs);
    return () => {
      alive = false;
    };
  }, [compareEntries, terms, unified, licenseTexts]);

  if (error) {
    return (
      <p className="rounded-lg border border-mandatory/40 bg-mandatory/5 p-4 text-sm text-mandatory">
        {zh ? `许可证目录加载失败：${error}` : `Failed to load the license catalog: ${error}`}
      </p>
    );
  }
  if (!spdx || !stats || !unified) {
    return (
      <div className="rounded-2xl border border-ink-900/10 bg-white p-8 text-center text-sm text-ink-600">
        {zh ? '正在加载 SPDX 与 ScanCode 许可证目录…' : 'Loading the SPDX and ScanCode catalogs…'}
      </div>
    );
  }

  const total = unified.length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-ink-900/10 bg-white p-3 text-sm text-ink-600">
        <p>
          {zh
            ? `这里共有 ${total} 个许可证。其中 ${stats.licenses} 个来自官方名录（SPDX ${stats.version}，${stats.active} 个仍在用，${stats.osiApproved} 个通过 OSI 认证），另外 ${scStats?.total ?? 0} 个是官方名录里没有、但在真实代码里会遇到的。`
            : `${total} licenses in total: ${stats.licenses} from the official list (SPDX ${stats.version}; ${stats.active} still current, ${stats.osiApproved} OSI-approved), plus ${scStats?.total ?? 0} that are not on the official list but do show up in real code.`}
        </p>
        {scStats ? (
          <p className="mt-2 text-xs">
            {zh
              ? `后一类正是官方名录查不到的：商业许可、非商业许可、只开放源码不给修改权的条款、以及各家厂商自定的条款，其中 ${scStats.nonOpen} 个被归为非开源。这类条目**只能用来查证**——"我在代码里看到的这段到底是什么"。它们的名字不在官方名录里，填进配置文件的 license 字段会被工具判为无效。`
              : `That second group is what the official list lacks: commercial, non-commercial, source-available and vendor-specific terms — ${scStats.nonOpen} of them classified as non-open. Use them **for reference only**, to answer "what is this clause I found in the code". Their names are not on the official list, so putting one in a config license field will be rejected as invalid.`}
          </p>
        ) : null}
      </div>

      {/* 宽屏下把左栏放宽一档：筛选器一行放得下更多，右栏详情仍有 900 左右的正文宽度 */}
      <div className="grid gap-6 lg:grid-cols-[26rem_1fr] xl:grid-cols-[30rem_1fr]">
        {/* ---------- 左：搜索与列表 ---------- */}
        <div className="space-y-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={zh ? '搜名字，例如 MPL、996' : 'Search by name, e.g. MPL, 996'}
            className="w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-900"
          />

          {/* 四组筛选：统一为「标签 + 下拉」，标签定宽所以左边缘对齐 */}
          <FilterRow label={zh ? '来源' : 'Source'}>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as SourceFilter)}
              className={selectClass(source !== 'all')}
              aria-label={zh ? '按来源筛选' : 'Filter by source'}
            >
              <option value="all">{zh ? `全部来源（${total}）` : `All sources (${total})`}</option>
              <option value="spdx">{zh ? `官方名录里有的（${stats.licenses}）` : `On the official list (${stats.licenses})`}</option>
              <option value="scancode">{zh ? `其它来源（${scStats?.total ?? 0}）` : `Other sources (${scStats?.total ?? 0})`}</option>
            </select>
          </FilterRow>

          {/* 「用来授权」：按作品类型筛，与"属于哪个集合"是不同维度 */}
          <FilterRow label={zh ? '用来授权' : 'Used for'}>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject | 'all')}
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
              onChange={(e) => setFilter(e.target.value as Filter)}
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
              onChange={(e) => setSortKey(e.target.value as SortKey)}
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

          <p className="text-xs text-ink-400">
            {zh
              ? `匹配 ${sortedResults.length} 个${sortedResults.length >= 400 ? '（仅显示前 400 个，请细化搜索）' : ''}；单击看详情，双击直接选用`
              : `${sortedResults.length} match${sortedResults.length === 1 ? '' : 'es'}${sortedResults.length >= 400 ? ' (showing the first 400; narrow your search)' : ''}; click for details, double-click to use`}
          </p>

          <ul className="max-h-[40rem] space-y-1 overflow-auto rounded-2xl border border-ink-900/10 bg-white p-2">
            {sortedResults.map((l) => {
              const active = focus?.id === l.id;
              const chosen = pickedId === l.id;
              const key = l.source === 'spdx' ? l.id : (l.scancodeKey ?? '');
              const extra = enrichment?.licenses[key];
              const superseded = extra?.osiKeywords?.includes('superseded');
              const nonOpen = isNonOpenCategory(l.category ?? extra?.category);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setFocus(l)}
                    onDoubleClick={() => onPick(l.id, null)}
                    title={zh ? '单击看详情，双击直接选用' : 'Click for details, double-click to use'}
                    className={[
                      'w-full rounded-lg border px-3 py-2 text-left',
                      ROW_TRANSITION,
                      rowEdgeClass(chosen ? 'picked' : active ? 'focused' : 'idle'),
                      rowTintClass(chosen ? 'picked' : active ? 'focused' : 'idle'),
                    ].join(' ')}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <code className="mono text-[11px]">{l.source === 'spdx' ? l.id : l.scancodeKey}</code>
                      {l.source === 'scancode' ? (
                        <span className="rounded bg-ink-900/[0.08] px-1 text-[9px] uppercase tracking-wide text-ink-600">
                          ScanCode
                        </span>
                      ) : null}
                      {chosen ? <span className="rounded-md bg-ok/10 px-2 text-[10px] text-ok">{zh ? '已选' : 'selected'}</span> : null}
                      {nonOpen ? (
                        <span className="rounded-md bg-mandatory/10 px-2 text-[10px] text-mandatory" title={l.category ?? extra?.category}>
                          {zh ? '非开源' : 'not OSS'}
                        </span>
                      ) : null}
                      {superseded ? (
                        <span className="rounded-md bg-advisory/10 px-2 text-[10px] text-advisory">{zh ? '已取代' : 'superseded'}</span>
                      ) : null}
                      {l.deprecated ? (
                        <span className="rounded-md bg-advisory/10 px-2 text-[10px] text-advisory">{zh ? '废弃' : 'deprecated'}</span>
                      ) : null}
                      {l.hasOfficialHeader ? (
                        <span className="rounded-md bg-ink-900/[0.06] px-2 text-[10px] text-ink-600">{zh ? '官方头' : 'header'}</span>
                      ) : null}
                    </span>
                    <span className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[11px] text-ink-600">
                      <span className="truncate">{l.name}</span>
                      {l.category ? <span className="mono text-[10px] text-ink-400">{l.category}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
            {!results.length ? (
              <li className="p-3 text-sm text-ink-400">{zh ? '没有匹配的许可证。' : 'No matching license.'}</li>
            ) : null}
          </ul>
        </div>

        {/* ---------- 右：条款面板 ---------- */}
        <div>
          {focus ? (
            <CatalogDetail
              lang={lang}
              entry={focus}
              spdx={spdx}
              scancode={scancode}
              extra={enrichment?.licenses[focus.source === 'spdx' ? focus.id : (focus.scancodeKey ?? '')]}
              enrichment={enrichment}
              terms={terms}
              picked={pickedId === focus.id}
              activeException={pickedId === focus.id ? exceptionId : null}
              inCompare={compareKeys.includes(focus.id)}
              compareFull={compareKeys.length >= 4}
              onAddCompare={() => addToCompare(focus.id)}
              onPick={(exc) => onPick(focus.id, exc)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-900/20 bg-white p-8 text-center text-sm text-ink-600">
              {zh
                ? '从左边按类别、来源或搜索挑一个许可证查看条款。「用来授权」会告诉你它是给源代码、文档还是内容用的。双击条目可以直接选中并去生成；点面板里的「加入对比」可把最多 4 个许可证摊开横向比较。'
                : 'Pick a license by category, source or search to see its terms — "Applies to" tells you whether it is for source code, documentation or content. Double-click to select and generate; use "Add to comparison" to line up to four licenses side by side.'}
            </div>
          )}
        </div>
      </div>

      {/* ---------- 对比工作台：并入选许可证页，不再单独占一个标签 ---------- */}
      {compareEntries.length ? (
        <CompareBoard
          lang={lang}
          entries={compareEntries}
          enrichment={enrichment}
          terms={terms}
          licenseTexts={licenseTexts}
          pickedId={pickedId}
          onRemove={removeFromCompare}
          onClear={() => setCompareKeys([])}
          onPick={(id) => {
            const entry = unified?.find((e) => e.id === id);
            if (entry) onPick(entry.id, null);
          }}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-ink-900/20 bg-white p-3 text-center text-xs text-ink-400">
          {zh
            ? '对比工作台是空的：在条款面板里点「加入对比」，最多可放 4 个许可证横向比较。'
            : 'The comparison board is empty: use "Add to comparison" in the detail panel to line up to 4 licenses side by side.'}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 详情面板
 * ------------------------------------------------------------------ */

function CatalogDetail({
  lang,
  entry,
  spdx,
  scancode,
  extra,
  enrichment,
  terms,
  picked,
  activeException,
  inCompare,
  compareFull,
  onAddCompare,
  onPick,
}: {
  lang: Lang;
  entry: UnifiedEntry;
  spdx: SpdxSnapshot;
  scancode: ScancodeCatalog | null;
  extra?: EnrichmentRecord;
  enrichment: Enrichment | null;
  terms: ChooseALicenseTerms | null;
  picked: boolean;
  activeException: string | null;
  inCompare: boolean;
  compareFull: boolean;
  onAddCompare: () => void;
  onPick: (exceptionId: string | null) => void;
}) {
  const zh = lang === 'zh';
  const [exceptionQuery, setExceptionQuery] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  const isSpdx = entry.source === 'spdx';
  const scEntry = !isSpdx ? scancode?.entries.find((e) => e.key === entry.scancodeKey) : undefined;
  /**
   * 中文文本来源。两个来源要都看：
   *  · `extra.chinese` —— SPDX 条目走这里（enrichment 只为 SPDX 名录生成记录）
   *  · `enrichment.chinese[key]` —— ScanCode 独有条目走这里
   *
   * 后者是必需的：木兰公共许可证**不在 SPDX 名录里**，只能从 ScanCode 拿到
   * 纯英文副本，它的官方中文正文入口只存在于这张按 ScanCode 键分键的映射里。
   * 早先只看 `extra.chinese`，于是木兰公共的「中文文本」区块整块不显示。
   */
  const chineseText = extra?.chinese ?? enrichment?.chinese?.[isSpdx ? entry.id : (entry.scancodeKey ?? '')];

  // 正文按需加载：只有真正看某一条时才去取，避免浏览列表就下载 13MB
  useEffect(() => {
    let alive = true;
    setText(null);
    if (isSpdx) {
      import('../lib/spdx.ts').then(({ loadTexts }) =>
        loadTexts()
          .then((t) => alive && setText(t.licenses[entry.id]?.licenseText ?? null))
          .catch(() => undefined),
      );
    } else {
      setTextLoading(true);
      import('../lib/spdx.ts')
        .then(({ loadScancodeTexts }) => loadScancodeTexts())
        .then((t) => {
          if (alive) setText(t[entry.scancodeKey ?? ''] ?? null);
        })
        .catch(() => undefined)
        .finally(() => alive && setTextLoading(false));
    }
    return () => {
      alive = false;
    };
  }, [entry.id, entry.scancodeKey, isSpdx]);

  const exceptions = useMemo(() => {
    const q = exceptionQuery.trim().toLowerCase();
    const list = spdx.exceptions.filter((e) => !e.deprecated);
    if (!q) return list.slice(0, 8);
    return list.filter((e) => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)).slice(0, 40);
  }, [spdx.exceptions, exceptionQuery]);

  const prefixGroups = ID_PREFIX_GROUPS.filter((g) => g.test(entry.id)).map((g) => g.label[lang]);

  return (
    <article className="space-y-6 rounded-2xl border border-ink-900/10 bg-white p-6 shadow-sm">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{entry.name}</h2>
          <code className="mono rounded bg-ink-900/[0.06] px-2 py-1 text-xs">
            {isSpdx ? entry.id : entry.scancodeKey}
          </code>
          <span
            className={[
              'rounded-md border px-2 py-1 text-xs',
              isSpdx ? 'border-ink-900/15 text-ink-600' : 'border-advisory/40 bg-advisory/5 text-advisory',
            ].join(' ')}
          >
            {isSpdx ? (zh ? '官方名录' : 'official list') : zh ? '不在官方名录' : 'not on the official list'}
          </span>
          {entry.osiApproved ? (
            <span className="rounded-md border border-ink-900/15 px-2 py-1 text-xs text-ink-600">OSI</span>
          ) : null}
          {entry.deprecated ? (
            <span className="rounded-md border border-advisory/40 bg-advisory/5 px-2 py-1 text-xs text-advisory">
              {zh ? '已废弃' : 'deprecated'}
            </span>
          ) : null}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
          {prefixGroups.length && isSpdx ? (
            <span>
              {zh ? '同系列：' : 'Series: '}
              {prefixGroups.join('、')}
            </span>
          ) : null}
          <span>{plainLength(entry.textLength, zh)}</span>
          <span>
            {entry.hasOfficialHeader
              ? zh
                ? '官方提供了源文件开头的声明模板'
                : 'ships an official source-header template'
              : zh
                ? '官方没有提供声明模板'
                : 'no official source-header template'}
          </span>
        </p>

        {/* 简介：精校条目的用手写定位语，其余按已核实字段生成——两种都会标注来源 */}
        <p className="mt-3 border-l-2 border-ink-900/20 pl-3 text-sm leading-relaxed">
          {(() => {
            const curated = isSpdx ? LICENSE_BY_ID[entry.id] : undefined;
            if (curated) {
              return (
                <>
                  <span className="mr-2 rounded-md bg-ok/10 px-2 py-1 text-[10px] text-ok">
                    {zh ? '精校' : 'curated'}
                  </span>
                  {curated.tagline[lang]}
                </>
              );
            }
            const facts = factsOf(entry, extra, terms, undefined);
            return (
              <>
                <span className="mr-2 rounded-md bg-ink-900/[0.06] px-2 py-1 text-[10px] text-ink-600">
                  {zh ? '按已有信息生成' : 'generated from metadata'}
                </span>
                {generatedIntro(facts, lang)}
              </>
            );
          })()}
        </p>

        {/* 用来授权什么作品——选错这一项，后面条款再对也没用 */}
        {(() => {
          const verdict = subjectsOf(isSpdx ? entry.id : (entry.scancodeKey ?? entry.id), familyFromEntry(entry, extra));
          return (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-ink-400">{zh ? '用来授权' : 'Used for'}</span>
                {verdict.subjects.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-ink-900/15 bg-ink-900/[0.04] px-2 py-1 font-medium"
                  >
                    {SUBJECT_LABEL[s][lang]}
                  </span>
                ))}
                <span className="text-ink-400">
                  {verdict.source === 'curated'
                    ? zh
                      ? '我们逐条填的'
                      : 'curated'
                    : verdict.source === 'rule'
                      ? zh
                        ? '按名字判断的'
                        : 'from the name'
                      : zh
                        ? '按默认值填的，资料里没写'
                        : 'default assumption, not stated in the metadata'}
                </span>
              </div>
              {verdict.note ? (
                <p className="mt-2 rounded-lg border border-ink-900/10 bg-ink-900/[0.02] p-3 text-xs leading-relaxed text-ink-600">
                  {verdict.note[lang]}
                </p>
              ) : null}
            </div>
          );
        })()}
      </header>

      {/* 非 SPDX 条目必须先讲清最要紧的那件事 */}
      {!isSpdx ? (
        <section className="rounded-lg border border-advisory/40 bg-advisory/5 p-3 text-sm">
          <p className="font-medium text-advisory">
            {zh ? '这份许可不在官方名录里，别写进你的配置文件' : 'Not on the official list — do not put this in your config files'}
          </p>
          <p className="mt-2 text-xs text-ink-700">
            {zh
              ? '它的正式记录写法是 '
              : 'Its formal record is written as '}
            <code className="mono">{scEntry?.spdxLicenseKey ?? `LicenseRef-scancode-${entry.scancodeKey}`}</code>
            {zh
              ? '。这个名字在核对资料的场合可以用，但 package.json、Cargo.toml 这类配置文件里的 license 字段只认官方名录里的名字——填这个会被工具判为无效。这一页适合用来查"我在代码里看到的这段条款到底是什么"。'
              : '. That name is fine when you are checking records, but the license field in package.json, Cargo.toml and similar accepts only names from the official list — this one will be rejected as invalid. Use this page to work out "what exactly is this clause I found in the code".'}
          </p>
          <p className="mt-2 text-xs text-ink-600">
            {zh
              ? '来源：ScanCode LicenseDB（CC-BY-4.0）。由第三方逐条整理，但没有走 SPDX 的法律审核流程。'
              : 'Source: ScanCode LicenseDB (CC-BY-4.0), community-curated but outside the SPDX legal review process.'}
          </p>
        </section>
      ) : null}

      {/* 条款事实 */}
      {text ? (
        <InferredTerms
          lang={lang}
          id={isSpdx ? entry.id : (entry.scancodeKey ?? entry.id)}
          text={text}
          osiApproved={entry.osiApproved}
          categoryFamily={familyFromEntry(entry, extra)}
          terms={terms}
          nonOpen={isNonOpenCategory(entry.category ?? extra?.category)}
        />
      ) : (
        <p className="rounded-lg border border-ink-900/10 bg-ink-900/[0.02] p-3 text-xs text-ink-600">
          {textLoading || !text ? (zh ? '正在读取正文…' : 'Loading the license text…') : null}
        </p>
      )}

      {/* 数据出处、兼容性、中文文本、附加例外都是"查资料"时才需要的东西：
          默认收起，避免把第一次选许可证的人淹在术语里 */}
      <details className="rounded-lg border border-ink-900/10 bg-ink-900/[0.015] p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-400">
          {zh
            ? '进阶信息：数据出处、兼容性、中文文本、附加例外'
            : 'Advanced details: sources, compatibility, Chinese text, exceptions'}
        </summary>
        <div className="mt-4 space-y-6">
      {/* 其它数据库的补充信息 */}
      {extra && (extra.category || extra.osiKeywords?.length || extra.copyleft) ? (
        <section className="rounded-lg border border-ink-900/10 bg-ink-900/[0.015] p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {zh ? '其它数据库的补充信息' : 'From other databases'}
          </h3>
          <dl className="mt-2 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            {extra.category ? (
              <Row
                label={zh ? 'ScanCode 的分类' : 'ScanCode category'}
                value={isNonOpenCategory(extra.category) ? (zh ? `${extra.category}（非开源）` : `${extra.category} (not open source)`) : extra.category}
                tone={isNonOpenCategory(extra.category) ? 'bad' : undefined}
              />
            ) : null}
            {extra.owner ? <Row label={zh ? '归谁所有' : 'Owner'} value={extra.owner} /> : null}
            {extra.copyleft ? (
              <Row
                label={zh ? '要不要开源' : 'Must you open-source'}
                value={plainVerdict(extra.copyleft, zh)}
                tone={extra.copyleft === 'No' ? undefined : 'warn'}
              />
            ) : null}
            {extra.sourceDisclosure ? (
              <Row
                label={zh ? '要不要一并给出源码' : 'Must you ship the source'}
                value={plainVerdict(extra.sourceDisclosure, zh)}
                tone={extra.sourceDisclosure === 'No' ? undefined : 'warn'}
              />
            ) : null}
            {extra.osiApprovedDate ? <Row label={zh ? 'OSI 认证时间' : 'OSI approval'} value={extra.osiApprovedDate} mono /> : null}
            {extra.scancodeMatchedVia ? (
              <Row label={zh ? '通过旧名字匹配到' : 'Matched via'} value={extra.scancodeMatchedVia} mono />
            ) : null}
          </dl>
          {extra.osiKeywords?.length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {extra.osiKeywords.map((k) => {
                const note = OSI_KEYWORD_NOTE[k];
                return (
                  <li key={k} className={note && /superseded|non-reusable/.test(k) ? 'text-advisory' : 'text-ink-600'}>
                    {note ? note[lang] : null}
                    {note ? ' ' : null}
                    <code className="mono text-[10px] text-ink-400">{k}</code>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* 兼容性 */}
      {enrichment?.compatibility[entry.id] ? (
        <CompatibilitySection lang={lang} id={entry.id} enrichment={enrichment} />
      ) : null}

      {/* 中文文本 */}
      {chineseText ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">{zh ? '中文文本' : 'Chinese text'}</h3>
          <p className="mt-2 text-xs text-ink-600">
            {chineseText.kind === 'reviewed-translation'
              ? zh
                ? '有开放原子《源译识》经专家评审的中英对照审定稿（译文以 CC0 贡献）。'
                : 'A reviewed Chinese-English final text from the OpenAtom Foundation project (CC0).'
              : zh
                ? '该许可证自带官方中文正文或权利人发布了官方中文文本。'
                : 'This license ships an official Chinese text, or its steward publishes one.'}
          </p>
          {chineseText.note ? <p className="mt-1 text-xs text-advisory">{chineseText.note[lang]}</p> : null}
          <p className="mono mt-2 text-[11px] break-all">
            <a className="underline decoration-dotted" href={chineseText.url} target="_blank" rel="noreferrer noopener">
              {chineseText.url}
            </a>
          </p>
        </section>
      ) : (
        // 没有中文出处时**如实标注**，而不是什么都不显示——否则用户会以为
        // 这个许可有中文、只是我没找到入口。ISC / BSD-2 / Zlib / OFL / CERN-OHL
        // 这 19 个精校的许可就属于"既没有官方中文正文，也没有评审译稿"。
        // 措辞只讲本站收录到什么，不断言"世上没有中文"——不存在的来源里找东西，
        // 结论只能是"我们没有"，不能是"它没有"。
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">{zh ? '中文文本' : 'Chinese text'}</h3>
          <p className="mt-2 text-xs text-ink-600">
            {zh
              ? '本站未收录该许可的中文文本：既没有官方中文正文，也没有经评审的译稿。'
              : 'No Chinese text for this license is included here: neither an official Chinese text nor a reviewed translation.'}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {zh
              ? '不代表世上不存在中文译本——只是本站收录的六个数据源里没有。'
              : 'This does not mean no Chinese translation exists anywhere — only that none of the six sources this site draws from has one.'}
          </p>
        </section>
      )}

      {/* WITH 例外：仅对 SPDX 条目有意义 */}
      {isSpdx ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {zh ? '额外开个口子（附加例外）' : 'Attach an exception'}
          </h3>
          <p className="mt-2 text-xs text-ink-600">
            {zh
              ? '有些许可证允许再附加一条"例外"，放宽某个具体要求。比如 GPL-2.0 加上 Classpath 例外，用这个库时就不必跟着 GPL 开源。例外是一份单独的文件，要跟许可证一起放进仓库，否则别人看不懂你实际给的是什么权利。'
              : 'Some licenses let you attach an exception that relaxes one specific requirement. GPL-2.0 with the Classpath exception, for example, means you can use the library without having to open-source under the GPL. An exception is a separate document and has to ship with the license, or others cannot tell what you actually granted.'}
          </p>
          <input
            value={exceptionQuery}
            onChange={(e) => setExceptionQuery(e.target.value)}
            placeholder={zh ? '搜索例外，例如 Classpath' : 'Search exceptions, e.g. Classpath'}
            className="mt-2 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-xs outline-none focus:border-ink-900"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPick(null)}
              className={[
                'rounded-md border px-3 py-1 text-xs',
                activeException === null ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/15 hover:border-ink-900/40',
              ].join(' ')}
            >
              {zh ? '不使用例外' : 'No exception'}
            </button>
            {exceptions.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onPick(e.id)}
                title={e.name}
                className={[
                  'mono rounded-md border px-3 py-1 text-[11px]',
                  activeException === e.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/15 hover:border-ink-900/40',
                ].join(' ')}
              >
                {e.id}
              </button>
            ))}
          </div>
          {activeException ? (
            <p className="mono mt-2 rounded bg-ink-900/[0.04] p-2 text-xs">
              {entry.id} WITH {activeException}
            </p>
          ) : null}
        </section>
      ) : null}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/10 pt-4">
        <button type="button" onClick={() => onPick(activeException)} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white">
          {picked ? (zh ? '已选择，去生成' : 'Selected — go generate') : zh ? '用这个许可证' : 'Use this license'}
        </button>
        <button
          type="button"
          onClick={onAddCompare}
          disabled={inCompare || compareFull}
          className="rounded-lg border border-ink-900/25 px-4 py-2 text-sm hover:border-ink-900 disabled:opacity-45"
        >
          {inCompare ? (zh ? '已在对比中' : 'In comparison') : zh ? '加入对比' : 'Add to comparison'}
        </button>
        <span className="text-xs text-ink-400">
          {compareFull && !inCompare
            ? zh
              ? '对比最多 4 个，先移出一个再加。'
              : 'Up to 4 in the comparison — remove one first.'
            : zh
              ? '生成时会产出许可证全文、源文件头、NOTICE（可选）、README 段与包管理器字段。'
              : 'Generation produces the license text, source header, optional NOTICE, a README section and manifest fields.'}
        </span>
      </div>
    </article>
  );
}

function Row({ label, value, tone, mono }: { label: string; value: string; tone?: 'bad' | 'warn'; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-600">{label}</dt>
      <dd className={[mono ? 'mono' : '', tone === 'bad' ? 'text-mandatory' : tone === 'warn' ? 'text-advisory' : ''].join(' ')}>
        {value}
      </dd>
    </div>
  );
}

/** 兼容性面板：直接呈现 OSADL 矩阵的逐条判定 */
function CompatibilitySection({ lang, id, enrichment }: { lang: Lang; id: string; enrichment: Enrichment }) {
  const zh = lang === 'zh';
  const [showAll, setShowAll] = useState(false);
  const row = enrichment.compatibility[id] ?? {};
  const entries = Object.entries(row).filter(([other]) => other !== id);
  if (!entries.length) return null;

  const order = { No: 0, 'Check dependency': 1, Unknown: 2, Yes: 3, Same: 4 } as Record<string, number>;
  const sorted = [...entries].sort((a, b) => (order[a[1]] ?? 9) - (order[b[1]] ?? 9) || a[0].localeCompare(b[0]));
  const shown = showAll ? sorted : sorted.slice(0, 24);
  const counts = entries.reduce<Record<string, number>>((acc, [, v]) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});

  return (
    <section>
      <h3 className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {zh ? '能不能和别的许可证一起用' : 'Can it be combined with other licenses'}
        <span className="rounded-md border border-ink-900/15 px-2 py-1 text-[10px] normal-case tracking-normal text-ink-600">
          {zh ? '判定来自 OSADL' : 'verdicts from OSADL'}
        </span>
      </h3>
      <p className="mt-2 text-xs text-ink-600">
        {zh
          ? `OSADL 义务清单对这个许可证给出了 ${entries.length} 条判定：`
          : `The OSADL obligations checklist gives ${entries.length} verdicts for this license: `}
        {Object.entries(counts)
          .sort((a, b) => (order[a[0]] ?? 9) - (order[b[0]] ?? 9))
          .map(([v, n]) => `${COMPATIBILITY_VERDICT[v]?.[lang] ?? v} ${n}`)
          .join(' · ')}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {shown.map(([other, verdict]) => {
          const note = COMPATIBILITY_VERDICT[verdict] ?? COMPATIBILITY_VERDICT.Unknown;
          return (
            <li
              key={other}
              title={`${id} × ${other} → ${note[lang]}`}
              className={[
                'mono rounded border px-2 py-1 text-[11px]',
                note.tone === 'yes'
                  ? 'border-ok/30 text-ok'
                  : note.tone === 'no'
                    ? 'border-mandatory/30 text-mandatory'
                    : 'border-advisory/30 text-advisory',
              ].join(' ')}
            >
              {other}
            </li>
          );
        })}
      </ul>
      {sorted.length > 24 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 rounded border border-ink-900/20 px-2 py-1 text-xs hover:border-ink-900"
        >
          {showAll ? (zh ? '只看前 24 条' : 'Show first 24') : zh ? `展开全部 ${sorted.length} 条` : `Show all ${sorted.length}`}
        </button>
      ) : null}
      <p className="mt-2 text-[10px] text-ink-400">
        {zh
          ? '绿色＝可以一起用，红色＝不能一起用，橙色＝说不准（资料里没写，或要看具体依赖）。鼠标移到缩写上看结论。数据来自 OSADL 义务清单（CC-BY-4.0），不构成法律意见。'
          : 'Green = can be combined, red = cannot, amber = uncertain. Hover an entry for the verdict. Data from the OSADL obligations checklist (CC-BY-4.0); not legal advice.'}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * 对比工作台
 *
 * 原先这是独立的一个标签页，但它与"选许可证"本来就是同一个决策流程——
 * 分成两页只会让人来回切换。现在并入选许可证页：条款面板里点「加入对比」，
 * 选中项在这里横向摊开。
 *
 * 能对比的不只是精校的 32 个：任何条目（含长尾与 ScanCode 独有）都能加入，
 * 只是结论会有"上游标注 / 机器从正文推断"的区别，表里逐列如实标注来源。
 * ------------------------------------------------------------------ */

/** 对比表用到的事实快照——从 UnifiedEntry + 补充数据里一次解析出来 */
/* ------------------------------------------------------------------ *
 * 行状态的视觉语言（列表与对比矩阵共用）
 *
 * 两个视图是同一决策流程里的两种看法，**同一个操作必须给出同样的反馈**——
 * 否则用户会以为行为不一样。此处把"四态"的色板与时长集中定义，两处复用。
 *
 *   idle      无底色，悬停时给淡底色
 *   hover     ink 3% 底色 + ink/20 边
 *   focused   正在右侧预览：ink 5% 底色 + ink 实边
 *   picked    已选用：ok 8% 底色 + ok 实边 + 「已选」药丸
 *
 * 底色刻意用 `color-mix` 而不是 Tailwind 的透明度写法：不透明底色在任何滚动容器里
 * 都不会透出下面的内容，语义也更明确。
 * ------------------------------------------------------------------ */
type RowState = 'idle' | 'focused' | 'picked';

const ROW_TRANSITION = 'transition-colors duration-150';

/*
 * 注意：下面每个类名都写成**完整字面量**。
 * Tailwind 是扫描源码里的字符串来生成样式的，`hover:${X}` 这种拼接出来的类名
 * 既不会被生成、也不会报错——是典型的静默失效。因此宁可重复几遍。
 */
const ROW_TINT: Record<RowState, string> = {
  idle: '',
  focused: 'bg-[color-mix(in_srgb,var(--color-ink-900)_5%,white)]',
  picked: 'bg-[color-mix(in_srgb,var(--color-ok)_8%,white)]',
};

/** 未选中行在悬停时的淡底色 */
const HOVER_TINT = 'hover:bg-[color-mix(in_srgb,var(--color-ink-900)_3%,white)]';

/** idle 时在悬停给出淡底色；非 idle 时保持不变（已在预览/已选，不该被悬停覆盖） */
function rowTintClass(state: RowState): string {
  return state === 'idle' ? HOVER_TINT : ROW_TINT[state];
}

/** 状态边框：列表项是卡片，用整圈边框表达四态 */
function rowEdgeClass(state: RowState): string {
  if (state === 'picked') return 'border-ok';
  if (state === 'focused') return 'border-ink-900';
  return 'border-transparent hover:border-ink-900/20';
}

/**
 * 对比工作台：每张卡片与右侧详情面板同一套版式
 *
 * 早先这里是一张「维度 × 许可证」的表格，14 行里大半是"没提到 / —"，
 * 真正要看的权利与义务反而要横向扫。现在改成每个许可证一张卡：
 * 名称、简介、GitHub 式条款框、选它按钮——与点开详情看到的东西一致。
 */
function CompareBoard({
  lang,
  entries,
  enrichment,
  terms,
  licenseTexts,
  pickedId,
  onRemove,
  onClear,
  onPick,
}: {
  lang: Lang;
  entries: UnifiedEntry[];
  enrichment: Enrichment | null;
  terms: ChooseALicenseTerms | null;
  licenseTexts: Record<string, string>;
  pickedId: string | null;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPick: (id: string) => void;
}) {
  const zh = lang === 'zh';
  const cards = entries.map((e) => {
    const extra = enrichment?.licenses[e.source === 'spdx' ? e.id : (e.scancodeKey ?? '')];
    const facts = factsOf(e, extra, terms, licenseTexts[e.id]);
    const key = e.source === 'spdx' ? e.id : (e.scancodeKey ?? e.id);
    // 条款框与详情面板走同一条路径：有上游标注照抄，没有就从推断的事实映射
    const derived = deriveFacts(key, licenseTexts[e.id] ?? '', e.osiApproved, familyFromEntry(e, extra), terms);
    return {
      facts,
      curated: e.source === 'spdx' ? LICENSE_BY_ID[e.id] : undefined,
      groups: buildTermGroups(lookupTerms(terms, key), derived, facts.nonOpen),
    };
  });

  // 卡片宽度跟着数量走：两个就各占一半，避免四列里空着两张
  const cols =
    entries.length >= 4 ? 'xl:grid-cols-4' : entries.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2';

  return (
    <section className="rounded-2xl border border-ink-900/10 bg-ink-900/[0.015] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">
          {zh ? `对比工作台（${cards.length}/4）` : `Comparison board (${cards.length}/4)`}
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto rounded-lg border border-ink-900/20 px-2 py-1 text-xs hover:border-ink-900"
        >
          {zh ? '清空' : 'Clear'}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-400">
        {zh
          ? '任何条目都能加入对比（含长尾与 ScanCode 独有）。每张卡的条款框与详情面板一致；框底会如实标注"上游标注过"还是"机器猜的"——两者可信度不同，不该看起来一样。'
          : 'Any entry can be compared, including the long tail and ScanCode-only licenses. Each card uses the same terms box as the detail panel, and its footer states whether those terms are upstream-labelled or inferred — they do not deserve to look alike.'}
      </p>

      <div className={['mt-4 grid gap-4 sm:grid-cols-2', cols].join(' ')}>
        {cards.map(({ facts, curated, groups }) => (
          <article key={facts.id} className="flex flex-col rounded-2xl border border-ink-900/10 bg-white p-4">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 text-sm font-semibold">{facts.name}</h3>
              <button
                type="button"
                onClick={() => onRemove(facts.id)}
                className="ml-auto inline-flex shrink-0 items-center rounded p-1 text-ink-400 hover:bg-ink-900/[0.06] hover:text-ink-900"
                aria-label={zh ? '移出对比' : 'Remove from comparison'}
              >
                <X size={12} />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="mono rounded bg-ink-900/[0.06] px-2 py-1 text-[11px]">{facts.displayId}</code>
              {facts.nonOpen ? (
                <span className="rounded-md bg-mandatory/10 px-2 py-1 text-[10px] text-mandatory">
                  {zh ? '非开源' : 'not OSS'}
                </span>
              ) : null}
              {facts.deprecated ? (
                <span className="rounded-md bg-advisory/10 px-2 py-1 text-[10px] text-advisory">
                  {zh ? '废弃' : 'deprecated'}
                </span>
              ) : null}
            </div>

            {/* 简介与详情面板同一套：精校的用手写定位语，其余按已核实字段生成 */}
            <p className="mt-3 border-l-2 border-ink-900/20 pl-3 text-xs leading-relaxed">
              {curated ? (
                <>
                  <span className="mr-2 rounded-md bg-ok/10 px-2 py-1 text-[10px] text-ok">
                    {zh ? '精校' : 'curated'}
                  </span>
                  {curated.tagline[lang]}
                </>
              ) : (
                <>
                  <span className="mr-2 rounded-md bg-ink-900/[0.06] px-2 py-1 text-[10px] text-ink-600">
                    {zh ? '按已有信息生成' : 'generated from metadata'}
                  </span>
                  {generatedIntro(facts, lang)}
                </>
              )}
            </p>

            <div className="mt-4">
              <TermsBox lang={lang} groups={groups} termsSource={facts.termsSource} />
            </div>

            <div className="mt-auto pt-4">
              <button
                type="button"
                onClick={() => onPick(facts.id)}
                className={[
                  'w-full rounded-lg border px-3 py-2 text-sm font-medium transition',
                  pickedId === facts.id
                    ? 'border-ink-900 bg-ink-900 text-white'
                    : 'border-ink-900/20 hover:border-ink-900',
                ].join(' ')}
              >
                {pickedId === facts.id
                  ? zh ? '已选用' : 'Selected'
                  : zh ? `用 ${facts.displayId}` : `Use ${facts.displayId}`}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * GitHub 式条款框
 *
 * GitHub 在每个仓库页展示的许可证框（Permissions / Limitations /
 * Conditions 三组，绿勾、红叉、蓝色 i）用的词表就是 ChooseALicense 的
 * vocabulary。本站对 47 个主流许可证有同一份上游标注，所以能原样呈现；
 * 不在标注范围内的长尾条目，则从已推断出的条款事实映射回同一套标签，
 * 并在框底如实标注"机器猜的"。
 *
 * 用户要求三组**纵向排列**（GitHub 是横向三列，窄屏放不下，纵向更稳）。
 * ------------------------------------------------------------------ */

/** 词表标签的双语文案：label 是条目名，desc 是"这对我意味着什么" */
const TERM_TAGS: Record<string, { zh: { label: string; desc: string }; en: { label: string; desc: string } }> = {
  'commercial-use': {
    zh: { label: '商用', desc: '可以用在商业项目里：卖钱、闭源产品都不违反这份许可。' },
    en: { label: 'Commercial use', desc: 'You may use it in commercial products, including closed-source ones.' },
  },
  modifications: {
    zh: { label: '修改', desc: '可以直接改它的源码。' },
    en: { label: 'Modification', desc: 'You may modify the source code.' },
  },
  distribution: {
    zh: { label: '分发', desc: '可以把原始版本或你改过的版本发布给别人。' },
    en: { label: 'Distribution', desc: 'You may share the original or your modified version.' },
  },
  'private-use': {
    zh: { label: '私用', desc: '自己或公司内部使用，不必公开任何改动。' },
    en: { label: 'Private use', desc: 'You may use and modify it privately without releasing anything.' },
  },
  'patent-use': {
    zh: { label: '专利授权', desc: '作者明确授予你使用其相关专利的权利。' },
    en: { label: 'Patent use', desc: 'The license explicitly grants rights to the contributors’ patents.' },
  },
  'include-copyright': {
    zh: { label: '保留版权与许可声明', desc: '分发时必须带上版权声明和许可证全文。' },
    en: { label: 'License and copyright notice', desc: 'Include the copyright notice and the license text when you distribute.' },
  },
  'include-copyright--source': {
    zh: { label: '源码内保留声明', desc: '以源码形式分发时要带上声明，纯二进制分发可豁免。' },
    en: { label: 'License and copyright notice for source', desc: 'The notice is required in source form; binaries are exempt.' },
  },
  'document-changes': {
    zh: { label: '说明变更', desc: '改过的文件里要注明你做了修改。' },
    en: { label: 'State changes', desc: 'Modified files must document the changes you made.' },
  },
  'disclose-source': {
    zh: { label: '公开源码', desc: '分发时（包括你改过的版本）必须把源码一并给到接收方。' },
    en: { label: 'Disclose source', desc: 'When you distribute, you must make the source code available.' },
  },
  'network-use-disclose': {
    zh: { label: '做成网站也要公开源码', desc: '把它跑成在线服务给别人用，同样触发开源义务——这是它区别于普通 GPL 的地方。' },
    en: { label: 'Network use is distribution', desc: 'Running it as a service for others also triggers the source-disclosure duty.' },
  },
  'same-license': {
    zh: { label: '整体同许可', desc: '基于它的衍生作品，整个项目都必须用同一份许可发布。' },
    en: { label: 'Same license (work)', desc: 'Derivative works as a whole must be released under the same license.' },
  },
  'same-license--file': {
    zh: { label: '文件级同许可', desc: '只有被修改的那些文件要保持同许可，你新写的其余代码可以另作安排。' },
    en: { label: 'Same license (file)', desc: 'Only the modified files stay under the same license; new code need not.' },
  },
  'same-license--library': {
    zh: { label: '库级同许可', desc: '闭源程序可以链接使用它，但库本身的修改必须回馈。' },
    en: { label: 'Same license (library)', desc: 'Proprietary programs may link to it; changes to the library itself must be shared back.' },
  },
  'trademark-use': {
    zh: { label: '不含商标授权', desc: '不授予商标权：不能借它的名字或 logo 为你的产品增信。' },
    en: { label: 'Trademark use', desc: 'No trademark rights are granted — its name and logo stay off-limits for promotion.' },
  },
  liability: {
    zh: { label: '责任限制', desc: '使用它造成损失时，作者和贡献者不承担赔偿责任。' },
    en: { label: 'Liability', desc: 'The authors are not liable for damages arising from use.' },
  },
  warranty: {
    zh: { label: '无担保', desc: '按"现状"提供，没有任何质量或适用性担保。' },
    en: { label: 'Warranty', desc: 'Provided "as is", with no warranty of any kind.' },
  },
};

/** 三组的展示顺序与图标配色：与 GitHub 的框一致（绿勾 / 红叉 / 蓝 i） */
const TERM_GROUPS: {
  key: 'permissions' | 'limitations' | 'conditions';
  zh: string;
  en: string;
  tone: string;
  Icon: (props: { className?: string }) => React.ReactNode;
}[] = [
  { key: 'permissions', zh: '权限', en: 'Permissions', tone: 'text-ok', Icon: Check },
  { key: 'limitations', zh: '限制', en: 'Limitations', tone: 'text-mandatory', Icon: X },
  { key: 'conditions', zh: '条件', en: 'Conditions', tone: 'text-info', Icon: Info },
];

/**
 * `patent-use` 在上游词表里同名反义：出现在 permissions 表示"授予专利"，
 * 出现在 limitations 表示"明确不授予"。渲染时必须按所在组区分文案，
 * 否则限制组里会出现一句"作者明确授予你……"，自相矛盾。
 */
function termMeta(tag: string, group: 'permissions' | 'limitations' | 'conditions', zh: boolean) {
  if (group === 'limitations' && tag === 'patent-use') {
    return zh
      ? { label: '不含专利授权', desc: '正文明确不授予任何专利使用权——想保留专利主张时这一条要紧。' }
      : { label: 'Patent use', desc: 'The license explicitly grants no patent rights.' };
  }
  return TERM_TAGS[tag]?.[zh ? 'zh' : 'en'];
}

/** 把条目解析成三组标签：有上游标注直接照抄，没有就从推断出的条款事实映射 */
function buildTermGroups(
  cal: { permissions: string[]; conditions: string[]; limitations: string[] } | null,
  facts: DerivedFactsLike,
  nonOpen: boolean,
): Record<'permissions' | 'limitations' | 'conditions', string[]> {
  if (cal) return { permissions: cal.permissions, limitations: cal.limitations, conditions: cal.conditions };

  const permissions: string[] = [];
  if (!nonOpen) permissions.push('commercial-use', 'modifications', 'distribution', 'private-use');
  if (facts.patentGrant === 'explicit') permissions.push('patent-use');

  const conditions: string[] = [];
  if (facts.includeCopyright === 'required') conditions.push('include-copyright');
  else if (facts.includeCopyright === 'source-only') conditions.push('include-copyright--source');
  if (facts.stateChanges) conditions.push('document-changes');
  if (facts.sameLicenseWholeWork) conditions.push('disclose-source', 'same-license');
  if (facts.sameLicensePerFile) conditions.push('disclose-source', 'same-license--file');
  if (facts.networkTrigger) conditions.push('network-use-disclose');

  const limitations = ['trademark-use', 'liability', 'warranty'];
  if (facts.patentGrant === 'none') limitations.push('patent-use');

  return { permissions, limitations, conditions };
}

/** buildTermGroups 需要的最小事实集合（deriveFacts 的返回值天然满足） */
interface DerivedFactsLike {
  patentGrant: 'explicit' | 'none' | 'silent';
  stateChanges: boolean;
  sameLicenseWholeWork: boolean;
  sameLicensePerFile: boolean;
  networkTrigger: boolean;
  includeCopyright: 'required' | 'source-only' | 'not-required' | 'silent';
}

/**
 * GitHub 式条款框本体。
 *
 * 详情面板与对比工作台共用同一个组件：两边各写一份的话，
 * 改一处文案另一处就会悄悄落后，用户看到的"同一份许可"会有两套说法。
 */
function TermsBox({
  lang,
  groups,
  termsSource,
}: {
  lang: Lang;
  groups: Record<'permissions' | 'limitations' | 'conditions', string[]>;
  termsSource: 'choosealicense' | 'text';
}) {
  const zh = lang === 'zh';
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-900/10 bg-ink-900/[0.02]">
      {TERM_GROUPS.map((g) => {
        const tags = groups[g.key].filter((t) => termMeta(t, g.key, zh));
        if (!tags.length) return null;
        return (
          <div key={g.key} className="border-t border-ink-900/[0.08] first:border-t-0">
            <h4 className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
              {zh ? g.zh : g.en}
            </h4>
            <ul className="space-y-2 px-4 pb-4">
              {tags.map((t) => {
                const m = termMeta(t, g.key, zh)!;
                return (
                  <li key={t} className="flex gap-2">
                    <g.Icon className={`mt-0.5 shrink-0 ${g.tone}`} />
                    <span>
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-ink-600">{m.desc}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2 border-t border-ink-900/[0.08] px-4 py-3 text-xs text-ink-400">
        <span
          className={[
            'rounded-md border px-2 py-1 text-[10px]',
            termsSource === 'choosealicense'
              ? 'border-ok/40 bg-ok/5 text-ok'
              : 'border-advisory/40 bg-advisory/5 text-advisory',
          ].join(' ')}
        >
          {termsSource === 'choosealicense'
            ? zh
              ? '上游逐条标注过'
              : 'upstream-labelled'
            : zh
              ? '机器从正文猜的，别当定论'
              : 'inferred from the text — not authoritative'}
        </span>
        <span>
          {zh
            ? '以上内容不构成法律意见，正式判断请以许可证原文为准。'
            : 'This is not legal advice — for a real decision, read the license text.'}
        </span>
      </div>
    </div>
  );
}

/** 从正文推断条款，并把"这是推断"写在明面上 */
function InferredTerms({
  lang,
  id,
  text,
  osiApproved,
  categoryFamily,
  terms,
  nonOpen,
}: {
  lang: Lang;
  id: string;
  text: string;
  osiApproved: boolean;
  categoryFamily?: string;
  terms: ChooseALicenseTerms | null;
  nonOpen: boolean;
}) {
  const zh = lang === 'zh';
  const facts = useMemo(
    () => deriveFacts(id, text, osiApproved, categoryFamily, terms),
    [id, text, osiApproved, categoryFamily, terms],
  );

  const familySourceNote =
    facts.familySource === 'scancode-category'
      ? zh
        ? 'ScanCode 数据库给它的分类'
        : 'a category from the ScanCode database'
      : facts.familySource === 'spdx-id'
        ? zh
          ? '它的 SPDX 名字'
          : 'its SPDX identifier'
        : zh
          ? '读正文猜的（最不可靠的一档）'
          : 'text matching (the least reliable tier)';

  const rows: { label: string; value: string; tone?: 'yes' | 'no' | 'warn' }[] = [
    {
      label: zh ? '许可类型' : 'License type',
      value: `${FAMILY_LABEL[facts.family][lang]}　${FAMILY_PLAIN[facts.family]?.[lang] ?? ''}`,
    },
    {
      // 最基础的一条义务：分发时要不要带上版权声明与许可证全文。
      // 只有 0BSD / CC0 / MIT-0 / Unlicense / WTFPL 五个明确不要求。
      label: zh ? '保留版权声明与许可证' : 'Keep the copyright notice and license',
      value:
        facts.includeCopyright === 'required'
          ? zh ? '要带上：分发时要附上版权声明和许可证全文' : 'yes — include the notice and the full license when you distribute'
          : facts.includeCopyright === 'source-only'
            ? zh ? '只在源码里要带，二进制分发不必' : 'only in source form; binaries are exempt'
            : facts.includeCopyright === 'not-required'
              ? zh ? '不要求：连署名都不要求' : 'not required — not even attribution'
              : zh ? '正文没写（不等于没义务：版权法本身通常要求保留声明）' : 'not stated in the text — which is not the same as no duty: copyright law usually requires it',
      tone: facts.includeCopyright === 'silent' ? 'warn' : undefined,
    },
    {
      label: zh ? '专利' : 'Patents',
      value:
        facts.patentGrant === 'explicit'
          ? zh ? '明确授予了专利使用权' : 'grants patent rights'
          : facts.patentGrant === 'none'
            ? zh ? '明确说了不授予' : 'grants none'
            : zh ? '没提到（不等于安全）' : 'not mentioned — which is not the same as safe',
      tone: facts.patentGrant === 'explicit' ? 'yes' : facts.patentGrant === 'none' ? 'no' : 'warn',
    },
    {
      label: zh ? '做成网站给别人用' : 'Running it as a service',
      value: facts.networkTrigger ? (zh ? '也要开源' : 'must publish source') : zh ? '不需要开源' : 'no extra duty',
      tone: facts.networkTrigger ? 'yes' : 'no',
    },
    {
      label: zh ? '新项目是否开源' : 'Must your new project be open source',
      value: facts.sameLicenseWholeWork
        ? zh ? '要：整个项目都得用同一许可开源' : 'yes — the whole project must ship under the same license'
        : facts.sameLicensePerFile
          ? zh ? '只有改过的那几个文件要开源，新写的代码可以不开源' : 'only the files you modified; newly written code need not be'
          : zh ? '不用：新项目可以闭源' : 'no — your project can stay closed source',
    },
    {
      // 背书与促销是两种不同性质的行为，条款也常分开写，所以列成两条：
      //   背书 = 意见表达（"XX 官方推荐本产品"）——借别人的信誉为你增信
      //   促销 = 市场行为（"本产品基于 XX 的技术"）——借别人的知名度吸引流量
      // 实测 262 个许可两者都禁、53 个只禁背书、4 个只禁促销，
      // 合成一条会让那 57 个的结论失真。
      //
      // 也与「商标」不是一回事：商标讲能不能用它的商品名，
      // Apache-2.0 有商标条款却不禁这两项，BSD-3-Clause 才是典型。
      label: zh ? '用作者名义背书' : 'Endorsement with their names',
      value:
        facts.endorse === 'prohibited'
          ? zh ? '不许：不能说"作者认可/推荐本产品"' : 'not allowed: you may not imply they endorse or recommend your product'
          : zh ? '正文没写（不等于可以：借别人信誉增信通常要另行取得同意）' : 'not stated — which does not mean it is allowed; borrowing their credibility usually needs separate consent',
      tone: facts.endorse === 'silent' ? 'warn' : 'no',
    },
    {
      label: zh ? '用作者名义促销' : 'Promotion with their names',
      value:
        facts.promote === 'prohibited'
          ? zh ? '不许：不能在宣传里说"本产品基于作者的技术"' : 'not allowed: you may not advertise your product as built on their work'
          : zh ? '正文没写（不等于可以：用别人名义做宣传通常要另行取得同意）' : 'not stated — which does not mean it is allowed; promoting with their name usually needs separate consent',
      tone: facts.promote === 'silent' ? 'warn' : 'no',
    },
    {
      label: zh ? '变更说明' : 'Change notices',
      value: facts.stateChanges ? (zh ? '要写明改了什么' : 'yes') : zh ? '没有要求' : 'not required',
      tone: facts.stateChanges ? 'yes' : undefined,
    },
    {
      // 商标一律是"不授权"。区别只在于许可有没有**明写**这一句。
      //
      // ChooseALicense 对 `trademark-use` 的说明很直白："This license explicitly
      // states that it does NOT grant trademark rights, **even though licenses
      // without such a statement probably do not grant any implicit trademark
      // rights**."——没写的那 32 个（含 MIT、BSD、GPL）实质上也一样不授权。
      //
      // 所以默认文案就是"不授权"，只有明写了才额外标出"许可里写明了"。
      // 早先写成"没提到"，会让人以为 MIT 的商标情况比 Apache-2.0 宽松，
      // 那是把用户往错的方向引。
      label: zh ? '商标' : 'Trademarks',
      value: facts.trademarkClause
        ? zh ? '不授予商标权（许可里写明了）' : 'no trademark rights, stated explicitly'
        : zh ? '不授予商标权（许可里没写，但同样不授权）' : 'no trademark rights — not stated, but still not granted',
    },
  ];

  // GitHub 式条款框的数据：47 个上游标注过的直接照抄，其余从推断出的事实映射
  const groups = buildTermGroups(lookupTerms(terms, id), facts, nonOpen);

  return (
    <section className="space-y-4">
      {/* GitHub 式条款框：三组纵向堆叠（GitHub 横向三列，这里窄屏放不下，改纵向） */}
      <TermsBox lang={lang} groups={groups} termsSource={facts.termsSource} />

      {/* 白话逐条解释收进折叠区：条款框负责"一眼看懂有什么权利"，这里负责"细看每一项的边界" */}
      <details className="rounded-lg border border-ink-900/10 bg-white p-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-400">
          {zh ? '这份许可的几条关键规定（逐条白话）' : 'What this license actually requires, line by line'}
        </summary>
        <dl className="mt-2 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="border-b border-ink-900/[0.06] pb-2 text-sm last:border-0">
            <dt className="text-ink-600">{r.label}</dt>
            <dd
              className={[
                'mt-1',
                r.tone === 'yes' ? 'text-ok' : r.tone === 'no' ? 'text-ink-400' : r.tone === 'warn' ? 'text-advisory' : '',
              ].join(' ')}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-600">
        {facts.termsSource === 'choosealicense'
          ? zh
            ? '以上几条是上游逐条标注的，可以放心参考。'
            : 'These were labelled upstream and can be relied on.'
          : zh
            ? '以上几条是机器读正文猜的，只能当参考。要下正式判断请打开许可证原文。'
            : 'These were inferred by machine from the text — treat them as a hint only. For a real decision, read the license itself.'}
      </p>
      <details className="mt-2 rounded-lg border border-ink-900/10 p-3 text-xs text-ink-600">
        <summary className="cursor-pointer text-ink-400">{zh ? '这些结论是怎么来的' : 'Where these conclusions come from'}</summary>
        <div className="mt-2 space-y-2">
          <p>
            {zh
              ? `许可类型来自：${familySourceNote}。`
              : `License type comes from: ${familySourceNote}.`}
          </p>
          <p>
            {facts.termsSource === 'choosealicense'
              ? zh
                ? '其余几条来自 ChooseALicense 的词表逐条标注（覆盖 47 个主流许可证），比机器读正文可靠得多。它的词表分成 permissions / conditions / limitations 三段，其中 `patent-use` 在 permissions 里表示"授予专利"、在 limitations 里表示"不授予专利"，合并时已按段区分。'
                : 'The rest come from ChooseALicense’s upstream-labelled vocabulary (47 mainstream licenses), which is far more reliable than machine reading. Its vocabulary splits into permissions / conditions / limitations, and `patent-use` means "grants patents" under permissions but "grants none" under limitations — that distinction is handled when merging.'
              : zh
                ? '其余几条由许可证正文的关键词匹配得出。这个许可证不在 ChooseALicense 的 47 个标注范围内，所以只能这样。我们宁可标注"不确定"，也不给一个看起来确定的答案。'
                : 'The rest come from keyword matching over the license text, because this license is outside ChooseALicense’s 47 labelled entries. We label the uncertainty rather than show a confident answer we cannot back.'}
          </p>
        </div>
      </details>
      </details>
    </section>
  );
}
