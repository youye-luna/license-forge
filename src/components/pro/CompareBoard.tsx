'use client';

import { factsOf, generatedIntro } from '../../lib/compare.ts';
import { LICENSE_BY_ID } from '../../lib/licenses.ts';
import {
  type ChooseALicenseTerms,
  deriveFacts,
  type Enrichment,
  familyFromEntry,
  lookupTerms,
  type UnifiedEntry,
} from '../../lib/spdx.ts';
import type { Lang } from '../../lib/types.ts';
import { X } from '../Icons';
import { buildTermGroups, TermsBox } from './TermsBox';

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

/**
 * 对比工作台：每张卡片与右侧详情面板同一套版式
 *
 * 早先这里是一张「维度 × 许可证」的表格，14 行里大半是"没提到 / —"，
 * 真正要看的权利与义务反而要横向扫。现在改成每个许可证一张卡：
 * 名称、简介、GitHub 式条款框、选它按钮——与点开详情看到的东西一致。
 */
export function CompareBoard({
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
  // 对比表用到的事实快照——从 UnifiedEntry + 补充数据里一次解析出来
  const cards = entries.map((e) => {
    const extra = enrichment?.licenses[e.source === 'spdx' ? e.id : (e.scancodeKey ?? '')];
    const facts = factsOf(e, extra, terms, licenseTexts[e.id]);
    const key = e.source === 'spdx' ? e.id : (e.scancodeKey ?? e.id);
    // 条款框与详情面板走同一条路径：有上游标注照抄，没有就从推断的事实映射
    const derived = deriveFacts(
      key,
      licenseTexts[e.id] ?? '',
      e.osiApproved,
      familyFromEntry(e, extra),
      terms,
    );
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
                  ? zh
                    ? '已选用'
                    : 'Selected'
                  : zh
                    ? `用 ${facts.displayId}`
                    : `Use ${facts.displayId}`}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
