'use client';

import { useState } from 'react';
import { COMPATIBILITY_VERDICT, type Enrichment } from '../../lib/spdx.ts';
import type { Lang } from '../../lib/types.ts';

/** 兼容性面板：直接呈现 OSADL 矩阵的逐条判定 */
export function CompatibilitySection({
  lang,
  id,
  enrichment,
}: {
  lang: Lang;
  id: string;
  enrichment: Enrichment;
}) {
  const zh = lang === 'zh';
  const [showAll, setShowAll] = useState(false);
  const row = enrichment.compatibility[id] ?? {};
  const entries = Object.entries(row).filter(([other]) => other !== id);
  if (!entries.length) return null;

  const order = { No: 0, 'Check dependency': 1, Unknown: 2, Yes: 3, Same: 4 } as Record<string, number>;
  const sorted = [...entries].sort(
    (a, b) => (order[a[1]] ?? 9) - (order[b[1]] ?? 9) || a[0].localeCompare(b[0]),
  );
  const shown = showAll ? sorted : sorted.slice(0, 24);
  const counts: Record<string, number> = {};
  for (const [, v] of entries) counts[v] = (counts[v] ?? 0) + 1;

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
          {showAll
            ? zh
              ? '只看前 24 条'
              : 'Show first 24'
            : zh
              ? `展开全部 ${sorted.length} 条`
              : `Show all ${sorted.length}`}
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
