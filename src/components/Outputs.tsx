'use client';

import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { LANGUAGES, type CopyrightInput } from '../lib/fill.ts';
import { complianceChecklist, generate, readmeSection, type GeneratorOptions } from '../lib/generate.ts';
import { expressionOf, fromScancodeEntry, resolveSpec } from '../lib/spec.ts';
import {
  loadCatalog,
  loadEnrichment,
  loadScancodeCatalog,
  loadScancodeTexts,
  loadTerms,
  loadTexts,
  type ChooseALicenseTerms,
  type Enrichment,
  type ScancodeCatalog,
  type SpdxSnapshot,
  type SpdxTexts,
} from '../lib/spdx.ts';
import { ECOSYSTEM_MANIFESTS, t } from '../lib/ui.ts';
import type { GenState } from '../lib/genstate.ts';
import type { Lang } from '../lib/types.ts';

export type { GenState };
export { defaultGenState } from '../lib/genstate.ts';

/** 界面选中的可能是一个 SPDX 标识符，也可能是 `scancode:<key>` */
function isScancodeId(id: string | null): boolean {
  return Boolean(id?.startsWith('scancode:'));
}
function scancodeKeyOf(id: string): string {
  return id.slice('scancode:'.length);
}

interface Props {
  lang: Lang;
  licenseId: string | null;
  /** 可选的例外（`WITH` 表达式），例如 Classpath-exception-2.0 */
  exceptionId: string | null;
  state: GenState;
  onChange: (next: GenState) => void;
}

