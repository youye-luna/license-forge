'use client';

import { useEffect, useRef, useState } from 'react';
import Wizard from './Wizard';
import ProPicker from './ProPicker';
import Outputs, { defaultGenState } from './Outputs';
import type { GenState } from '../lib/genstate.ts';
import { LICENSE_BY_ID, LICENSES, FAMILY_LABEL } from '../lib/licenses.ts';
import { coverageStats } from '../lib/matrix.ts';
import { catalogStats, loadCatalog, loadEnrichment, type Enrichment, type SpdxSnapshot } from '../lib/spdx.ts';
import { PROJECT, TABS, UI, t, type TabId } from '../lib/ui.ts';
import type { Lang } from '../lib/types.ts';

export default function Generator() {
  const [lang, setLang] = useState<Lang>('zh');
  // 一进站就是问卷：不做模式切换，也不在问卷前面加门槛
  const [tab, setTab] = useState<TabId>('wizard');
  const [licenseId, setLicenseId] = useState<string | null>(null);
  const [exceptionId, setExceptionId] = useState<string | null>(null);
  const [gen, setGen] = useState<GenState>(() => defaultGenState());
  const [snapshot, setSnapshot] = useState<SpdxSnapshot | null>(null);
  const tr = t(lang);
  const entry = licenseId ? LICENSE_BY_ID[licenseId] : null;
  const curated = coverageStats();
  const full = snapshot ? catalogStats(snapshot) : null;
  const mainRef = useRef<HTMLElement>(null);

  // 目录（约 600KB）在首屏就取，用来显示真实收录量，也让各标签页共享同一份缓存
  useEffect(() => {
    let alive = true;
    loadCatalog()
      .then((s) => alive && setSnapshot(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 问卷走完（或用户选择跳过）后进入选择器。
   *
   * 问卷与跳过的差别只落在 REUSE 布局这一个默认值上：
   * 走完问卷说明是第一次发布项目，根目录多一个读不懂的文件夹没有收益；
   * 直接跳过说明是熟手，期望机器可读的许可证归档。
   */
  const finishQuestionnaire = (skipped: boolean) => {
    setGen((prev) => ({ ...prev, includeReuseLayout: skipped }));
    setTab('picker');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pick = (id: string, exception?: string | null) => {
    setLicenseId(id);
    setExceptionId(exception ?? null);
    setTab('generate');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 切换标签页时把焦点移回主区域，键盘与读屏用户不会停留在已经消失的按钮上
  useEffect(() => {
    mainRef.current?.focus();
  }, [tab]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="no-print">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {UI.brand[lang]}
              <span className="ml-2 align-middle text-sm font-normal text-ink-400">
                {lang === 'zh' ? 'LicenseForge' : '许可证锻造台'}
              </span>
            </h1>
            <p className="mt-2 max-w-2xl text-ink-600">{UI.tagline[lang]}</p>
          </div>
          <button
            type="button"
            onClick={() => setLang((l) => (l === 'zh' ? 'en' : 'zh'))}
            className="rounded-lg border border-ink-900/15 px-3 py-2 text-sm hover:border-ink-900"
            aria-label="Switch language"
          >
            {lang === 'zh' ? 'English' : '中文'}
          </button>
        </div>

        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
          <span>🔒 {UI.privacy[lang]}</span>
          <span>
            {tr.stats}
            {lang === 'zh' ? '：' : ': '}
            {full ? (
              <>
                {full.licenses} {lang === 'zh' ? '个许可证' : 'licenses'}（{lang === 'zh' ? 'SPDX' : 'SPDX'}{' '}
                {full.version}，{lang === 'zh' ? '其中' : 'of which '}
                {full.active} {lang === 'zh' ? '现行' : 'current'} · {full.osiApproved} OSI · {full.deprecated}{' '}
                {lang === 'zh' ? '废弃' : 'deprecated'}） · {full.exceptions} {lang === 'zh' ? '个例外' : 'exceptions'} ·{' '}
                {full.withOfficialHeader} {lang === 'zh' ? '个自带官方声明模板' : 'with official templates'}
              </>
            ) : (
              <>{lang === 'zh' ? '正在加载 SPDX 许可证目录…' : 'Loading the SPDX catalog…'}</>
            )}
          </span>
          <span>
            {lang === 'zh'
              ? `其中 ${curated.total} 个做了人工条款梳理与双语解读`
              : `${curated.total} with hand-curated terms and commentary`}
          </span>
        </p>
      </header>

      {/* 步骤导航：单线流程，序号让"现在在哪一步"一眼可见 */}
      <nav aria-label={lang === 'zh' ? '流程步骤' : 'Steps'} className="no-print mt-6 flex flex-wrap gap-2 border-b border-ink-900/10 pb-3">
        {TABS.map((tb, index) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            aria-current={tab === tb.id ? 'step' : undefined}
            className={[
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition',
              tab === tb.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-900/[0.05]',
            ].join(' ')}
          >
            <span
              aria-hidden
              className={[
                'mono flex size-5 items-center justify-center rounded-full text-[10px]',
                tab === tb.id ? 'bg-white/25' : 'bg-ink-900/[0.08]',
              ].join(' ')}
            >
              {index + 1}
            </span>
            {tb[lang]}
            {tb.id === 'generate' && entry ? (
              <span className="mono ml-1 rounded bg-white/20 px-1 text-[10px]">{entry.id}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <main ref={mainRef} tabIndex={-1} className="mt-6 outline-none">
        {tab === 'wizard' ? (
          <Wizard
            lang={lang}
            onPick={(id) => pick(id, null)}
            pickedId={licenseId}
            onFinish={finishQuestionnaire}
          />
        ) : null}
        {tab === 'picker' ? (
          <ProPicker lang={lang} pickedId={licenseId} exceptionId={exceptionId} onPick={pick} />
        ) : null}
        {tab === 'generate' ? (
          <Outputs lang={lang} licenseId={licenseId} exceptionId={exceptionId} state={gen} onChange={setGen} />
        ) : null}
        {tab === 'docs' ? <Docs lang={lang} /> : null}
      </main>

      {entry && tab !== 'generate' ? (
        <aside className="no-print mt-8 rounded-xl border border-ink-900/10 bg-white p-4 text-sm">
          <span className="text-ink-600">{lang === 'zh' ? '当前选择：' : 'Currently selected: '}</span>
          <strong>{entry.name}</strong>{' '}
          <code className="mono rounded bg-ink-900/[0.06] px-1.5 py-0.5 text-xs">{entry.id}</code>
          <button
            type="button"
            onClick={() => setTab('generate')}
            className="ml-3 rounded border border-ink-900/20 px-2.5 py-1 text-xs hover:border-ink-900"
          >
            {lang === 'zh' ? '去生成' : 'Generate'}
          </button>
        </aside>
      ) : null}

      <footer className="no-print mt-12 border-t border-ink-900/10 pt-6 text-xs leading-relaxed text-ink-400">
        <p>
          {lang === 'zh'
            ? '许可证正文逐字来自 SPDX License List（通过 spdx-license-list 数据包），生成过程不做任何改写；GPL 家族的示例段落由你填写的信息替换，其余字符保持原样。'
            : 'License texts come verbatim from the SPDX License List (via the spdx-license-list data package). Nothing is reworded; in the GPL family only the example section is filled with your details, and every other character is untouched.'}
        </p>
        <p className="mt-2">
          {lang === 'zh'
            ? '本站提供的是工程与信息层面的帮助，不是法律意见。涉及专利、商标、雇佣关系或跨境合规时请咨询专业人士。'
            : 'This site offers engineering and informational help, not legal advice. Consult a professional for patents, trademarks, employment questions or cross-border compliance.'}
        </p>
      </footer>
    </div>
  );
}

/** 「关于」——数据来源、硬规则与已知限制，都摊开写清楚 */
function Docs({ lang }: { lang: Lang }) {
  const zh = lang === 'zh';
  const [snapshot, setSnapshot] = useState<SpdxSnapshot | null>(null);
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const full = snapshot ? catalogStats(snapshot) : null;

  // 说明页也要引用真实收录量，避免文档与数据脱节
  useEffect(() => {
    let alive = true;
    loadCatalog()
      .then((s) => alive && setSnapshot(s))
      .catch(() => undefined);
    loadEnrichment()
      .then((e) => alive && setEnrichment(e))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold">{zh ? '流程是一条线，不是两个模式' : 'One linear flow, not two modes'}</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          {zh
            ? '选许可证这件事对谁都需要，所以这里不做"新手版 / 专业版"的分流——那只是多出来的一步。一进站就是问卷，答完进入「选择与对比」，挑定后生成整套文件。'
            : 'Everyone needs to pick a license, so this site does not split into "beginner" and "professional" paths — that would just be an extra step. You land on the questionnaire, move to "Pick and compare", then generate the file set.'}
        </p>
        <ol className="mt-4 space-y-3">
          {(zh
            ? [
                ['1', '问卷选许可', '8 个问题，每题都说明"为什么问这个"与背后的条款差异；结果是一组候选与各自的代价，不是"唯一正确答案"。'],
                ['2', '选择与对比', '收录 2400+ 个许可证，可按类别、来源或搜索定位；选中即摊开全部条款事实，并最多把 4 个放进对比工作台横向比较。'],
                ['3', '生成产物', '一次产出许可证全文、源文件头、NOTICE（可选）、README 段与包管理器字段，打包下载。'],
                ['4', '关于', '数据从哪来、遵守哪几条硬规则、有哪些已知限制，也包括我们查过但没拿到的数据。'],
              ]
            : [
                ['1', 'Questionnaire', 'Eight questions, each explaining why it is asked and which clause it maps to. The result is a candidate set with each one’s cost, not a single "correct" answer.'],
                ['2', 'Pick and compare', '2400+ licenses searchable by category, source or name. Selecting one lays out every term, and up to four can be lined up side by side.'],
                ['3', 'Generate', 'Produces the license text, source header, optional NOTICE, a README section and manifest fields — downloadable as a bundle.'],
                ['4', 'About', 'Where the data comes from, the rules this site holds to, its known limits, and the data we looked for but could not get.'],
              ]
          ).map(([n, title, body]) => (
            <li key={n} className="flex gap-3">
              <span aria-hidden className="mono mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-900/[0.08] text-[10px]">
                {n}
              </span>
              <span>
                <strong className="block text-sm">{title}</strong>
                <span className="mt-0.5 block text-sm text-ink-600">{body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg border border-ink-900/10 bg-ink-900/[0.02] p-3 text-xs text-ink-600">
          {zh
            ? '熟手可以直接在问卷页点「跳过问卷，直接选许可证」。跳过的唯一影响是 REUSE 布局默认开启——那是用一个默认值换掉一次点击，而不是换一套逻辑。'
            : 'If you already know what you want, use "Skip — pick a license directly" on the questionnaire page. The only effect is that the REUSE layout starts enabled: a changed default, not a different code path.'}
        </p>
      </section>

      <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold">{zh ? '本站的几条硬规则' : 'The rules this site will not break'}</h2>
        <ol className="mt-4 space-y-3 text-sm">
          {[
            {
              t: zh ? '正文绝不改写' : 'Never reword a license',
              d: zh
                ? `许可证正文逐字取自 SPDX License List。GPL 家族的正文（含示例段落）原样保留，只有示例段中的占位符用你填写的信息替换。`
                : 'Texts come verbatim from the SPDX License List. For the GPL family, the text including its example section is preserved as-is; only the placeholders in that example section are filled with your details.',
            },
            {
              t: zh ? '不自造法律声明' : 'Never invent legal notice text',
              d: zh
                ? `SPDX 官方数据里只有 ${full?.withOfficialHeader ?? 93} 个许可证自带文件头模板，我们逐字使用它们——而且这些模板**精确区分** \`-only\` 与 \`-or-later\`（"version 3." 对比 "either version 3 … or any later version"）。其余许可证没有官方模板，因此给出 SPDX / REUSE 推荐的两行式写法，而不是自己编一段"看起来像法律声明"的文字。`
                : `Only ${full?.withOfficialHeader ?? 93} licenses ship a file-header template in the official SPDX data, and we use them verbatim — including their precise distinction between \`-only\` and \`-or-later\` ("version 3." versus "either version 3 … or any later version"). The rest have no official template, so you get the SPDX / REUSE two-line form rather than invented legal-sounding text.`,
            },
            {
              t: zh ? '全量收录，且分层说明' : 'Full coverage, honestly layered',
              d: zh
                ? `通过 SPDX 官方 JSON API 收录了全部 ${full?.licenses ?? 740} 个许可证与 ${full?.exceptions ?? 86} 个例外，正文逐字保存、可核查。其中 ${LICENSES.length} 个做了人工条款梳理与中英双语解读；其余长尾条目的条款由**正文文本推断**，界面上明确标注"推断结果，非权威认定"，让每一项结论都能看出可信度来自哪里。`
                : `All ${full?.licenses ?? 740} licenses and ${full?.exceptions ?? 86} exceptions come from the official SPDX JSON API with verbatim, checkable texts. ${LICENSES.length} of them have hand-curated terms and bilingual commentary; for the long tail the terms are **inferred from the license text** and labelled as such, so every conclusion shows where its confidence comes from.`,
            },
            {
              t: zh ? '只用现行 SPDX 标识符' : 'Only current SPDX identifiers',
              d: zh
                ? '遇到已废弃写法会主动报错并给出替代；GPL 家族强制你在 only 与 or-later 之间显式选择，并解释这个选择几乎不可逆。'
                : 'Deprecated forms produce an explicit error with the replacement. The GPL family forces an explicit only/or-later choice and explains why it is practically irreversible.',
            },
            {
              t: zh ? '不把"沉默"当"安全"' : 'Never treat silence as safety',
              d: zh
                ? 'MIT / BSD / ISC 对专利只字未提，这一点在对比表里必须显示为"未提及"，而不是打勾或留空。'
                : 'MIT, BSD and ISC say nothing about patents; the comparison table must show "silent", not a tick or a blank.',
            },
            {
              t: zh ? '生成后仍需做什么，逐条列清' : 'Say what remains to be done',
              d: zh
                ? '生成文件只是合规的一半。每个许可证都会附一份自查清单：文件头要加到每个源文件、改动要标注、贡献者授权方式要先定。'
                : 'Generating files is only half of compliance. Each license comes with a checklist: headers in every file, change notices, and a decision about how contributions are licensed.',
            },
            {
              t: zh ? '本地运行，不上传' : 'Runs locally, uploads nothing',
              d: zh
                ? '站点是纯静态导出的，生成逻辑与许可证文本都在浏览器里，填写的版权信息不会被发送到任何服务器。数据在构建期由 SPDX 官方 API 取回并随站点分发，所以运行时既不依赖 SPDX 服务器，也不受其限流影响。'
                : 'The site is a static export. Generation logic and license texts live in the browser, and what you type is never sent anywhere. The data is fetched from the official SPDX API at build time and shipped with the site, so at runtime it depends on neither the SPDX servers nor their rate limits.',
            },
          ].map((item, i) => (
            <li key={item.t} className="flex gap-3">
              <span className="mono mt-0.5 text-ink-400">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <strong className="block">{item.t}</strong>
                <span className="mt-0.5 block text-ink-600">{item.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold">
          {zh
            ? `人工整理的 ${LICENSES.length} 个许可证（另有长尾条目由正文推断）`
            : `The ${LICENSES.length} hand-curated licenses (the long tail is inferred from text)`}
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          {zh
            ? `下面这些许可证的条款说明是我们逐条核对过的，也配了中文解读。官方名录一共 ${full?.licenses ?? '740'} 个，其余的在「选择与对比」里按类别浏览。`
            : `The licenses below have hand-checked clause notes and Chinese commentary. The official list has ${full?.licenses ?? '740'} in total; browse the rest by category under "Pick and compare".`}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(FAMILY_LABEL) as (keyof typeof FAMILY_LABEL)[]).map((f) => {
            const list = LICENSES.filter((l) => l.family === f);
            if (!list.length) return null;
            return (
              <div key={f}>
                <h3 className="text-sm font-semibold">{FAMILY_LABEL[f][lang]}</h3>
                <ul className="mt-2 space-y-1 text-xs text-ink-600">
                  {list.map((l) => (
                    <li key={l.id}>
                      <code className="mono">{l.id}</code>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold">{zh ? '数据从哪来（多家数据源混合）' : 'Where the data comes from (several sources combined)'}</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          {zh
            ? '许可证正文来自 SPDX 官方名录；许可类型的分类由 ScanCode 数据库补齐；"能不能和别的许可一起用"来自 OSADL 义务清单；条款的人工标注来自 ChooseALicense；OSI 认证标签来自 OSI 官方 API；中文审定稿链接来自开放原子《源译识》。这些都在**构建时**抓一次、作为静态文件随站点分发——运行时不联网，你填的信息也不出浏览器，任何人都可以重跑抓取脚本核对。'
            : 'License texts come from the official SPDX list; license-type categories from the ScanCode database; "can it be combined" verdicts from the OSADL obligations checklist; hand-labelled clauses from ChooseALicense; OSI approval tags from the official OSI API; and Chinese translation links from the OpenAtom Foundation project. All of it is fetched once at **build time** and shipped as static files — no network at runtime, nothing you type leaves the browser, and anyone can re-run the fetch scripts to verify.'}
        </p>
        <div className="table-scroll mt-4">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-ink-900/10 text-left">
                <th className="p-2 font-semibold">{zh ? '来源' : 'Source'}</th>
                <th className="p-2 font-semibold">{zh ? '提供什么' : 'Provides'}</th>
                <th className="p-2 font-semibold">{zh ? '覆盖 / 许可' : 'Coverage / license'}</th>
              </tr>
            </thead>
            <tbody className="[&_td]:p-2 [&_td]:align-top">
              <tr className="border-b border-ink-900/[0.06]">
                <td>
                  <a className="underline decoration-dotted" href="https://spdx.org/licenses/" target="_blank" rel="noreferrer noopener">
                    SPDX License List
                  </a>
                </td>
                <td>{zh ? '全部正文、93 个官方声明模板、OSI/FSF 状态' : 'All texts, 93 official header templates, OSI/FSF status'}</td>
                <td className="mono">
                  {full?.licenses ?? 740} + {full?.exceptions ?? 86} · CC0
                </td>
              </tr>
              <tr className="border-b border-ink-900/[0.06]">
                <td>
                  <a className="underline decoration-dotted" href="https://scancode-licensedb.aboutcode.org/" target="_blank" rel="noreferrer noopener">
                    ScanCode LicenseDB
                  </a>
                </td>
                <td>{zh ? '权威分类、归属方、主页' : 'Authoritative category, owner, homepage'}</td>
                <td className="mono">
                  {enrichment ? `${enrichment.coverage.scancodeMatched}/${enrichment.coverage.spdxLicenses}` : '726/740'} · CC-BY-4.0
                </td>
              </tr>
              <tr className="border-b border-ink-900/[0.06]">
                <td>
                  <a className="underline decoration-dotted" href="https://www.osadl.org/Checklists" target="_blank" rel="noreferrer noopener">
                    OSADL Obligations Checklist
                  </a>
                </td>
                <td>{zh ? '"能不能和别的许可一起用"、要不要开源、要不要给源码' : 'Combination verdicts, copyleft rating, source-disclosure duty'}</td>
                <td className="mono">
                  {enrichment ? `${enrichment.coverage.compatibilityEdges.toLocaleString()} ${zh ? '条判定' : 'verdicts'}` : '13,225'} · CC-BY-4.0
                </td>
              </tr>
              <tr className="border-b border-ink-900/[0.06]">
                <td>
                  <a className="underline decoration-dotted" href="https://github.com/github/choosealicense.com" target="_blank" rel="noreferrer noopener">
                    ChooseALicense
                  </a>
                </td>
                <td>
                  {zh
                    ? '人工逐条标注的条款结论（专利、商标、要不要写明改动）'
                    : 'Hand-labelled clause verdicts (patents, trademarks, change notices)'}
                </td>
                <td className="mono">
                  47 {zh ? '个主流许可' : 'popular licenses'} · CC-BY-3.0
                </td>
              </tr>
              <tr className="border-b border-ink-900/[0.06]">
                <td>
                  <a className="underline decoration-dotted" href="https://opensource.org/api/licenses" target="_blank" rel="noreferrer noopener">
                    OSI API
                  </a>
                </td>
                <td>{zh ? 'keywords（superseded / non-reusable 等）、批准日期' : 'keywords (superseded / non-reusable …), approval dates'}</td>
                <td className="mono">
                  {enrichment ? `${enrichment.coverage.osiMatched}/740` : '123/740'} · {zh ? '覆盖率有限，OSI 状态以 SPDX 为准' : 'partial; OSI status comes from SPDX'}
                </td>
              </tr>
              <tr>
                <td>
                  <a className="underline decoration-dotted" href="https://gitcode.com/translation/license-translation" target="_blank" rel="noreferrer noopener">
                    {zh ? '开放原子《源译识》' : 'OpenAtom translations'}
                  </a>
                </td>
                <td>{zh ? '10 个许可证的中英对照审定稿链接' : 'Links to 10 reviewed Chinese-English final texts'}</td>
                <td className="mono">{enrichment ? enrichment.coverage.chineseTranslations : 15} · {zh ? '译文 CC0' : 'translations CC0'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-400">
          {zh
            ? `当前快照：SPDX ${full?.version ?? '3.29.0'}。补充数据与 SPDX 快照分开存放，任一方更新都能独立重跑；补充数据缺失时生成功能仍然完全可用。转发这些数据时请保留 ScanCode 与 OSADL 的 CC-BY-4.0 署名。`
            : `Current snapshot: SPDX ${full?.version ?? '3.29.0'}. The enrichment data is stored separately from the SPDX snapshot so either can be refreshed independently, and generation keeps working if it is missing. If you redistribute this data, keep the CC-BY-4.0 attribution for ScanCode and OSADL.`}
        </p>
      </section>

      <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold">{zh ? '查过但拿不到的数据' : 'Data we looked for but could not get'}</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-600">
          {[
            zh
              ? '兼容性判定需要一份可以离线核对的判定集。欧盟 JLA 兼容性检查器没有提供可下载的数据接口，因此本站的兼容性结论采用 OSADL 义务清单矩阵。'
              : 'Compatibility verdicts need a dataset that can be checked offline. The EU JLA compatibility checker offers no downloadable data interface, so this site takes its compatibility verdicts from the OSADL obligations matrix.',
            zh
              ? 'gnu.org 的 license-compatibility.html 在构建环境里始终无法抓取，内容未经核实，因此没有把它当作来源。'
              : 'gnu.org’s license-compatibility.html could not be fetched from the build environment at all, so its content is unverified and it is not used as a source.',
            zh
              ? 'ScanCode 的 standard_notice 字段我们查过的每一条都是空的，所以源文件声明模板仍以 SPDX 的 standardLicenseHeader 为准。'
              : 'ScanCode’s standard_notice field is empty in every record we checked, so source-header templates still come from SPDX’s standardLicenseHeader.',
            zh
              ? '部分商业合规服务的兼容性结论没有可下载的公开数据集，无法离线核对，因此未纳入判定来源。'
              : 'Some commercial compliance services publish no downloadable dataset for their compatibility verdicts, so they cannot be checked offline and are not used as a source.',
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="text-ink-400">
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-ink-900/10 bg-white p-5 text-sm shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold">{zh ? '参考资料' : 'References'}</h2>
        <p className="mt-2 text-xs text-ink-400">
          {zh
            ? '下面这些资料在编写过程中查阅过，列出来便于核查。'
            : 'These were consulted while building this site, listed so the reasoning can be checked.'}
        </p>
        <ul className="mt-3 space-y-2 text-ink-600">
          {[
            ['choosealicense.com', 'https://choosealicense.com/'],
            ['Forgejo issue #11151 — licence selection discussion', 'https://codeberg.org/forgejo/forgejo/issues/11151'],
            ['Codeberg Community #1214 — licence picker discussion', 'https://codeberg.org/Codeberg/Community/issues/1214'],
            ['Codeberg Documentation — Licensing', 'https://docs.codeberg.org/getting-started/licensing/'],
            ['SPDX License List 3.29.0', 'https://spdx.org/licenses/'],
            ['SPDX Online Tools — License Check', 'https://tools.spdx.org/app/check_license/'],
            ['Interoperable Europe — Licensing Assistant', 'https://interoperable-europe.ec.europa.eu/collection/eupl/solution/licensing-assistant/welcome'],
            ['Creative Commons Chooser', 'https://creativecommons.org/chooser/'],
            ['GitHub Docs — Licensing a repository', 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository'],
            ['REUSE Specification 3.3', 'https://reuse.software/spec/'],
            ['Gitee Open API — /v5/licenses', 'https://gitee.com/api/v5/licenses'],
          ].map(([label, href]) => (
            <li key={href}>
              <a className="underline decoration-dotted hover:text-ink-900" href={href} target="_blank" rel="noreferrer noopener">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* 开源信息：仓库、许可证、作者。放在最后，作为整页的落款 */}
      <section className="rounded-xl border border-ink-900/15 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold">{zh ? '开源信息' : 'Open source'}</h2>
        <dl className="mt-4 divide-y divide-ink-900/[0.07] text-sm">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
            <dt className="w-28 shrink-0 text-ink-400">{zh ? '仓库' : 'Repository'}</dt>
            <dd>
              <a
                className="mono underline decoration-dotted hover:text-ink-900"
                href={PROJECT.repo}
                target="_blank"
                rel="noreferrer noopener"
              >
                {PROJECT.repoLabel}
              </a>
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
            <dt className="w-28 shrink-0 text-ink-400">{zh ? '许可证' : 'License'}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-ink-900/20 px-1.5 py-0.5 font-medium">{PROJECT.license}</span>
              <a
                className="underline decoration-dotted hover:text-ink-900"
                href={PROJECT.licenseUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {zh ? '查看 LICENSE 全文' : 'Read the full LICENSE'}
              </a>
              <span className="text-ink-400">
                {zh ? '— 本站的 LICENSE 就是用这个工具自己生成的' : '— the LICENSE for this very site was generated by this tool'}
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
            <dt className="w-28 shrink-0 text-ink-400">{zh ? '作者' : 'Author'}</dt>
            <dd>
              <a
                className="underline decoration-dotted hover:text-ink-900"
                href={PROJECT.authorUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {PROJECT.author}
              </a>
              <span className="ml-2 text-ink-600">{PROJECT.authorNick}</span>
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
            <dt className="w-28 shrink-0 text-ink-400">{zh ? '发行版' : 'Releases'}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <a
                className="underline decoration-dotted hover:text-ink-900"
                href={PROJECT.releases}
                target="_blank"
                rel="noreferrer noopener"
              >
                {PROJECT.releasesLabel}
              </a>
              <span className="text-ink-400">
                {zh ? '— 含可直接部署的静态站点压缩包' : '— includes a ready-to-deploy static site archive'}
              </span>
            </dd>
          </div>
        </dl>
        <p className="mono mt-4 rounded-lg border border-ink-900/10 bg-ink-900/[0.02] p-3 text-xs text-ink-600">
          {PROJECT.ownCopyright}
          <br />
          SPDX-License-Identifier: {PROJECT.license}
        </p>
        <p className="mt-3 text-xs text-ink-400">
          {zh
            ? '欢迎提交 issue 与 PR。数据快照、抓取脚本与全部生成逻辑都在仓库里，可以自行核对每一项结论。'
            : 'Issues and pull requests are welcome. The data snapshot, the fetch scripts and all generation logic are in the repository, so every conclusion can be checked independently.'}
        </p>
      </section>
    </div>
  );
}
