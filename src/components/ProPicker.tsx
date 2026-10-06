'use client';

import { useEffect, useMemo, useState } from 'react';
import { FAMILY_LABEL, LICENSE_BY_ID } from '../lib/licenses.ts';
import {
  compareDimensions,
  factsOf,
  generatedIntro,
  type CompareFacts,
  type Dimension,
} from '../lib/compare.ts';
import { SUBJECT_LABEL, subjectsOf } from '../lib/subject.ts';
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

type Filter = 'featured' | 'osi' | 'copyleft' | 'public-domain' | 'content' | 'hardware' | 'china' | 'deprecated' | 'all';

const FILTERS: { id: Filter; zh: string; en: string; test?: (l: UnifiedEntry) => boolean }[] = [
  { id: 'featured', zh: '最常用', en: 'Most used' },
  { id: 'osi', zh: 'OSI 认证', en: 'OSI approved', test: (l) => l.osiApproved && !l.deprecated },
  { id: 'copyleft', zh: '著佐权 GPL 家族', en: 'Copyleft (GPL family)', test: (l) => /^(A|L)?GPL-/.test(l.id) },
  { id: 'public-domain', zh: '公共领域', en: 'Public domain', test: (l) => /^(CC0|Unlicense|WTFPL|0BSD|CC-PDDC)/.test(l.id) },
  { id: 'content', zh: '内容与数据', en: 'Content and data', test: (l) => /^CC-/.test(l.id) },
  { id: 'hardware', zh: '开源硬件', en: 'Open hardware', test: (l) => /OHL|^TAPR|Solderpad/.test(l.id) },
  { id: 'china', zh: '中国主导', en: 'China-led', test: (l) => /^Mulan/.test(l.id) },
  { id: 'deprecated', zh: '已废弃', en: 'Deprecated', test: (l) => l.deprecated },
  { id: 'all', zh: '全部', en: 'All' },
];