export default function Outputs({ lang, licenseId, exceptionId, state, onChange }: Props) {
  const tr = t(lang);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [snapshot, setSnapshot] = useState<SpdxSnapshot | null>(null);
  const [texts, setTexts] = useState<SpdxTexts | null>(null);
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const [terms, setTerms] = useState<ChooseALicenseTerms | null>(null);
  const [scancode, setScancode] = useState<ScancodeCatalog | null>(null);
  const [scancodeTexts, setScancodeTexts] = useState<Record<string, string> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const pickingScancode = isScancodeId(licenseId);

  // 目录（约 600KB）与补充数据先到，正文随后。SPDX 正文（5MB）与 ScanCode 正文（13MB）
  // 分别按需加载——只选了 ScanCode 条目就不必下载 SPDX 全文，反之亦然。
  useEffect(() => {
    let alive = true;
    loadCatalog()
      .then((data) => {
        if (alive) setSnapshot(data);
      })
      .catch((error: unknown) => {
        if (alive) setLoadError(error instanceof Error ? error.message : String(error));
      });
    loadEnrichment()
      .then((data) => {
        if (alive) setEnrichment(data);
      })
      .catch(() => undefined); // 补充数据缺失只影响附加信息，不阻断生成
    loadTerms()
      .then((data) => {
        if (alive) setTerms(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!pickingScancode) {
      let alive = true;
      loadTexts()
        .then((data) => {
          if (alive) setTexts(data);
        })
        .catch((error: unknown) => {
          if (alive) setLoadError(error instanceof Error ? error.message : String(error));
        });
      return () => {
        alive = false;
      };
    }
    let alive = true;
    Promise.all([loadScancodeCatalog(), loadScancodeTexts()])
      .then(([catalog, body]) => {
        if (!alive) return;
        setScancode(catalog);
        setScancodeTexts(body);
      })
      .catch((error: unknown) => {
        if (alive) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      alive = false;
    };
  }, [pickingScancode]);

  const spec = useMemo(() => {
    if (!licenseId) return null;
    if (isScancodeId(licenseId)) {
      const key = scancodeKeyOf(licenseId);
      const entry = scancode?.entries.find((e) => e.key === key);
      const body = scancodeTexts?.[key];
      if (!entry || !body) return null;
      return fromScancodeEntry(entry, body, enrichment?.licenses[key], terms);
    }
    return resolveSpec(licenseId, snapshot, texts, exceptionId ?? undefined, enrichment?.licenses, terms);
  }, [licenseId, snapshot, texts, exceptionId, enrichment, scancode, scancodeTexts, terms]);

  const options: GeneratorOptions = useMemo(() => {
    const manifests = ECOSYSTEM_MANIFESTS[state.ecosystem]?.manifests ?? [];
    return {
      lang,
      copyright: state.copyright,
      languageId: state.languageId,
      manifests,
      includeNotice: state.includeNotice || Boolean(spec?.requiresNotice),
      includeFileHeader: state.includeFileHeader,
      includeReadme: state.includeReadme,
      includeReuseLayout: state.includeReuseLayout,
      thirdParty: state.thirdParty,
      contactEmail: state.contactEmail,
      repoUrl: state.repoUrl,
    };
  }, [lang, state, spec]);

  // ScanCode 条目的正文来自另一份数据，统一成 generate() 期望的形状
  const specText = useMemo(() => {
    if (!spec) return undefined;
    if (spec.nonSpdx && spec.scancodeKey) {
      const body = scancodeTexts?.[spec.scancodeKey];
      if (!body) return undefined;
      return {
        name: spec.name,
        url: spec.sourceUrl,
        licenseText: body,
      };
    }
    return texts?.licenses[spec.id];
  }, [spec, texts, scancodeTexts]);

  const result = useMemo(() => {
    if (!spec || !specText) return null;
    try {
      return generate({
        spec,
        options,
        licenseText: specText,
        exceptionText: spec.exceptionId ? texts?.exceptions[spec.exceptionId] : undefined,
        languages: LANGUAGES,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [spec, specText, texts, options]);

  const source = specText ?? null;
  const active =
    result && !('error' in result) ? (result.files.find((f) => f.path === activePath) ?? result.files[0]) : null;

  const update = (patch: Partial<GenState>) => onChange({ ...state, ...patch });
  const updateCopyright = (patch: Partial<CopyrightInput>) =>
    onChange({ ...state, copyright: { ...state.copyright, ...patch } });

  const copy = async (path: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPath(path);
      window.setTimeout(() => setCopiedPath((p) => (p === path ? null : p)), 1600);
    } catch {
      setCopiedPath(null);
    }
  };

  const download = (path: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() ?? 'LICENSE';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadZip = async () => {
    if (!result || 'error' in result || !spec) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      for (const f of result.files) zip.file(f.path, f.content);
      zip.file(
        'LICENSEFORGE-README.md',
        [
          `# ${spec.name} (${expressionOf(spec)})`,
          spec.sourceUrl
            ? `${spec.nonSpdx ? (lang === 'zh' ? '\n来源：ScanCode LicenseDB ' : '\nSource: ScanCode LicenseDB ') : '\nSPDX: '}${spec.sourceUrl}`
            : '',
          '',
          readmeSection(spec, options),
          '',
          '## ' + (lang === 'zh' ? '每个文件为什么存在' : 'Why each file exists'),
          '',
          ...result.files.map(
            (f) => `- \`${f.path}\` — ${f.why[lang]}${f.mandatory ? (lang === 'zh' ? '（必须）' : ' (required)') : ''}`,
          ),
          '',
          '## ' + (lang === 'zh' ? '生成后仍需你做的事' : 'What you still have to do'),
          '',
          ...complianceChecklist(spec, options, lang).map((c) => `- [ ] ${c}`),
          '',
          '---',
          lang === 'zh'
            ? '由 LicenseForge 生成。许可证正文来自 SPDX License List，逐字未改。本文件不构成法律意见。'
            : 'Generated by LicenseForge. License texts come verbatim from the SPDX License List. This is not legal advice.',
        ].join('\n'),
      );
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${expressionOf(spec).replace(/[^\w.-]+/g, '_')}-license-bundle.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  };

  if (!licenseId) {
    return (
      <div className="rounded-xl border border-dashed border-ink-900/20 bg-white p-8 text-center">
        <p className="text-ink-600">
          {lang === 'zh'
            ? '还没有选择许可证。回到「问卷选许可」回答几个问题，或直接在「选择与对比」里挑一个。'
            : 'No license selected yet. Go back to the questionnaire, or pick one directly under "Pick and compare".'}
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="rounded-lg border border-mandatory/40 bg-mandatory/5 p-4 text-sm text-mandatory">
        {lang === 'zh'
          ? `许可证数据加载失败：${loadError}。请刷新页面重试。`
          : `Failed to load license data: ${loadError}. Please refresh and try again.`}
      </p>
    );
  }

  // 说明文案按数据源区分：SPDX 与 ScanCode 正文是两份不同的文件
  if (!spec) {
    return (
      <div className="rounded-xl border border-ink-900/10 bg-white p-8 text-center text-sm text-ink-600">
        {lang === 'zh'
          ? pickingScancode
            ? '正在加载 ScanCode LicenseDB 正文（首次约 13 MB，之后走浏览器缓存）…'
            : '正在加载 SPDX 许可证数据（首次约 5 MB，之后走浏览器缓存）…'
          : pickingScancode
            ? 'Loading ScanCode LicenseDB texts (about 13 MB the first time, cached afterwards)…'
            : 'Loading SPDX license data (about 5 MB the first time, cached afterwards)…'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------- 当前许可证摘要 ---------- */}
      <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-lg font-semibold">{spec.name}</h2>
          <code className="mono rounded bg-ink-900/[0.06] px-1.5 py-0.5 text-xs">{expressionOf(spec)}</code>
          {spec.deprecated ? (
            <span className="rounded-full border border-advisory/40 bg-advisory/5 px-2 py-0.5 text-xs text-advisory">
              {lang === 'zh' ? 'SPDX 已废弃' : 'deprecated'}
            </span>
          ) : null}
          {spec.osiApproved ? (
            <span className="rounded-full border border-ink-900/15 px-2 py-0.5 text-xs text-ink-600">OSI</span>
          ) : null}
          {spec.fsfLibre ? (
            <span className="rounded-full border border-ink-900/15 px-2 py-0.5 text-xs text-ink-600">FSF Libre</span>
          ) : null}
          <a
            className="ml-auto text-xs text-ink-600 underline decoration-dotted"
            href={spec.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {tr.source}: SPDX
            {source ? ` (${source.licenseText.length.toLocaleString()} ${tr.chars})` : ''}
          </a>
        </div>
        <p className="mt-2 text-xs text-ink-400">
          {spec.curated
            ? lang === 'zh'
              ? '这个许可证的条款说明是我们逐条核对过的；源文件声明用的是官方原文。'
              : 'The clause notes for this license were checked by hand; the source-header wording is the official text.'
            : lang === 'zh'
              ? '这是个少见的长尾许可证：条款说明是机器读正文猜的，没有人逐条核对过。'
              : 'A long-tail license: the clause notes are machine-inferred from the text and nobody has checked them by hand.'}
        </p>
      </section>

      {/* ---------- 版权信息 ---------- */}
      <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{tr.editInputs}</h2>
        <p className="mt-1.5 text-sm text-ink-600">
          {lang === 'zh'
            ? '其实只有两项是必须的：版权人（写你的名字或公司名）与项目名称。其余留空也能生成完整可用的文件。版权人会同时写入 LICENSE、NOTICE、源文件头与清单字段；多版权人各占一行，年份区间按原样保留。'
            : 'Only two things are really required: the copyright holder (your name or company) and the project name. Everything else can stay blank and you still get complete, usable files. The holder is written into LICENSE, NOTICE, source headers and manifest fields; multiple holders get one line each and year ranges are preserved verbatim.'}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{tr.projectName}</span>
            <input
              value={state.copyright.projectName}
              onChange={(e) => updateCopyright({ projectName: e.target.value })}
              placeholder={lang === 'zh' ? '例如 myapp' : 'e.g. myapp'}
              className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-900"
            />
            <span className="mt-1 block text-xs text-ink-400">{tr.projectNameHint}</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium">{tr.description}</span>
            <input
              value={state.copyright.projectDescription ?? ''}
              onChange={(e) => updateCopyright({ projectDescription: e.target.value })}
              placeholder={lang === 'zh' ? '例如 一个把 CSV 转成图表的小工具' : 'e.g. a tiny CLI that turns CSV into charts'}
              className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-900"
            />
            <span className="mt-1 block text-xs text-ink-400">{tr.descriptionHint}</span>
          </label>
        </div>

        <div className="mt-5 space-y-3">
          {state.copyright.holders.map((h, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_auto]">
              <label className="block">
                <span className="text-xs text-ink-600">{tr.holderName}</span>
                <input
                  value={h.name}
                  onChange={(e) => {
                    const holders = [...state.copyright.holders];
                    holders[i] = { ...h, name: e.target.value };
                    updateCopyright({ holders });
                  }}
                  placeholder={lang === 'zh' ? '张三 / 某某科技有限公司' : 'Jane Doe / Acme Inc.'}
                  className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-900"
                />
              </label>
              <label className="block">
                <span className="text-xs text-ink-600">{tr.holderFrom}</span>
                <input
                  value={h.from ?? ''}
                  onChange={(e) => {
                    const holders = [...state.copyright.holders];
                    holders[i] = { ...h, from: e.target.value };
                    updateCopyright({ holders });
                  }}
                  className="mono mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-900"
                />
              </label>
              <label className="block">
                <span className="text-xs text-ink-600">{tr.holderTo}</span>
                <input
                  value={h.to ?? ''}
                  onChange={(e) => {
                    const holders = [...state.copyright.holders];
                    holders[i] = { ...h, to: e.target.value };
                    updateCopyright({ holders });
                  }}
                  placeholder={lang === 'zh' ? '留空' : 'blank'}
                  className="mono mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-900"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={state.copyright.holders.length <= 1}
                  onClick={() =>
                    updateCopyright({ holders: state.copyright.holders.filter((_, idx) => idx !== i) })
                  }
                  className="rounded-lg border border-ink-900/15 px-3 py-2 text-xs disabled:opacity-40"
                >
                  {tr.removeHolder}
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              updateCopyright({
                holders: [
                  ...state.copyright.holders,
                  { name: '', from: state.copyright.holders[0]?.from ?? String(new Date().getFullYear()), to: '' },
                ],
              })
            }
            className="rounded-lg border border-ink-900/20 px-3 py-2 text-sm hover:border-ink-900"
          >
            + {tr.addHolder}
          </button>

          {!state.copyright.holders.some((h) => h.name.trim()) ? (
            <p className="rounded border border-mandatory/30 bg-mandatory/5 p-2 text-xs text-mandatory">{tr.noHolderYet}</p>
          ) : null}
        </div>

        {/* 进阶设置默认折叠：版权行写法、联系邮箱、仓库地址都不是必填项 */}
        <AdvancedSettings lang={lang} state={state} update={update} updateCopyright={updateCopyright} tr={tr} />
      </section>

      {/* ---------- 产物选项 ---------- */}
      <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{tr.outputOptions}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{tr.language}</span>
            <select
              value={state.languageId}
              onChange={(e) => update({ languageId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">{tr.ecosystem}</span>
            <select
              value={state.ecosystem}
              onChange={(e) => update({ ecosystem: e.target.value })}
              className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
            >
              {Object.entries(ECOSYSTEM_MANIFESTS).map(([id, v]) => (
                <option key={id} value={id}>
                  {v.label[lang]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <Toggle
            label={tr.optNotice}
            hint={
              spec.requiresNotice
                ? tr.mandatoryLock
                : lang === 'zh'
                  ? '把版权与第三方归属集中在一处。'
                  : 'Keeps copyright and third-party attribution in one place.'
            }
            checked={options.includeNotice}
            locked={spec.requiresNotice}
            onChange={(v) => update({ includeNotice: v })}
          />
          <Toggle
            label={tr.optFileHeader}
            checked={state.includeFileHeader}
            onChange={(v) => update({ includeFileHeader: v })}
          />
          <Toggle label={tr.optReadme} checked={state.includeReadme} onChange={(v) => update({ includeReadme: v })} />
          {/* REUSE 目录对单独一个许可证的项目收益不大，收进"更多设置"，需要的人自己开 */}
          <details className="rounded-lg border border-ink-900/10 p-3">
            <summary className="cursor-pointer text-sm">
              {lang === 'zh' ? '更多设置（进阶，可先不改）' : 'More settings (advanced, safe to skip)'}
            </summary>
            <div className="mt-3 space-y-2">
              <Toggle
                label={tr.optReuse}
                hint={
                  lang === 'zh'
                    ? '多个许可证并存的项目、以及会自动扫描依赖清单的工具都依赖这个目录结构；内容是逐字原文，方便机器校验。只用一个许可证的项目可以先不开。'
                    : 'Multi-license projects, and tooling that scans dependency manifests, rely on this layout; the copy is verbatim so it can be machine-checked. A single-license project can skip it.'
                }
                checked={state.includeReuseLayout}
                onChange={(v) => update({ includeReuseLayout: v })}
              />
            </div>
          </details>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium">{tr.thirdParty}</span>
          <textarea
            value={state.thirdParty}
            onChange={(e) => update({ thirdParty: e.target.value })}
            rows={3}
            placeholder={'lodash — John-David Dalton — MIT\nfoo — Acme Inc. — Apache-2.0'}
            className="mono mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-xs outline-none focus:border-ink-900"
          />
          <span className="mt-1 block text-xs text-ink-400">
            {tr.thirdPartyHint}
            {!state.thirdParty.trim() ? (
              <span className="mt-1 block text-ink-400">
                {lang === 'zh'
                  ? '留空也没关系：NOTICE 里会写明"尚未登记第三方组件，请在加入依赖后补全"。'
                  : 'Leaving it blank is fine: NOTICE will state that no third-party components are recorded yet.'}
              </span>
            ) : null}
          </span>
        </label>
      </section>

      {/* ---------- 结果 ---------- */}
      {result && 'error' in result ? (
        <p className="rounded-lg border border-mandatory/40 bg-mandatory/5 p-4 text-sm text-mandatory">{result.error}</p>
      ) : null}

      {result && !('error' in result) ? (
        <>
          {result.notices.length ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">{tr.notices}</h2>
              {result.notices.map((n, i) => (
                <p
                  key={i}
                  className={[
                    'rounded-lg border p-3 text-sm',
                    n.level === 'error'
                      ? 'border-mandatory/40 bg-mandatory/5 text-mandatory'
                      : n.level === 'warn'
                        ? 'border-advisory/40 bg-advisory/5'
                        : 'border-ink-900/10 bg-white',
                  ].join(' ')}
                >
                  {n[lang]}
                </p>
              ))}
            </section>
          ) : null}

          <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{tr.files}</h2>
              <button
                type="button"
                onClick={downloadZip}
                disabled={zipping}
                className="ml-auto rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {zipping ? (lang === 'zh' ? '打包中…' : 'Zipping…') : tr.downloadAll}
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[18rem_1fr]">
              <ul className="space-y-1.5">
                {result.files.map((f) => {
                  const isActive = active?.path === f.path;
                  return (
                    <li key={f.path}>
                      <button
                        type="button"
                        onClick={() => setActivePath(f.path)}
                        className={[
                          'w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                          isActive ? 'border-ink-900 bg-ink-900/[0.04]' : 'border-ink-900/10 hover:border-ink-900/30',
                        ].join(' ')}
                      >
                        <span className="mono block break-all">{f.path}</span>
                        <span
                          className={[
                            'mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
                            f.mandatory ? 'bg-mandatory/10 text-mandatory' : 'bg-ink-900/[0.06] text-ink-600',
                          ].join(' ')}
                        >
                          {f.mandatory ? tr.mandatory : tr.optional}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {active ? (
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="mono text-sm">{active.path}</code>
                    <button
                      type="button"
                      onClick={() => copy(active.path, active.content)}
                      className="rounded border border-ink-900/20 px-2.5 py-1 text-xs hover:border-ink-900"
                    >
                      {copiedPath === active.path ? tr.copied : tr.copy}
                    </button>
                    <button
                      type="button"
                      onClick={() => download(active.path, active.content)}
                      className="rounded border border-ink-900/20 px-2.5 py-1 text-xs hover:border-ink-900"
                    >
                      {lang === 'zh' ? '下载' : 'Download'}
                    </button>
                  </div>
                  <p className="mt-2 rounded border-l-2 border-ink-900/20 bg-ink-900/[0.02] py-2 pl-3 text-xs text-ink-600">
                    <strong>{tr.why}：</strong>
                    {active.why[lang]}
                  </p>
                  <div className="text-scroll mt-3 rounded-lg border border-ink-900/10 bg-ink-950 p-3">
                    <pre className="mono text-xs leading-relaxed text-white/90">{active.content}</pre>
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    {active.content.split('\n').length} {lang === 'zh' ? '行' : 'lines'} ·{' '}
                    {active.content.length.toLocaleString()} {tr.chars}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-ink-900/10 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">{tr.checklist}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {complianceChecklist(spec, options, lang).map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-0.5 text-ink-400">
                    ☐
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AdvancedSettings({
  lang,
  state,
  update,
  updateCopyright,
  tr,
}: {
  lang: Lang;
  state: GenState;
  update: (patch: Partial<GenState>) => void;
  updateCopyright: (patch: Partial<CopyrightInput>) => void;
  tr: ReturnType<typeof t>;
}) {
  const styleButtons = (
    <>
      <span className="text-sm font-medium">{tr.style}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {(
          [
            ['word', tr.styleWord],
            ['c-paren', tr.styleParen],
            ['copyright-symbol', tr.styleSymbol],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => updateCopyright({ symbolStyle: value })}
            className={[
              'mono rounded-lg border px-3 py-1.5 text-xs',
              state.copyright.symbolStyle === value
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-ink-900/15 hover:border-ink-900',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-400">{tr.styleHint}</p>
    </>
  );

  const contactFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="text-sm font-medium">{tr.contactEmail}</span>
        <input
          type="email"
          value={state.contactEmail}
          onChange={(e) => update({ contactEmail: e.target.value })}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-900"
        />
        <span className="mt-1 block text-xs text-ink-400">{tr.contactEmailHint}</span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">{tr.repoUrl}</span>
        <input
          value={state.repoUrl}
          onChange={(e) => update({ repoUrl: e.target.value })}
          placeholder="https://github.com/you/repo"
          className="mt-1 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-900"
        />
      </label>
    </div>
  );

  return (
    <details className="mt-5 rounded-lg border border-ink-900/10 p-3">
      <summary className="cursor-pointer text-sm">
        {lang === 'zh'
          ? '更多设置（版权行写法、联系邮箱、仓库地址）'
          : 'More settings (notice style, contact email, repository URL)'}
      </summary>
      <div className="mt-3 space-y-4">
        <div>{styleButtons}</div>
        {contactFields}
      </div>
    </details>
  );
}

function Toggle({
  label,
  hint,
  checked,
  locked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  locked?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={['flex items-start gap-3', locked ? 'opacity-70' : 'cursor-pointer'].join(' ')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-ink-900"
      />
      <span>
        <span className="block text-sm">{label}</span>
        {hint ? <span className="block text-xs text-ink-400">{hint}</span> : null}
      </span>
    </label>
  );
}
