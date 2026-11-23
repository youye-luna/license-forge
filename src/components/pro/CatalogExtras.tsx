'use client';

import { useMemo, useState } from 'react';
import {
  type ChineseTextSource,
  type Enrichment,
  type EnrichmentRecord,
  isNonOpenCategory,
  OSI_KEYWORD_NOTE,
  type SpdxSnapshot,
  type UnifiedEntry,
} from '../../lib/spdx.ts';
import type { Lang } from '../../lib/types.ts';
import { CompatibilitySection } from './CompatibilitySection';

/** OSADL 的 Yes / No / Yes (restricted) 说成人话 */
function plainVerdict(v: string, zh: boolean): string {
  if (/^yes\s*\(restricted\)/i.test(v)) return zh ? '要（有条件）' : 'yes, with conditions';
  if (/^yes$/i.test(v)) return zh ? '要' : 'yes';
  if (/^no$/i.test(v)) return zh ? '不要' : 'no';
  return v;
}

function Row({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone?: 'bad' | 'warn';
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-600">{label}</dt>
      <dd
        className={[
          mono ? 'mono' : '',
          tone === 'bad' ? 'text-mandatory' : tone === 'warn' ? 'text-advisory' : '',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * 详情面板的「进阶信息」折叠区：数据出处、兼容性、中文文本、附加例外。
 *
 * 这些内容只有"查资料"时才需要，默认收起来，避免把第一次选许可证的人
 * 淹在术语里。附加例外的搜索词只在这个折叠区里用，所以状态也放在这里。
 */
export function CatalogExtras({
  lang,
  entry,
  spdx,
  extra,
  enrichment,
  chineseText,
  activeException,
  onPick,
}: {
  lang: Lang;
  entry: UnifiedEntry;
  spdx: SpdxSnapshot;
  extra?: EnrichmentRecord;
  enrichment: Enrichment | null;
  chineseText?: ChineseTextSource;
  activeException: string | null;
  onPick: (exceptionId: string | null) => void;
}) {
  const zh = lang === 'zh';
  const [exceptionQuery, setExceptionQuery] = useState('');

  const isSpdx = entry.source === 'spdx';
  const exceptions = useMemo(() => {
    const q = exceptionQuery.trim().toLowerCase();
    const list = spdx.exceptions.filter((e) => !e.deprecated);
    if (!q) return list.slice(0, 8);
    return list
      .filter((e) => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
      .slice(0, 40);
  }, [spdx.exceptions, exceptionQuery]);

  return (
    // 数据出处、兼容性、中文文本、附加例外都是"查资料"时才需要的东西：
    // 默认收起，避免把第一次选许可证的人淹在术语里
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
                  value={
                    isNonOpenCategory(extra.category)
                      ? zh
                        ? `${extra.category}（非开源）`
                        : `${extra.category} (not open source)`
                      : extra.category
                  }
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
              {extra.osiApprovedDate ? (
                <Row label={zh ? 'OSI 认证时间' : 'OSI approval'} value={extra.osiApprovedDate} mono />
              ) : null}
              {extra.scancodeMatchedVia ? (
                <Row label={zh ? '通过旧名字匹配到' : 'Matched via'} value={extra.scancodeMatchedVia} mono />
              ) : null}
            </dl>
            {extra.osiKeywords?.length ? (
              <ul className="mt-2 space-y-1 text-xs">
                {extra.osiKeywords.map((k) => {
                  const note = OSI_KEYWORD_NOTE[k];
                  return (
                    <li
                      key={k}
                      className={note && /superseded|non-reusable/.test(k) ? 'text-advisory' : 'text-ink-600'}
                    >
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {zh ? '中文文本' : 'Chinese text'}
            </h3>
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
              <a
                className="underline decoration-dotted"
                href={chineseText.url}
                target="_blank"
                rel="noreferrer noopener"
              >
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {zh ? '中文文本' : 'Chinese text'}
            </h3>
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
                  activeException === null
                    ? 'border-ink-900 bg-ink-900 text-white'
                    : 'border-ink-900/15 hover:border-ink-900/40',
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
                    activeException === e.id
                      ? 'border-ink-900 bg-ink-900 text-white'
                      : 'border-ink-900/15 hover:border-ink-900/40',
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
  );
}
