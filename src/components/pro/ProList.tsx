'use client';

import { type KeyboardEvent, useRef } from 'react';
import { type Enrichment, isNonOpenCategory, type UnifiedEntry } from '../../lib/spdx.ts';
import type { Lang } from '../../lib/types.ts';

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
 * 左栏的许可证列表。
 *
 * 列表本身没有状态：选中项、当前预览项都由 ProPicker 持有，这里只负责
 * 渲染每一行并转交单击 / 双击。唯一留在内部的是键盘导航所需的 ref。
 */
export function LicenseList({
  lang,
  sortedResults,
  focusId,
  pickedId,
  enrichment,
  setFocus,
  onPick,
}: {
  lang: Lang;
  sortedResults: UnifiedEntry[];
  focusId: string | null;
  pickedId: string | null;
  enrichment: Enrichment | null;
  setFocus: (entry: UnifiedEntry) => void;
  onPick: (id: string, exceptionId?: string | null) => void;
}) {
  const zh = lang === 'zh';
  const listRef = useRef<HTMLUListElement>(null);

  /**
   * 列表内的方向键导航。
   *
   * 每一行本来就是 <button>，Tab 与 Enter 可用；但候选人动辄上千个，
   * 逐个 Tab 不现实。这里让上下键在同级按钮之间移动焦点，Home/End 跳首尾。
   */
  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('li > button') ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? buttons.length - 1
          : e.key === 'ArrowDown'
            ? Math.min(at + 1, buttons.length - 1)
            : Math.max(at - 1, 0);
    buttons[next]?.focus();
  };

  return (
    <ul
      ref={listRef}
      onKeyDown={onListKeyDown}
      aria-label={zh ? '许可证列表' : 'License list'}
      className="max-h-[40rem] space-y-1 overflow-auto rounded-2xl border border-ink-900/10 bg-white p-2"
    >
      {sortedResults.map((l) => {
        const active = focusId === l.id;
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
              aria-current={active ? 'true' : undefined}
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
                {chosen ? (
                  <span className="rounded-md bg-ok/10 px-2 text-[10px] text-ok">
                    {zh ? '已选' : 'selected'}
                  </span>
                ) : null}
                {nonOpen ? (
                  <span
                    className="rounded-md bg-mandatory/10 px-2 text-[10px] text-mandatory"
                    title={l.category ?? extra?.category}
                  >
                    {zh ? '非开源' : 'not OSS'}
                  </span>
                ) : null}
                {superseded ? (
                  <span className="rounded-md bg-advisory/10 px-2 text-[10px] text-advisory">
                    {zh ? '已取代' : 'superseded'}
                  </span>
                ) : null}
                {l.deprecated ? (
                  <span className="rounded-md bg-advisory/10 px-2 text-[10px] text-advisory">
                    {zh ? '废弃' : 'deprecated'}
                  </span>
                ) : null}
                {l.hasOfficialHeader ? (
                  <span className="rounded-md bg-ink-900/[0.06] px-2 text-[10px] text-ink-600">
                    {zh ? '官方头' : 'header'}
                  </span>
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
      {!sortedResults.length ? (
        <li className="p-3 text-sm text-ink-400">{zh ? '没有匹配的许可证。' : 'No matching license.'}</li>
      ) : null}
    </ul>
  );
}
