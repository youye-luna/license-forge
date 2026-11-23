'use client';

import { useEffect, useState } from 'react';
import { factsOf, generatedIntro } from '../../lib/compare.ts';
import { LICENSE_BY_ID } from '../../lib/licenses.ts';
import {
  type ChooseALicenseTerms,
  type Enrichment,
  type EnrichmentRecord,
  familyFromEntry,
  ID_PREFIX_GROUPS,
  isNonOpenCategory,
  type ScancodeCatalog,
  type SpdxSnapshot,
  type UnifiedEntry,
} from '../../lib/spdx.ts';
import { SUBJECT_LABEL, subjectsOf } from '../../lib/subject.ts';
import type { Lang } from '../../lib/types.ts';
import { CatalogExtras } from './CatalogExtras';
import { InferredTerms } from './InferredTerms';

/** 字数：上万就说"约几万字"，否则直接给数字 */
function plainLength(n: number, zh: boolean): string {
  if (!zh) return `${n.toLocaleString()} characters`;
  return n >= 10000 ? `约 ${(n / 10000).toFixed(1)} 万字` : `${n.toLocaleString()} 字`;
}

/* ------------------------------------------------------------------ *
 * 详情面板
 * ------------------------------------------------------------------ */

export function CatalogDetail({
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
      import('../../lib/spdx.ts').then(({ loadTexts }) =>
        loadTexts()
          .then((t) => alive && setText(t.licenses[entry.id]?.licenseText ?? null))
          .catch(() => undefined),
      );
    } else {
      setTextLoading(true);
      import('../../lib/spdx.ts')
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
          const verdict = subjectsOf(
            isSpdx ? entry.id : (entry.scancodeKey ?? entry.id),
            familyFromEntry(entry, extra),
          );
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
            {zh
              ? '这份许可不在官方名录里，别写进你的配置文件'
              : 'Not on the official list — do not put this in your config files'}
          </p>
          <p className="mt-2 text-xs text-ink-700">
            {zh ? '它的正式记录写法是 ' : 'Its formal record is written as '}
            <code className="mono">
              {scEntry?.spdxLicenseKey ?? `LicenseRef-scancode-${entry.scancodeKey}`}
            </code>
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

      <CatalogExtras
        lang={lang}
        entry={entry}
        spdx={spdx}
        extra={extra}
        enrichment={enrichment}
        chineseText={chineseText}
        activeException={activeException}
        onPick={onPick}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-900/10 pt-4">
        <button
          type="button"
          onClick={() => onPick(activeException)}
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white"
        >
          {picked
            ? zh
              ? '已选择，去生成'
              : 'Selected — go generate'
            : zh
              ? '用这个许可证'
              : 'Use this license'}
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