/** "最常用"是人工筛选的高频短名单，而不是按字母序的前几十个 */
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
  /**
   * 左栏的呈现方式：
   *  - `list`  —— 列表：按需检索、看详情，适合"我已经知道要找什么"；
   *  - `matrix` —— 矩阵：行是许可证、列是全部维度，适合"先扫一遍有哪些选择"。
   * 两者不是替代关系，因此做成同一页上的切换，而不是两个标签页。
   */
  const [view, setView] = useState<'list' | 'matrix'>('list');
  const [focus, setFocus] = useState<UnifiedEntry | null>(null);
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
    if (query.trim()) return searchUnified(bySource, query, 400);
    const predicate = FILTERS.find((f) => f.id === filter)?.test;
    if (filter === 'featured') {
      return FEATURED.map((id) => bySource.find((e) => e.id === id)).filter((e): e is UnifiedEntry => Boolean(e));
    }
    if (!predicate) return bySource.slice(0, 400);
    return bySource.filter(predicate).slice(0, 400);
  }, [unified, query, filter, source]);

  /**
   * 矩阵里列哪些条目。
   *
   * 与列表不同，矩阵需要**一眼看全**，所以范围以"筛选"为准而不是以搜索为准：
   *  - 默认（最常用 / 无筛选）→ 人工整理的 32 个：全部条款都经核对，每格都可信；
   *  - 一旦选了某个筛选或数据源 → 该范围的全部条目，最多 80 行（再多就不叫"一眼看全"了）。
   * 这样可以既保持默认视图的密度，又能在需要时把某个类别摊开看。
   */
  const matrixRows = useMemo(() => {
    if (!unified) return [];
    const bySource = unified.filter((e) =>
      source === 'all' ? true : source === 'spdx' ? e.source === 'spdx' : e.source === 'scancode',
    );
    const predicate = FILTERS.find((f) => f.id === filter)?.test;
    if (filter === 'featured') {
      return FEATURED.map((id) => bySource.find((e) => e.id === id)).filter((e): e is UnifiedEntry => Boolean(e));
    }
    const scoped = predicate ? bySource.filter(predicate) : bySource;
    return scoped.slice(0, 80);
  }, [unified, filter, source]);

  const scopeLabel = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    const src = source === 'all' ? { zh: '全部来源', en: 'all sources' } : source === 'spdx' ? { zh: '仅 SPDX', en: 'SPDX only' } : { zh: '仅 ScanCode', en: 'ScanCode only' };
    const base = filter === 'featured' ? { zh: '最常用', en: 'most used' } : (f ? { zh: f.zh, en: f.en } : { zh: '全部', en: 'all' });
    return { zh: `${base.zh}（${src.zh}）`, en: `${base.en} (${src.en})` };
  }, [filter, source]);

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

  /** 对比与矩阵都需要正文才能对长尾条目做推断——按需取一次并缓存 */
  const [licenseTexts, setLicenseTexts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!unified) return;
    // 需要正文的只有"没有 ChooseALicense 人工标注、且还没有正文"的条目：
    // 有标注的条目条款是查表得来的，不必为了推断去下载正文。
    const candidates = [...compareEntries, ...matrixRows];
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
  }, [compareEntries, matrixRows, terms, unified, licenseTexts]);

  if (error) {
    return (
      <p className="rounded-lg border border-mandatory/40 bg-mandatory/5 p-4 text-sm text-mandatory">
        {zh ? `许可证目录加载失败：${error}` : `Failed to load the license catalog: ${error}`}
      </p>
    );
  }
  if (!spdx || !stats || !unified) {
    return (
      <div className="rounded-xl border border-ink-900/10 bg-white p-8 text-center text-sm text-ink-600">
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
            ? `收录两家数据源合计 ${total} 个可选许可证：SPDX License List ${stats.version} 的 ${stats.licenses} 个（${stats.active} 个现行、${stats.osiApproved} 个 OSI 认证），加上 ScanCode LicenseDB 独有的 ${scStats?.total ?? 0} 个。`
            : `${total} selectable licenses from two sources: ${stats.licenses} from SPDX License List ${stats.version} (${stats.active} current, ${stats.osiApproved} OSI-approved) plus ${scStats?.total ?? 0} that exist only in ScanCode LicenseDB.`}
        </p>
        {scStats ? (
          <p className="mt-1.5 text-xs">
            {zh
              ? `ScanCode 独有的那部分正是 SPDX 查不到的：它涵盖商业许可、非商业许可、source-available 与各类厂商条款，其中 ${scStats.nonOpen} 个被归类为非开源。这类条目定位为**参考与审计**——它们的写法是 LicenseRef-scancode-*，不能填进 package.json 的 license 字段。`
              : `The ScanCode-only part covers what SPDX lacks: commercial, non-commercial, source-available and vendor terms — ${scStats.nonOpen} of them classified as non-open. Those entries are for **reference and audit**: their form is LicenseRef-scancode-*, which cannot go into a package.json license field.`}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[26rem_1fr]">
        {/* ---------- 左：搜索与列表 ---------- */}
        <div className="space-y-3">
          {/* 视图切换：「列表」用来找，「矩阵」用来比 */}
          <div
            role="tablist"
            aria-label={zh ? '呈现方式' : 'View'}
            className="flex gap-1 rounded-lg border border-ink-900/15 bg-white p-1"
          >
            {(
              [
                ['list', zh ? '列表' : 'List', zh ? '按需检索、看条款详情' : 'search and read one at a time'],
                ['matrix', zh ? '对比矩阵' : 'Matrix', zh ? '一眼看全所有维度' : 'see every dimension at once'],
              ] as const
            ).map(([id, label, note]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id as 'list' | 'matrix')}
                className={[
                  'flex-1 rounded-md px-3 py-1.5 text-center text-sm transition',
                  view === id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/[0.05]',
                ].join(' ')}
              >
                <span className="block font-medium">{label}</span>
                <span className={['block text-[10px]', view === id ? 'text-white/70' : 'text-ink-400'].join(' ')}>{note}</span>
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // 搜索结果用矩阵展示会失去"一眼看全"的意义，因此输入时自动回到列表
              if (e.target.value.trim()) setView('list');
            }}
            placeholder={zh ? '搜索标识符、名称或 ScanCode key，例如 MPL / 996' : 'Search identifier, name or ScanCode key, e.g. MPL / 996'}
            className="w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-900"
          />

          {/* 数据源：这是本页最重要的一个筛选，因为它决定"能不能写进清单字段" */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-400">{zh ? '来源' : 'Source'}</span>
            {(
              [
                ['all', zh ? '全部' : 'All', total],
                ['spdx', 'SPDX', stats.licenses],
                ['scancode', 'ScanCode', scStats?.total ?? 0],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSource(id as SourceFilter)}
                className={[
                  'rounded-full border px-2.5 py-1 text-xs transition',
                  source === id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/15 hover:border-ink-900/40',
                ].join(' ')}
              >
                {label} <span className="opacity-60">{count}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={[
                  'rounded-full border px-2.5 py-1 text-xs transition',
                  filter === f.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/15 hover:border-ink-900/40',
                ].join(' ')}
              >
                {zh ? f.zh : f.en}
              </button>
            ))}
          </div>

          <p className="text-xs text-ink-400">
            {view === 'list'
              ? zh
                ? `匹配 ${results.length} 个${results.length >= 400 ? '（仅显示前 400 个，请细化搜索）' : ''}；点条目看条款详情`
                : `${results.length} match${results.length === 1 ? '' : 'es'}${results.length >= 400 ? ' (showing the first 400; narrow your search)' : ''}; click an entry for its terms`
              : zh
                ? `矩阵列出 ${matrixRows.length} 行（当前范围：${scopeLabel.zh}）`
                : `The matrix lists ${matrixRows.length} rows (scope: ${scopeLabel.en})`}
          </p>

          {view === 'list' ? (
            <ul className="max-h-[40rem] space-y-0.5 overflow-auto rounded-xl border border-ink-900/10 bg-white p-1.5">
            {results.map((l) => {
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
                      'w-full rounded-lg border px-2.5 py-1.5 text-left',
                      ROW_TRANSITION,
                      rowEdgeClass(chosen ? 'picked' : active ? 'focused' : 'idle', 'card'),
                      rowTintClass(chosen ? 'picked' : active ? 'focused' : 'idle'),
                    ].join(' ')}
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <code className="mono text-[11px]">{l.source === 'spdx' ? l.id : l.scancodeKey}</code>
                      {l.source === 'scancode' ? (
                        <span className="rounded bg-ink-900/[0.08] px-1 text-[9px] uppercase tracking-wide text-ink-600">
                          ScanCode
                        </span>
                      ) : null}
                      {chosen ? <span className="rounded-full bg-ok/10 px-1.5 text-[10px] text-ok">{zh ? '已选' : 'selected'}</span> : null}
                      {nonOpen ? (
                        <span className="rounded-full bg-mandatory/10 px-1.5 text-[10px] text-mandatory" title={l.category ?? extra?.category}>
                          {zh ? '非开源' : 'not OSS'}
                        </span>
                      ) : null}
                      {superseded ? (
                        <span className="rounded-full bg-advisory/10 px-1.5 text-[10px] text-advisory">{zh ? '已取代' : 'superseded'}</span>
                      ) : null}
                      {l.deprecated ? (
                        <span className="rounded-full bg-advisory/10 px-1.5 text-[10px] text-advisory">{zh ? '废弃' : 'deprecated'}</span>
                      ) : null}
                      {l.hasOfficialHeader ? (
                        <span className="rounded-full bg-ink-900/[0.06] px-1.5 text-[10px] text-ink-600">{zh ? '官方头' : 'header'}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px] text-ink-600">
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
          ) : (
            <CompareMatrix
              lang={lang}
              entries={matrixRows}
              enrichment={enrichment}
              terms={terms}
              licenseTexts={licenseTexts}
              pickedId={pickedId}
              focusedId={focus?.id ?? null}
              scopeLabel={scopeLabel}
              onFocus={(id) => setFocus(unified.find((e) => e.id === id) ?? null)}
              onUse={(id) => onPick(id, null)}
              onAddCompare={addToCompare}
            />
          )}
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
            <div className="rounded-xl border border-dashed border-ink-900/20 bg-white p-8 text-center text-sm text-ink-600">
              {view === 'matrix'
                ? zh
                  ? '左边是矩阵视图：行是许可证、列是维度，适合先扫一遍再挑。点任意一行看该许可证的完整条款。'
                  : 'The left side is the matrix: rows are licenses, columns are dimensions — good for scanning first. Click any row for its full terms.'
                : zh
                  ? '从左边按类别、来源或搜索挑一个许可证查看条款。双击条目可以直接选中并去生成；点条款面板里的「加入对比」可横向比较。'
                  : 'Pick a license by category, source or search to see its terms. Double-click to select and generate; use "Add to comparison" in the detail panel to line licenses up side by side.'}
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
    <article className="space-y-5 rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{entry.name}</h2>
          <code className="mono rounded bg-ink-900/[0.06] px-1.5 py-0.5 text-xs">
            {isSpdx ? entry.id : entry.scancodeKey}
          </code>
          <span
            className={[
              'rounded-full border px-2 py-0.5 text-xs',
              isSpdx ? 'border-ink-900/15 text-ink-600' : 'border-advisory/40 bg-advisory/5 text-advisory',
            ].join(' ')}
          >
            {isSpdx ? 'SPDX' : 'ScanCode（非 SPDX）'}
          </span>
          {entry.osiApproved ? (
            <span className="rounded-full border border-ink-900/15 px-2 py-0.5 text-xs text-ink-600">OSI</span>
          ) : null}
          {entry.deprecated ? (
            <span className="rounded-full border border-advisory/40 bg-advisory/5 px-2 py-0.5 text-xs text-advisory">
              {zh ? '已废弃' : 'deprecated'}
            </span>
          ) : null}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
          {prefixGroups.length && isSpdx ? (
            <span>
              {zh ? '族：' : 'Family: '}
              {prefixGroups.join('、')}
            </span>
          ) : null}
          <span>
            {zh ? '正文 ' : ''}
            {entry.textLength.toLocaleString()} {zh ? '字符' : 'characters'}
          </span>
          <span>
            {entry.hasOfficialHeader
              ? zh
                ? '自带官方文件头模板'
                : 'ships an official file header'
              : zh
                ? '无官方文件头模板'
                : 'no official file header'}
          </span>
        </p>

        {/* 简介：人工整理的用手写定位语，其余按已核实字段生成——两种都会标注来源 */}
        <p className="mt-3 border-l-2 border-ink-900/20 pl-3 text-sm leading-relaxed">
          {(() => {
            const curated = isSpdx ? LICENSE_BY_ID[entry.id] : undefined;
            if (curated) {
              return (
                <>
                  <span className="mr-2 rounded-full bg-ok/10 px-1.5 py-0.5 text-[10px] text-ok">
                    {zh ? '人工整理' : 'hand-curated'}
                  </span>
                  {curated.tagline[lang]}
                </>
              );
            }
            const facts = factsOf(entry, extra, terms, undefined);
            return (
              <>
                <span className="mr-2 rounded-full bg-ink-900/[0.06] px-1.5 py-0.5 text-[10px] text-ink-600">
                  {zh ? '按元数据生成' : 'generated from metadata'}
                </span>
                {generatedIntro(facts, lang)}
              </>
            );
          })()}
        </p>

        {/* 适用于：这个许可证是用来授权什么作品的。与"条款字段"一样标注判定依据 */}
        {(() => {
          const verdict = subjectsOf(isSpdx ? entry.id : (entry.scancodeKey ?? entry.id), familyFromEntry(entry, extra));
          return (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-ink-400">{zh ? '适用于' : 'Applies to'}</span>
                {verdict.subjects.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-ink-900/15 bg-ink-900/[0.04] px-2 py-0.5 font-medium"
                  >
                    {SUBJECT_LABEL[s][lang]}
                  </span>
                ))}
                <span className="text-ink-400">
                  {verdict.source === 'curated'
                    ? zh
                      ? '人工指定'
                      : 'hand-assigned'
                    : verdict.source === 'rule'
                      ? zh
                        ? '按标识符判定'
                        : 'from identifier'
                      : zh
                        ? '默认判定，未在元数据中标注'
                        : 'default assumption, not stated in the metadata'}
                </span>
              </div>
              {verdict.note ? (
                <p className="mt-2 rounded-lg border border-ink-900/10 bg-ink-900/[0.02] p-2.5 text-xs leading-relaxed text-ink-600">
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
            {zh ? '这是非 SPDX 许可证，写法不能填进清单字段' : 'Non-SPDX license: its form cannot go into a manifest field'}
          </p>
          <p className="mt-1.5 text-xs text-ink-700">
            {zh
              ? `它在 SPDX 文档里的写法是 `
              : 'In SPDX documents it is written as '}
            <code className="mono">{scEntry?.spdxLicenseKey ?? `LicenseRef-scancode-${entry.scancodeKey}`}</code>
            {zh
              ? '。这个字面量可以用在 SPDX 文档与 SBOM 里，但 **package.json / Cargo.toml 的 license 字段只接受 SPDX 标识符**，写成这样会被工具判定为无效。这类条目适合用来核对"我在代码里看到的这段条款到底是什么"。'
              : '. That literal is valid in SPDX documents and SBOMs, but **the license field of package.json / Cargo.toml accepts only SPDX identifiers** and will treat it as invalid. These entries are for working out "what exactly is this clause I found in the code".'}
          </p>
          <p className="mt-1.5 text-xs text-ink-600">
            {zh
              ? '来源：ScanCode LicenseDB（CC-BY-4.0），经过人工策展，但不是 SPDX 的法律审核流程。'
              : 'Source: ScanCode LicenseDB (CC-BY-4.0), human-curated but outside the SPDX legal review process.'}
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
        />
      ) : (
        <p className="rounded-lg border border-ink-900/10 bg-ink-900/[0.02] p-3 text-xs text-ink-600">
          {textLoading || !text ? (zh ? '正在读取正文…' : 'Loading the license text…') : null}
        </p>
      )}

      {/* 第三方补充数据 */}
      {extra && (extra.category || extra.osiKeywords?.length || extra.copyleft) ? (
        <section className="rounded-lg border border-ink-900/10 bg-ink-900/[0.015] p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {zh ? '第三方补充数据' : 'Third-party metadata'}
          </h3>
          <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            {extra.category ? (
              <Row label={zh ? '分类' : 'Category'} value={extra.category} tone={isNonOpenCategory(extra.category) ? 'bad' : undefined} />
            ) : null}
            {extra.owner ? <Row label={zh ? '归属方' : 'Owner'} value={extra.owner} /> : null}
            {extra.copyleft ? (
              <Row label="copyleft" value={extra.copyleft} tone={extra.copyleft === 'No' ? undefined : 'warn'} />
            ) : null}
            {extra.sourceDisclosure ? (
              <Row label={zh ? '源码披露义务' : 'Source disclosure'} value={extra.sourceDisclosure} tone={extra.sourceDisclosure === 'No' ? undefined : 'warn'} />
            ) : null}
            {extra.osiApprovedDate ? <Row label={zh ? 'OSI 批准日期' : 'OSI approval'} value={extra.osiApprovedDate} mono /> : null}
            {extra.scancodeMatchedVia ? (
              <Row label={zh ? '经历史标识符匹配' : 'Matched via'} value={extra.scancodeMatchedVia} mono />
            ) : null}
          </dl>
          {extra.osiKeywords?.length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {extra.osiKeywords.map((k) => {
                const note = OSI_KEYWORD_NOTE[k];
                return (
                  <li key={k} className={note && /superseded|non-reusable/.test(k) ? 'text-advisory' : 'text-ink-600'}>
                    <code className="mono">{k}</code>
                    {note ? ` — ${note[lang]}` : ''}
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
      {extra?.chinese ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">{zh ? '中文文本' : 'Chinese text'}</h3>
          <p className="mt-1.5 text-xs text-ink-600">
            {extra.chinese.kind === 'reviewed-translation'
              ? zh
                ? '有开放原子《源译识》经专家评审的中英对照审定稿（译文以 CC0 贡献）。'
                : 'A reviewed Chinese-English final text from the OpenAtom Foundation project (CC0).'
              : zh
                ? '该许可证自带官方中文正文或权利人发布了官方中文文本。'
                : 'This license ships an official Chinese text, or its steward publishes one.'}
          </p>
          {extra.chinese.note ? <p className="mt-1 text-xs text-advisory">{extra.chinese.note[lang]}</p> : null}
          <p className="mono mt-1.5 text-[11px] break-all">
            <a className="underline decoration-dotted" href={extra.chinese.url} target="_blank" rel="noreferrer noopener">
              {extra.chinese.url}
            </a>
          </p>
        </section>
      ) : null}

      {/* WITH 例外：仅对 SPDX 条目有意义 */}
      {isSpdx ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {zh ? '附加例外（SPDX 表达式的 WITH）' : 'Attach an exception (SPDX WITH)'}
          </h3>
          <p className="mt-1.5 text-xs text-ink-600">
            {zh
              ? '例如把 GPL-2.0-only 与 Classpath-exception-2.0 组合。例外是独立文本，必须与许可证一起分发，否则下游无法判断实际授予的权利范围。'
              : 'For example combining GPL-2.0-only with Classpath-exception-2.0. An exception is a separate document and must ship with the license, or downstream users cannot tell what was granted.'}
          </p>
          <input
            value={exceptionQuery}
            onChange={(e) => setExceptionQuery(e.target.value)}
            placeholder={zh ? '搜索例外，例如 Classpath' : 'Search exceptions, e.g. Classpath'}
            className="mt-2 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-xs outline-none focus:border-ink-900"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onPick(null)}
              className={[
                'rounded-full border px-2.5 py-1 text-xs',
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
                  'mono rounded-full border px-2.5 py-1 text-[11px]',
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
        {zh ? '与其它许可证的组合判定' : 'Combining with other licenses'}
        <span className="rounded-full border border-ink-900/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-ink-600">
          {zh ? 'OSADL 兼容矩阵' : 'OSADL matrix'}
        </span>
      </h3>
      <p className="mt-1.5 text-xs text-ink-600">
        {zh ? `OSADL 义务清单给出了 ${entries.length} 条判定：` : `The OSADL obligations checklist provides ${entries.length} verdicts: `}
        {Object.entries(counts)
          .sort((a, b) => (order[a[0]] ?? 9) - (order[b[0]] ?? 9))
          .map(([v, n]) => `${v} ${n}`)
          .join(' · ')}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {shown.map(([other, verdict]) => {
          const note = COMPATIBILITY_VERDICT[verdict] ?? COMPATIBILITY_VERDICT.Unknown;
          return (
            <li
              key={other}
              title={`${id} × ${other} → ${verdict}（${note[lang]}）`}
              className={[
                'mono rounded border px-1.5 py-0.5 text-[11px]',
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
          ? '绿色=可组合，红色=不可组合，橙色=不确定（Unknown / 取决于依赖）。数据来自 OSADL 义务清单（CC-BY-4.0），以其自身免责声明为前提，不构成法律意见。'
          : 'Green = may combine, red = may not, amber = uncertain. Data from the OSADL obligations checklist (CC-BY-4.0) under its own disclaimer; not legal advice.'}
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
 * 能对比的不只是人工整理的 32 个：任何条目（含长尾与 ScanCode 独有）都能加入，
 * 只是条款字段会有"人工标注 / 正文推断"的区别，表里逐列如实标注来源。
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
 * 底色刻意用 `color-mix` 而不是透明度：矩阵首列是 sticky 定位，必须是**不透明**底色，
 * 否则横向滚动时下方内容会透出来。两个视图用同一组不透明色，看起来才真的相同。
 * ------------------------------------------------------------------ */
export type RowState = 'idle' | 'focused' | 'picked';

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
/** 同上，但由整行 hover 驱动，供 sticky 首列使用（首列有独立底色，不会被行底色带动） */
const GROUP_HOVER_TINT = 'group-hover:bg-[color-mix(in_srgb,var(--color-ink-900)_3%,white)]';

/** idle 时在悬停给出淡底色；非 idle 时保持不变（已在预览/已选，不该被悬停覆盖） */
function rowTintClass(state: RowState): string {
  return state === 'idle' ? HOVER_TINT : ROW_TINT[state];
}

/**
 * 状态边框。列表是卡片，用整圈边框；矩阵是表格行，用**左缘**竖条
 * ——表格行加整圈圆角边框在 border-collapse 下会错位，左缘竖条是等效且稳妥的表达。
 */
function rowEdgeClass(state: RowState, kind: 'card' | 'table'): string {
  if (kind === 'card') {
    if (state === 'picked') return 'border-ok';
    if (state === 'focused') return 'border-ink-900';
    return 'border-transparent hover:border-ink-900/20';
  }
  if (state === 'picked') return 'border-l-2 border-l-ok';
  if (state === 'focused') return 'border-l-2 border-l-ink-900';
  return 'border-l-2 border-l-transparent';
}

/** 把维度定义里的原始单元格值渲染成界面元素 */
function renderCell(d: Dimension, r: CompareFacts, lang: Lang): React.ReactNode {
  const value = d.cell(r);
  const zh = lang === 'zh';
  if (d.kind === 'yesno') {
    return value === true ? (
      <span className="text-ok">●</span>
    ) : (
      <span className="text-ink-400">○</span>
    );
  }
  if (value === null || value === undefined || value === '') return <span className="text-ink-400">—</span>;
  if (d.label === '专利授权' || d.label === 'Patent grant') {
    if (value === 'explicit') return <span className="text-ok">{zh ? '明确授予' : 'grants'}</span>;
    if (value === 'none') return <span className="text-mandatory">{zh ? '明确不授' : 'grants none'}</span>;
    return <span className="text-ink-400">{zh ? '未提及' : 'silent'}</span>;
  }
  if (d.label === '条款来源' || d.label === 'Terms from') {
    return value === 'text' || value === '正文推断' || value === 'inferred' ? (
      <span className="text-advisory">{value === 'text' ? (zh ? '正文推断' : 'inferred') : value}</span>
    ) : (
      <span className="text-ok">{typeof value === 'string' && (value === 'choosealicense' || value === '人工标注' || value === 'hand-labelled') ? (zh ? '人工标注' : 'hand-labelled') : value}</span>
    );
  }
  if (d.label === '来源' || d.label === 'Source') {
    return <span className={value === 'ScanCode' ? 'text-advisory' : ''}>{value}</span>;
  }
  if (d.kind === 'muted-text') return <span className="mono text-[11px]">{value}</span>;
  return <span className="text-[11px]">{value}</span>;
}

/**
 * 对比矩阵：一眼看全。
 *
 * 与对比工作台的分工：
 *  - **矩阵**（这里）回答"有哪些选择、它们互相差在哪"——行是许可证、列是维度，可排序；
 *  - **工作台**回答"我挑的这几个具体差在哪"——列是许可证、行是维度，能放长尾与 ScanCode 独有条目。
 * 两者共用 lib/compare.ts 里的同一份维度定义与事实解析，口径不会打架。
 *
 * 交互与列表**完全一致**（同一套心智，不该两样）：
 *  - 单击整行 → 右侧面板显示该许可证的完整条款
 *  - 双击整行 → 直接选用并跳到生成
 *  - 行末按钮 → 「＋」加入对比工作台，「用它」等于双击
 */
function CompareMatrix({
  lang,
  entries,
  enrichment,
  terms,
  licenseTexts,
  pickedId,
  focusedId,
  scopeLabel,
  onFocus,
  onUse,
  onAddCompare,
}: {
  lang: Lang;
  entries: UnifiedEntry[];
  enrichment: Enrichment | null;
  terms: ChooseALicenseTerms | null;
  licenseTexts: Record<string, string>;
  pickedId: string | null;
  /** 右侧面板当前正在预览的条目——矩阵必须把它标出来，否则点了没有任何反馈 */
  focusedId: string | null;
  scopeLabel: { zh: string; en: string };
  /** 单击：在右侧面板展示详情 */
  onFocus: (id: string) => void;
  /** 双击或点「用它」：选用该许可证并跳到生成 */
  onUse: (id: string) => void;
  onAddCompare: (id: string) => void;
}) {
  const zh = lang === 'zh';
  const [sortKey, setSortKey] = useState<'id' | 'family' | 'patent' | 'closed'>('id');
  const dims = useMemo(() => compareDimensions(lang), [lang]);

  const rows = useMemo(() => {
    const built = entries.map((e) =>
      factsOf(e, enrichment?.licenses[e.source === 'spdx' ? e.id : (e.scancodeKey ?? '')], terms, licenseTexts[e.id]),
    );
    const rank: Record<string, number> = { permissive: 0, 'public-domain': 1, content: 2, 'weak-copyleft': 3, 'strong-copyleft': 4, 'network-copyleft': 5 };
    const sorted = [...built];
    if (sortKey === 'id') sorted.sort((a, b) => a.displayId.localeCompare(b.displayId));
    else if (sortKey === 'family') sorted.sort((a, b) => (rank[a.family] ?? 9) - (rank[b.family] ?? 9) || a.displayId.localeCompare(b.displayId));
    else if (sortKey === 'patent')
      sorted.sort(
        (a, b) =>
          (['explicit', 'silent', 'none'].indexOf(a.facts.patentGrant) - ['explicit', 'silent', 'none'].indexOf(b.facts.patentGrant)) ||
          a.displayId.localeCompare(b.displayId),
      );
    else
      sorted.sort(
        (a, b) =>
          Number(b.family === 'permissive' || b.family === 'public-domain') -
            Number(a.family === 'permissive' || a.family === 'public-domain') || a.displayId.localeCompare(b.displayId),
      );
    return sorted;
  }, [entries, enrichment, terms, licenseTexts, sortKey]);

  const SORTS: { id: typeof sortKey; zh: string; en: string }[] = [
    { id: 'id', zh: '按标识符', en: 'By identifier' },
    { id: 'family', zh: '按宽松程度', en: 'By permissiveness' },
    { id: 'patent', zh: '按专利授权', en: 'By patent grant' },
    { id: 'closed', zh: '按能否闭源', en: 'By closed-source' },
  ];

  return (
    <section className="rounded-xl border border-ink-900/15 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{zh ? '对比矩阵：一眼看全' : 'Comparison matrix: see it all at once'}</h2>
        <span className="rounded-full border border-ink-900/15 px-2 py-0.5 text-[10px] text-ink-600">
          {scopeLabel[lang]} · {rows.length} {zh ? '行' : 'rows'}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-400">
        {zh
          ? '行是许可证、列是维度，鼠标移到列标题看判定依据。操作方式与列表一致：单击看详情，双击直接选用；行末「＋」加入下方工作台细看。想换范围就用上面的筛选与来源。'
          : 'Rows are licenses, columns are dimensions — hover a column header for the basis. Same interaction as the list: click for details, double-click to use; "+" adds it to the board below. Change the scope with the filters and source above.'}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-ink-400">{zh ? '排序' : 'Sort'}</span>
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSortKey(s.id)}
            className={[
              'rounded-full border px-2.5 py-1 text-xs transition',
              sortKey === s.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/15 hover:border-ink-900/40',
            ].join(' ')}
          >
            {zh ? s.zh : s.en}
          </button>
        ))}
      </div>

      <div className="table-scroll mt-3">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-900/10 bg-ink-900/[0.03] text-left">
              <th className="sticky left-0 z-10 bg-[color-mix(in_srgb,var(--color-ink-900)_4%,white)] p-2 font-semibold">
                {zh ? '许可证' : 'License'}
              </th>
              {dims.map((d) => (
                <th key={d.label} className="whitespace-nowrap p-2 text-xs font-semibold" title={d.hint}>
                  <span className="border-b border-dotted border-ink-400">{d.label}</span>
                </th>
              ))}
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const state: RowState = pickedId === r.id ? 'picked' : focusedId === r.id ? 'focused' : 'idle';
              return (
              <tr
                key={r.id}
                onClick={() => onFocus(r.id)}
                onDoubleClick={() => onUse(r.id)}
                title={zh ? '单击看详情，双击直接选用' : 'Click for details, double-click to use'}
                className={[
                  'group cursor-pointer border-b border-ink-900/[0.06] last:border-0',
                  ROW_TRANSITION,
                  rowTintClass(state),
                ].join(' ')}
              >
                <th
                  scope="row"
                  className={[
                    // sticky 首列必须有**不透明**底色，否则横向滚动时内容会透出来；
                    // 因此这里用与整行相同的 color-mix 实色，而不是透明度
                    'sticky left-0 z-10 p-2 text-left font-medium',
                    ROW_TRANSITION,
                    rowEdgeClass(state, 'table'),
                    state === 'idle' ? `bg-white ${GROUP_HOVER_TINT}` : ROW_TINT[state],
                  ].join(' ')}
                >
                  {/* 行本身不可聚焦，这个按钮承担键盘可达性：Enter 等同于单击 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocus(r.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onUse(r.id);
                    }}
                    className="block max-w-[16rem] truncate text-left hover:underline"
                    title={r.name}
                  >
                    <code className="mono text-xs">{r.displayId}</code>
                    {pickedId === r.id ? (
                      <span className="ml-1.5 rounded-full bg-ok/10 px-1.5 text-[10px] text-ok">{zh ? '已选' : 'picked'}</span>
                    ) : null}
                  </button>
                  <span className="mt-0.5 block max-w-[16rem] truncate text-[11px] font-normal text-ink-600">{r.name}</span>
                </th>
                {dims.map((d) => (
                  <td key={d.label} className="whitespace-nowrap p-2 text-xs" title={d.hint}>
                    {renderCell(d, r, lang)}
                  </td>
                ))}
                <td className="p-2 text-right">
                  <span className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        // 阻止冒泡：否则会连带触发整行的"看详情"
                        e.stopPropagation();
                        onAddCompare(r.id);
                      }}
                      className="rounded border border-ink-900/20 px-1.5 py-0.5 text-xs hover:border-ink-900"
                      title={zh ? '加入对比工作台' : 'Add to the comparison board'}
                    >
                      ＋
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUse(r.id);
                      }}
                      className="rounded border border-ink-900/20 px-2 py-0.5 text-xs hover:border-ink-900 hover:bg-ink-900 hover:text-white"
                      title={zh ? '选用并去生成' : 'Use and generate'}
                    >
                      {zh ? '用它' : 'Use'}
                    </button>
                  </span>
                </td>
              </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={dims.length + 2} className="p-3 text-sm text-ink-400">
                  {zh ? '当前筛选下没有条目。' : 'No entries under the current filter.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <details className="mt-3 rounded-lg border border-ink-900/10 p-3 text-xs">
        <summary className="cursor-pointer font-medium">{zh ? '列的含义与依据' : 'What the columns mean'}</summary>
        <dl className="mt-2 space-y-2">
          {dims.map((d) => (
            <div key={d.label} className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              <dt className="font-medium">{d.label}</dt>
              <dd className="text-ink-600">{d.hint ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

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
  const rows = entries.map((e) =>
    factsOf(
      e,
      enrichment?.licenses[e.source === 'spdx' ? e.id : (e.scancodeKey ?? '')],
      terms,
      licenseTexts[e.id],
    ),
  );

  // 与对比矩阵共用同一份维度定义，两处口径不会打架
  const dims = compareDimensions(lang);

  return (
    <section className="rounded-xl border border-ink-900/15 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">
          {zh ? `对比工作台（${rows.length}/4）` : `Comparison board (${rows.length}/4)`}
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto rounded border border-ink-900/20 px-2 py-1 text-xs hover:border-ink-900"
        >
          {zh ? '清空' : 'Clear'}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-400">
        {zh
          ? '任何条目都能加入对比（含长尾与 ScanCode 独有）。「条款来源」一列会如实区分人工标注与正文推断——两者的可信度不同，不该看起来一样。'
          : 'Any entry can be compared, including the long tail and ScanCode-only licenses. The "Terms from" row distinguishes hand-labelled from inferred — they do not deserve to look alike.'}
      </p>

      <div className="table-scroll mt-3">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-900/10">
              <th className="sticky left-0 z-10 bg-white p-2 text-left text-xs font-medium text-ink-400">
                {zh ? '维度' : 'Dimension'}
              </th>
              {rows.map((r) => (
                <th key={r.id} className="min-w-[10rem] p-2 text-left align-top">
                  <span className="flex flex-wrap items-center gap-1">
                    <code className="mono text-[11px]">{r.displayId}</code>
                    <button
                      type="button"
                      onClick={() => onRemove(r.id)}
                      className="rounded px-1 text-[10px] text-ink-400 hover:bg-ink-900/[0.06] hover:text-ink-900"
                      aria-label={zh ? '移出对比' : 'Remove from comparison'}
                    >
                      ✕
                    </button>
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-ink-600">{r.name}</span>
                  {r.nonOpen ? (
                    <span className="mt-0.5 inline-block rounded-full bg-mandatory/10 px-1.5 text-[10px] text-mandatory">
                      {zh ? '非开源' : 'not OSS'}
                    </span>
                  ) : null}
                  {r.deprecated ? (
                    <span className="mt-0.5 inline-block rounded-full bg-advisory/10 px-1.5 text-[10px] text-advisory">
                      {zh ? '废弃' : 'deprecated'}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dims.map((d) => (
              <tr key={d.label} className="border-b border-ink-900/[0.06] last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white p-2 text-left text-xs font-normal text-ink-600"
                  title={d.hint}
                >
                  {d.label}
                </th>
                {rows.map((r) => (
                  <td key={r.id} className="p-2 text-xs">
                    {renderCell(d, r, lang)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r.id)}
            className={[
              'rounded border px-2 py-1 text-xs',
              pickedId === r.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/20 hover:border-ink-900',
            ].join(' ')}
          >
            {pickedId === r.id ? (zh ? '已选用' : 'Selected') : zh ? `用 ${r.displayId}` : `Use ${r.displayId}`}
          </button>
        ))}
      </div>
    </section>
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
}: {
  lang: Lang;
  id: string;
  text: string;
  osiApproved: boolean;
  categoryFamily?: string;
  terms: ChooseALicenseTerms | null;
}) {
  const zh = lang === 'zh';
  const facts = useMemo(
    () => deriveFacts(id, text, osiApproved, categoryFamily, terms),
    [id, text, osiApproved, categoryFamily, terms],
  );

  const familySourceNote =
    facts.familySource === 'scancode-category'
      ? zh
        ? '家族判定来自 ScanCode LicenseDB 的分类型'
        : 'family from a ScanCode LicenseDB category'
      : facts.familySource === 'spdx-id'
        ? zh
          ? '家族判定来自 SPDX 标识符'
          : 'family from the SPDX identifier'
        : zh
          ? '家族判定来自正文文本匹配（最不可靠的一档）'
          : 'family from text matching (the least reliable tier)';

  const rows: { label: string; value: string; tone?: 'yes' | 'no' | 'warn' }[] = [
    { label: zh ? '家族判定' : 'Family', value: `${FAMILY_LABEL[facts.family][lang]}（${familySourceNote}）` },
    {
      label: zh ? '专利条款' : 'Patent terms',
      value:
        facts.patentGrant === 'explicit'
          ? zh ? '正文含专利授权表述' : 'text grants patents'
          : facts.patentGrant === 'none'
            ? zh ? '正文明确不授权' : 'text explicitly grants none'
            : zh ? '正文未提及' : 'not mentioned',
      tone: facts.patentGrant === 'explicit' ? 'yes' : facts.patentGrant === 'none' ? 'no' : 'warn',
    },
    {
      label: zh ? '网络服务触发' : 'Network use triggers',
      value: facts.networkTrigger ? (zh ? '是' : 'yes') : zh ? '否' : 'no',
      tone: facts.networkTrigger ? 'yes' : 'no',
    },
    {
      label: zh ? '衍生作品同许可' : 'Derivatives same license',
      value: facts.sameLicenseWholeWork
        ? zh ? '整部作品' : 'whole work'
        : facts.sameLicensePerFile
          ? zh ? '仅被改文件' : 'modified files only'
          : zh ? '无要求' : 'none',
    },
    {
      label: zh ? '须标注改动' : 'Mark changes',
      value: facts.stateChanges ? (zh ? '是' : 'yes') : zh ? '未提及' : 'not mentioned',
      tone: facts.stateChanges ? 'yes' : undefined,
    },
    {
      label: zh ? '商标条款' : 'Trademark clause',
      value: facts.trademarkClause ? (zh ? '有提及' : 'mentioned') : zh ? '未提及' : 'not mentioned',
    },
  ];

  return (
    <section>
      <h3 className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {zh ? '条款字段' : 'Term fields'}
        <span
          className={[
            'rounded-full border px-2 py-0.5 text-[10px] normal-case tracking-normal',
            facts.termsSource === 'choosealicense'
              ? 'border-ok/40 bg-ok/5 text-ok'
              : 'border-advisory/40 bg-advisory/5 text-advisory',
          ].join(' ')}
        >
          {facts.termsSource === 'choosealicense'
            ? zh
              ? '来自 ChooseALicense 的人工标注'
              : 'hand-labelled by ChooseALicense'
            : zh
              ? '由正文推断，非权威认定'
              : 'inferred from text, not authoritative'}
        </span>
      </h3>
      <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-ink-900/[0.06] py-1 text-sm">
            <dt className="text-ink-600">{r.label}</dt>
            <dd className={r.tone === 'yes' ? 'text-ok' : r.tone === 'no' ? 'text-ink-400' : r.tone === 'warn' ? 'text-advisory' : ''}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-400">
        {facts.termsSource === 'choosealicense'
          ? zh
            ? '这些字段取自 ChooseALicense 用固定词表做的**人工标注**（47 个主流许可证覆盖范围内），比正文正则可靠得多。词表本身分 permissions / conditions / limitations 三段，其中 `patent-use` 在 permissions 里表示"授予专利"，在 limitations 里表示"不授予专利"，已在合并时按段区分。'
            : 'These fields come from ChooseALicense’s **hand-labelled** vocabulary (covering 47 mainstream licenses), which is far more reliable than regex over the text. Note its vocabulary splits into permissions / conditions / limitations, and `patent-use` means "grants patents" under permissions but "grants none" under limitations — that distinction is handled when merging.'
          : zh
            ? '以上结论由许可证正文的关键词匹配得出（该许可证不在 ChooseALicense 的 47 个标注范围内）。我们选择如实标注而不是给出看起来确定的勾。正式合规判断请以原文与 SPDX / ScanCode 页面为准。'
            : 'These conclusions come from keyword matching over the license text (this license is outside ChooseALicense’s 47 labelled entries). We label the uncertainty instead of showing a confident tick. For a formal decision, go by the text and the SPDX / ScanCode page.'}
      </p>
    </section>
  );
}
