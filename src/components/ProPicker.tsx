'use client';

import { useEffect, useMemo, useState } from 'react';
import { type SortKey, sortLicenses } from '../lib/ordering.ts';
import {
  type ChooseALicenseTerms,
  catalogStats,
  type Enrichment,
  familyFromEntry,
  getUnifiedCatalog,
  loadCatalog,
  loadEnrichment,
  loadScancodeCatalog,
  loadTerms,
  loadTexts,
  lookupTerms,
  type ScancodeCatalog,
  type SpdxSnapshot,
  scancodeStats,
  searchUnified,
  type UnifiedEntry,
} from '../lib/spdx.ts';
import { matchesSubject, type Subject } from '../lib/subject.ts';
import type { Lang } from '../lib/types.ts';
import { CatalogDetail } from './pro/CatalogDetail';
import { CompareBoard } from './pro/CompareBoard';
import { FEATURED, FILTERS, type Filter, PickerFilters, type SourceFilter } from './pro/ProFilters';
import { LicenseList } from './pro/ProList';

interface Props {
  lang: Lang;
  pickedId: string | null;
  exceptionId: string | null;
  onPick: (id: string, exceptionId?: string | null) => void;
}

/**
 * 选许可证页的编排层。
 *
 * 只管三件事：加载目录数据、持有筛选/选中/对比状态、把数据分给子组件。
 * 具体的筛选控件、列表、详情面板与对比工作台都在 `./pro/` 下——
 * 拆开的目的是让每一块能单独读，而不是让这里变成第二个巨型文件。
 */
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
      matchesSubject(
        e,
        subject,
        familyFromEntry(e, enrichment?.licenses[e.source === 'spdx' ? e.id : (e.scancodeKey ?? '')]),
      ),
    );
    if (query.trim()) return searchUnified(bySubject, query, 400);
    const active = FILTERS.find((f) => f.id === filter);
    if (filter === 'featured') {
      return FEATURED.map((id) => bySubject.find((e) => e.id === id)).filter((e): e is UnifiedEntry =>
        Boolean(e),
      );
    }
    // 按许可类型分类：判定与详情面板同一套，所以筛出来的与点开看到的一致
    if (active?.family) {
      return bySubject
        .filter(
          (e) =>
            familyFromEntry(e, enrichment?.licenses[e.source === 'spdx' ? e.id : (e.scancodeKey ?? '')]) ===
            active.family,
        )
        .slice(0, 400);
    }
    if (!active?.test) return bySubject.slice(0, 400);
    return bySubject.filter((e) => active.test?.(e, '')).slice(0, 400);
  }, [unified, query, filter, source, subject, enrichment]);

  const addToCompare = (id: string) =>
    setCompareKeys((prev) => (prev.includes(id) || prev.length >= 4 ? prev : [...prev, id]));
  const removeFromCompare = (id: string) => setCompareKeys((prev) => prev.filter((k) => k !== id));

  // 对比项按加入顺序解析回条目；找不到的静默丢弃（例如数据源更新后条目消失）
  const compareEntries = useMemo(
    () =>
      compareKeys.map((k) => unified?.find((e) => e.id === k)).filter((e): e is UnifiedEntry => Boolean(e)),
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
          <PickerFilters
            lang={lang}
            query={query}
            onQueryChange={setQuery}
            source={source}
            onSourceChange={setSource}
            subject={subject}
            onSubjectChange={setSubject}
            filter={filter}
            onFilterChange={setFilter}
            sortKey={sortKey}
            onSortChange={setSortKey}
            total={total}
            licenseCount={stats.licenses}
            scancodeTotal={scStats?.total ?? 0}
          />

          <p className="text-xs text-ink-400">
            {zh
              ? `匹配 ${sortedResults.length} 个${sortedResults.length >= 400 ? '（仅显示前 400 个，请细化搜索）' : ''}；单击看详情，双击直接选用`
              : `${sortedResults.length} match${sortedResults.length === 1 ? '' : 'es'}${sortedResults.length >= 400 ? ' (showing the first 400; narrow your search)' : ''}; click for details, double-click to use`}
          </p>

          <LicenseList
            lang={lang}
            sortedResults={sortedResults}
            focusId={focus?.id ?? null}
            pickedId={pickedId}
            enrichment={enrichment}
            setFocus={setFocus}
            onPick={onPick}
          />
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
