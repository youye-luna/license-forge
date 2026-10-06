import {
  BOILERPLATE_LANGUAGE_NOTE,
  currentYear,
  fileHeader,
  fillLicenseText,
  formatCopyrightLines,
  formatYears,
  hasCopyrightPlaceholder,
  renderComment,
  type CommentStyle,
  type CopyrightInput,
} from './fill.ts';
import { expressionOf, type HeaderStrategy, type LicenseSpec } from './spec.ts';
import { OSI_KEYWORD_NOTE, type LicenseText } from './spdx.ts';
import type { Lang } from './types.ts';

export interface GeneratorOptions {
  lang: Lang;
  copyright: CopyrightInput;
  /** 主导语言（决定 per-file 头的注释语法） */
  languageId: string;
  /** 生态清单文件，用来生成对应的 license 字段 */
  manifests: string[];
  /** 是否生成 NOTICE 文件（实测有硬性 NOTICE 义务的许可证会被强制打开） */
  includeNotice: boolean;
  /** 是否生成 per-file 头模板 */
  includeFileHeader: boolean;
  /** 是否生成 README 许可段 */
  includeReadme: boolean;
  /** 是否输出 REUSE 布局的 LICENSES/ 目录 */
  includeReuseLayout: boolean;
  /** 第三方组件（用于 NOTICE 的归属清单） */
  thirdParty: string;
  /** 作者联系邮箱 */
  contactEmail: string;
  /** 仓库地址 */
  repoUrl: string;
}

export interface GeneratedFile {
  /** 仓库内的相对路径 */
  path: string;
  content: string;
  /** 这个文件为什么存在（用于在界面上逐条解释，而不是甩给用户一堆文件） */
  why: { zh: string; en: string };
  /** 该文件是不可省略的硬性义务，还是推荐做法 */
  mandatory: boolean;
}

export interface GenerationResult {
  files: GeneratedFile[];
  /** 需要向用户交代的注意事项／我们做了什么替换 */
  notices: { level: 'info' | 'warn' | 'error'; zh: string; en: string }[];
  /** 文件中残留的未替换占位符（正常应为空） */
  leftoverPlaceholders: string[];
  /** 本次用到的文件头策略，便于界面如实说明依据 */
  headerStrategy: HeaderStrategy;
}

const COMMENT_BY_LANGUAGE: Record<string, CommentStyle> = {
  c: 'slash',
  python: 'hash',
  sql: 'dash',
  lisp: 'semicolon',
  tex: 'percent',
  html: 'html',
  xml: 'xml',
  batch: 'rem',
  plain: 'quote',
};

/* ------------------------------------------------------------------ *
 * README 段落
 * ------------------------------------------------------------------ */

export function readmeSection(spec: LicenseSpec, options: GeneratorOptions, manifestNote?: string): string {
  const zh = options.lang === 'zh';
  const lines: string[] = [];
  const copyright = formatCopyrightLines(options.copyright);
  const expression = expressionOf(spec);
  const title = spec.exceptionId ? spec.exceptionName ?? spec.name : spec.name;

  lines.push(zh ? '## 许可证' : '## License');
  lines.push('');
  for (const c of copyright) lines.push(c);
  lines.push('');
  lines.push(
    zh
      ? `本项目基于 **${title}**（SPDX 标识符：\`${expression}\`）发布。完整条款见 [\`${spec.fileName}\`](./${spec.fileName})。`
      : `This project is licensed under the **${title}** (SPDX identifier: \`${expression}\`). See [\`${spec.fileName}\`](./${spec.fileName}) for the full terms.`,
  );
  lines.push('');
  if (spec.exceptionId) {
    lines.push(
      zh
        ? `例外条款 \`${spec.exceptionId}\` 的正文同样随附在仓库中。`
        : `The text of the \`${spec.exceptionId}\` exception is bundled alongside.`,
    );
    lines.push('');
  }
  if (spec.requiresNotice) {
    lines.push(
      zh
        ? '再分发时必须保留 [`NOTICE`](./NOTICE) 文件中的归属声明。'
        : 'The attribution notices in [`NOTICE`](./NOTICE) must be retained in redistributions.',
    );
    lines.push('');
  }
  if (options.includeFileHeader) {
    lines.push(
      zh
        ? `> 源文件建议带有声明头，模板见 [\`${expression}.header.txt\`](./${expression}.header.txt)。`
        : `> Source files are expected to carry a notice header, see [\`${expression}.header.txt\`](./${expression}.header.txt).`,
    );
    lines.push('');
    lines.push(zh ? `> ${BOILERPLATE_LANGUAGE_NOTE.zh}` : `> ${BOILERPLATE_LANGUAGE_NOTE.en}`);
    lines.push('');
  }
  if (manifestNote) {
    lines.push(manifestNote);
    lines.push('');
  }
  if (options.contactEmail.trim()) {
    lines.push(
      zh ? `许可相关问题请联系：${options.contactEmail.trim()}` : `Licensing questions: ${options.contactEmail.trim()}`,
    );
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

/* ------------------------------------------------------------------ *
 * NOTICE
 * ------------------------------------------------------------------ */

function noticeContent(spec: LicenseSpec, options: GeneratorOptions): string {
  const zh = options.lang === 'zh';
  const holders = options.copyright.holders.filter((h) => h.name.trim());
  const lines: string[] = [];

  if (holders.length) {
    for (const h of holders) {
      lines.push(options.copyright.projectName.trim() || h.name.trim());
      lines.push(`Copyright ${formatYears(h)} ${h.name.trim()}`);
      lines.push('');
    }
  } else {
    lines.push(options.copyright.projectName.trim() || 'This product');
    lines.push(`Copyright ${currentYear()} the copyright holders`);
    lines.push('');
  }

  lines.push(zh ? '本产品包含由下列项目开发的软件：' : 'This product includes software developed by the following projects:');
  lines.push('');
  const third = options.thirdParty
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (third.length) {
    for (const t of third) lines.push(t.startsWith('-') ? t : `- ${t}`);
  } else {
    lines.push(
      zh
        ? '- （尚未登记第三方组件；请在使用依赖后补全）'
        : '- (no third-party components recorded yet — update after adding dependencies)',
    );
  }
  lines.push('');
  lines.push(
    zh
      ? `许可证全文见 ./${spec.fileName}。`
      : `The full license text is available in ./${spec.fileName}.`,
  );
  lines.push('');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * 清单字段
 * ------------------------------------------------------------------ */

function manifestSnippets(spec: LicenseSpec, options: GeneratorOptions): GeneratedFile[] {
  const out: GeneratedFile[] = [];
  const has = (name: string) => options.manifests.includes(name);
  const expr = expressionOf(spec);

  if (has('package.json')) {
    out.push({
      path: 'manifest/package.json.snippet',
      content: JSON.stringify({ license: expr }, null, 2) + '\n',
      why: {
        zh: 'npm / package.json 的 license 字段可以写 SPDX 表达式，包括 `WITH` 例外。写成 "GPL-3.0" 这类旧写法会让 npm 与 SBOM 工具无法识别。',
        en: 'The npm license field accepts an SPDX expression including a `WITH` exception. Legacy forms like "GPL-3.0" break npm and SBOM tooling.',
      },
      mandatory: false,
    });
  }
  if (has('Cargo.toml')) {
    out.push({
      path: 'manifest/Cargo.toml.snippet',
      content: `[package]\nlicense = "${expr}"\n`,
      why: {
        zh: 'Cargo 要求 SPDX 表达式；若仓库根目录放了 LICENSE 文件，可另外用 license-file 字段指定。',
        en: 'Cargo expects an SPDX expression; if you keep a LICENSE file at the root you may additionally set license-file.',
      },
      mandatory: false,
    });
  }
  if (has('pyproject.toml')) {
    out.push({
      path: 'manifest/pyproject.toml.snippet',
      content: `[project]\nlicense = "${expr}"\n# 旧写法（PEP 621 早期版本，仍被部分工具读取）：\n# license = { text = "${expr}" }\n`,
      why: {
        zh: 'PEP 639 起推荐直接写 SPDX 表达式字符串；旧版的 { text = ... } 写法仍在过渡期，两种都给出以免踩坑。',
        en: 'PEP 639 favours a plain SPDX expression string; the older { text = ... } form is still in transition, so both are provided.',
      },
      mandatory: false,
    });
  }
  if (has('pom.xml')) {
    out.push({
      path: 'manifest/pom.xml.snippet',
      content: `<licenses>\n  <license>\n    <name>${spec.name}</name>\n    <url>https://spdx.org/licenses/${encodeURIComponent(spec.id)}.html</url>\n    <distribution>repo</distribution>\n  </license>\n</licenses>\n`,
      why: {
        zh: 'Maven 不解析 SPDX 表达式，需要用名称 + URL；给出 SPDX 页面链接比写许可证全名更可靠。',
        en: 'Maven does not parse SPDX expressions, so it needs a name and URL. Linking the SPDX page is more reliable than typing the full name.',
      },
      mandatory: false,
    });
  }
  if (has('setup.cfg')) {
    out.push({
      path: 'manifest/setup.cfg.snippet',
      content: `[metadata]\nlicense = ${expr}\n`,
      why: { zh: 'setuptools 旧配置文件的 license 字段。', en: 'The license field in legacy setuptools configuration.' },
      mandatory: false,
    });
  }
  if (has('Gemfile')) {
    out.push({
      path: 'manifest/gemspec.snippet',
      content: `spec.license = "${expr}"\n`,
      why: { zh: 'RubyGems 的 gemspec 使用 SPDX 表达式。', en: 'RubyGems gemspecs use SPDX expressions.' },
      mandatory: false,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 主生成流程
 * ------------------------------------------------------------------ */

export interface GenerateInput {
  spec: LicenseSpec;
  options: GeneratorOptions;
  licenseText: LicenseText | undefined;
  /** 例外正文（当 spec 指定了 exceptionId 时提供） */
  exceptionText?: { name: string; licenseText: string; url: string };
  languages: { id: string }[];
}

export function generate(input: GenerateInput): GenerationResult {
  const { spec, options, licenseText, exceptionText } = input;
  const textData = licenseText?.licenseText;
  if (!textData) throw new Error(`缺少 ${spec.id} 的许可证正文数据，请先重新运行 npm run data。`);

  const files: GeneratedFile[] = [];
  const notices: GenerationResult['notices'] = [];
  const expression = expressionOf(spec);
  const style = COMMENT_BY_LANGUAGE[options.languageId] ?? 'slash';

  const copyrightInput: CopyrightInput = {
    ...options.copyright,
    contactEmail: options.contactEmail,
    repoUrl: options.repoUrl,
  };

  /* ---- 1. 主许可证文件 ---- */
  // 原则：非必要不改。只在许可证作者自己留出可填位置时才动正文，否则逐字输出。
  // 判断依据是 `fill` 字段（由构建期审计上游正文得出），而不是我们觉得"应该"填什么。
  if (spec.fill === 'copyright-line') {
    const filled = fillLicenseText(spec.id, textData, copyrightInput);
    const holders = options.copyright.holders.filter((h) => h.name.trim());
    if (!holders.length) {
      notices.push({
        level: 'error',
        zh: '这个许可证的正文里必须写版权人。现在没有填写，生成的 LICENSE 会缺少版权行——请先填写版权人。',
        en: 'This license requires a copyright line inside the text. Without a holder, the generated LICENSE will be missing it — please fill in the copyright holder first.',
      });
    }
    if (filled.leftoverPlaceholders.length) {
      notices.push({
        level: 'error',
        zh: `检测到 ${filled.leftoverPlaceholders.length} 处未替换的占位符（${[
          ...new Set(filled.leftoverPlaceholders),
        ].join(', ')}）。我们不会把它当成成功输出——请检查版权人是否填写完整。`,
        en: `${filled.leftoverPlaceholders.length} unreplaced placeholder(s) detected (${[
          ...new Set(filled.leftoverPlaceholders),
        ].join(', ')}). We refuse to treat that as a success — check that your copyright holder is filled in.`,
      });
    }
    files.push({
      path: spec.fileName,
      content: filled.text,
      why: {
        zh: `该许可证的正文自带版权行，作者就是留给你填的（占位符形态：${filled.appliedFixes.map((f) => f.replace(/^copyright-line:/, '')).join('、') || '版权行'}）。只替换了这一处，正文其余部分逐字未动——这也是真实项目使用该许可证的做法。`,
        en: `This license ships its own copyright line, and it is there precisely for you to fill in (placeholder form: ${filled.appliedFixes.map((f) => f.replace(/^copyright-line:/, '')).join(', ') || 'copyright line'}). Only that spot was substituted; everything else is verbatim — which is also how real projects use this license.`,
      },
      mandatory: true,
    });
  } else {
    // 正文不含可填位置：一个字都不加，与真实项目的做法一致
    files.push({
      path: spec.fileName,
      content: textData.trimEnd() + '\n',
      why: {
        zh: '许可证全文，逐字来自官方文本，**未作任何改动**。该许可证的正文里没有留给使用者的版权位置，真实项目也不会往正文里加一行——所以你的版权信息走 NOTICE、源文件头与清单字段。',
        en: 'The full license text, verbatim from the official source, **with nothing changed**. This license reserves no copyright slot inside its text, and real projects do not insert one — so your copyright details go in NOTICE, source headers and manifest fields.',
      },
      mandatory: true,
    });
  }

  /* ---- 2. 例外正文（WITH 表达式） ---- */
  if (spec.exceptionId && exceptionText) {
    files.push({
      path: `LICENSE.${spec.exceptionId}`,
      content: exceptionText.licenseText.trimEnd() + '\n',
      why: {
        zh: `你选择了 \`WITH ${spec.exceptionId}\`。例外条款是独立文本，必须与许可证全文一起随附，否则下游无法判断实际授予的权利范围。`,
        en: `You chose \`WITH ${spec.exceptionId}\`. An exception is a separate document and must travel with the license text, otherwise downstream users cannot tell what was actually granted.`,
      },
      mandatory: true,
    });
  } else if (spec.exceptionId && !exceptionText) {
    notices.push({
      level: 'warn',
      zh: `选择了例外 \`${spec.exceptionId}\`，但没有取到它的正文。请到 SPDX 页面手动下载并随仓库分发。`,
      en: `The exception \`${spec.exceptionId}\` was selected but its text could not be loaded. Download it from the SPDX page and ship it with the repository.`,
    });
  }

  /* ---- 3. NOTICE ---- */
  if (spec.requiresNotice || options.includeNotice) {
    files.push({
      path: 'NOTICE',
      content: noticeContent(spec, options),
      why: spec.requiresNotice
        ? {
            zh: '这是硬性义务：该许可证要求再分发时随附归属声明。绝大多数生成器都不会生成这个文件，这是实际项目中最常见的合规缺口。',
            en: 'Mandatory: this license requires attribution notices to travel with redistributions. Almost no generator produces this file, which is the most common real-world compliance gap.',
          }
        : {
            zh: '可选但推荐：把版权与第三方组件归属集中在一处，便于下游遵守声明保留义务。',
            en: 'Optional but recommended: keeps copyright and third-party attribution in one place so downstream users can comply.',
          },
      mandatory: spec.requiresNotice,
    });
  }
  if (spec.requiresNotice && !options.includeNotice) {
    notices.push({
      level: 'info',
      zh: '由于所选许可证的强制要求，NOTICE 已自动加入生成结果（无法关闭）。',
      en: 'NOTICE was added automatically because the selected license requires it; it cannot be turned off.',
    });
  }

  /* ---- 4. 源文件头 ---- */
  let leftoverPlaceholders: string[] = [];
  if (options.includeFileHeader) {
    const header = fileHeader(spec.id, copyrightInput, style, {
      officialHeader: spec.officialHeader,
      strategy: spec.headerStrategy,
      expression,
    });
    leftoverPlaceholders = header.leftovers;
    const strategyNote =
      spec.headerStrategy === 'spdx-official'
        ? {
            zh: `声明措辞取自 **SPDX 官方数据里该许可证自带的文件头模板**，逐字未改，占位符已按你填写的信息替换。官方模板还会精确区分 \`-only\` 与 \`-or-later\`，这正是竞品普遍混淆的地方。${spec.fill === 'apply-section' ? `另外说明一下：${spec.fileName} 正文末尾那一节「How to Apply These Terms」是 FSF 写的**示例**，不是生效条款，因此我们保持原样未动——你需要的声明就是本文件里的这一份。` : ''}`,
            en: `The wording comes verbatim from the license’s own file-header template in the official SPDX data, with the placeholders filled from your input. That template also distinguishes \`-only\` from \`-or-later\` precisely — exactly where most tools blur the two.${spec.fill === 'apply-section' ? ` One note: the "How to Apply These Terms" section at the end of ${spec.fileName} is an **example** written by the FSF, not operative terms, so it is left untouched — the notice you need is the one in this file.` : ''}`,
          }
        : spec.headerStrategy === 'gnu-boilerplate'
          ? {
              zh: '声明措辞取自该许可证正文自带的「如何应用」示例段（官方原文）。',
              en: 'The wording comes from the license’s own "How to apply" section, as published.',
            }
          : {
              zh: '该许可证在 SPDX 官方数据里**没有**文件头模板。因此这里给出的是 SPDX / REUSE 推荐的两行式写法——我们不会自造一段"看起来像法律声明"的文字塞进你的仓库。',
              en: 'This license ships no file-header template in the official SPDX data, so you get the SPDX / REUSE two-line form. We will not invent legal-sounding text and put it in your repository.',
            };
    files.push({
      path: `${expression}.header.txt`,
      content:
        (options.lang === 'zh'
          ? `# ${expression} 源文件声明头\n# 用法：把下面的内容粘贴到每个源文件顶部（已按所选语言套好注释语法）。\n# ${strategyNote.zh}\n\n`
          : `# ${expression} source file header\n# Paste the block below at the top of every source file (comment syntax already applied).\n# ${strategyNote.en}\n\n`) +
        header.text,
      why: {
        zh: `源文件缺少声明是该许可证最常见的合规缺口。${strategyNote.zh}`,
        en: `Missing source notices are the most common compliance gap for this license. ${strategyNote.en}`,
      },
      mandatory: false,
    });
    if (leftoverPlaceholders.length) {
      notices.push({
        level: 'warn',
        zh: `官方头模板里仍有 ${leftoverPlaceholders.length} 处占位符没有被识别替换（${[
          ...new Set(leftoverPlaceholders),
        ].join(', ')}）。请手工填写后再提交，不要直接使用。`,
        en: `The official header template still has ${leftoverPlaceholders.length} placeholder(s) we did not recognise (${[
          ...new Set(leftoverPlaceholders),
        ].join(', ')}). Fill them in by hand before committing.`,
      });
    }
  }

  /* ---- 5. REUSE 布局 ---- */
  if (options.includeReuseLayout) {
    files.push({
      path: `LICENSES/${spec.id}.txt`,
      content: textData.trimEnd() + '\n',
      why: {
        zh: 'REUSE 3.x 布局：这是给机器校验用的**逐字原文**副本，因此保持官方文本不变（含其中的占位符）。你自己的版权信息请以根目录的 LICENSE、NOTICE 与源文件头为准。',
        en: 'REUSE 3.x layout: a verbatim machine-checkable copy, so the official text is kept unmodified (placeholders included). Your own copyright details belong in the root LICENSE, the NOTICE file and source headers.',
      },
      mandatory: false,
    });
    if (spec.exceptionId && exceptionText) {
      files.push({
        path: `LICENSES/${spec.exceptionId}.txt`,
        content: exceptionText.licenseText.trimEnd() + '\n',
        why: {
          zh: 'REUSE 要求每个用到的许可证与例外都在 LICENSES/ 下有一份可校验副本。',
          en: 'REUSE requires a verifiable copy of every license and exception used under LICENSES/.',
        },
        mandatory: false,
      });
    }
  }

  /* ---- 6. 清单字段 ---- */
  files.push(...manifestSnippets(spec, options));

  /* ---- 7. README 段落 ---- */
  if (options.includeReadme) {
    const manifestNote =
      options.lang === 'zh'
        ? `包管理器字段：${options.manifests.length ? options.manifests.map((m) => `\`${m}\``).join('、') : '（尚未选择生态）'}`
        : `Manifest field: ${options.manifests.length ? options.manifests.map((m) => `\`${m}\``).join(', ') : '(no ecosystem selected)'}`;
    files.push({
      path: 'LICENSE-SECTION.md',
      content: readmeSection(spec, options, manifestNote),
      why: {
        zh: '可直接粘贴进 README 的许可段落。仓库里有 LICENSE 但 README 不说明授权情况，是新手项目最常见的疏漏。',
        en: 'A ready-to-paste README license section. Having a LICENSE file but never mentioning it in the README is the most common beginner omission.',
      },
      mandatory: false,
    });
  }

  /* ---- 8. 整体性提示 ---- */
  // 非 SPDX 归属的提示排在最前：它直接决定"这个标识符能不能写进清单字段"。
  if (spec.nonSpdx) {
    notices.push({
      level: 'warn',
      zh: `\`${spec.licenseRef ?? spec.id}\` **不是 SPDX 标识符**，而是 ScanCode LicenseDB 的记录。它的正文可以用（很多真实项目就在用这类条款），但注意两点：① \`LicenseRef-scancode-*\` 这种写法**不能填进 package.json / Cargo.toml 的 license 字段**，那些工具只认 SPDX 标识符；② 它不参与 OSI 认证，也不在 SPDX 的字段体系里，因此本站不会替它声明 NOTICE 义务或官方文件头。`,
      en: `\`${spec.licenseRef ?? spec.id}\` is **not an SPDX identifier** but a ScanCode LicenseDB record. Its text is usable — plenty of real projects ship exactly these terms — but note two things: (1) a \`LicenseRef-scancode-*\` form **cannot go into the license field of package.json or Cargo.toml**, which only accept SPDX identifiers; (2) it carries no OSI approval and sits outside the SPDX field model, so this site will not claim a NOTICE obligation or an official header for it.`,
    });
  }
  // 非开源分类与"已被取代"提示紧随其后：这两条会直接改变用户该不该用这个许可证的决定。
  if (spec.nonOpen) {
    notices.push({
      level: 'error',
      zh: `**这不是一个开源许可证。** ScanCode LicenseDB 把它归类为「${spec.category}」，该类别涵盖商业许可、非商业许可、source-available 与来源不明的许可。如果你想要的是开源许可证，请换一个；如果你确实要用它，请确认已理解它对使用、修改与再分发的限制。`,
      en: `**This is not an open-source license.** ScanCode LicenseDB classifies it as "${spec.category}", a category covering commercial, non-commercial, source-available and unstated licenses. If you wanted an open-source license, pick another one; if you do mean to use this, make sure you understand its limits on use, modification and redistribution.`,
    });
  }
  const keywordNotes = (spec.osiKeywords ?? [])
    .map((k) => ({ key: k, note: OSI_KEYWORD_NOTE[k] }))
    .filter((x): x is { key: string; note: { zh: string; en: string } } => Boolean(x.note));
  if (keywordNotes.length) {
    notices.push({
      level: keywordNotes.some((k) => k.key === 'superseded' || k.key === 'non-reusable') ? 'warn' : 'info',
      zh: `OSI 官方 API 给这个许可证打了这些标签：${keywordNotes.map((k) => `\`${k.key}\`（${k.note.zh}）`).join('、')}。`,
      en: `The official OSI API tags this license as: ${keywordNotes.map((k) => `\`${k.key}\` (${k.note.en})`).join(', ')}.`,
    });
  }
  if (spec.deprecated) {
    notices.push({
      level: 'warn',
      zh: `\`${spec.id}\` 已被 SPDX 标记为**废弃标识符**。它仍然可以生成（历史项目可能必须沿用），但新项目应当改用现行写法。`,
      en: `\`${spec.id}\` is marked as a **deprecated SPDX identifier**. It can still be generated — historical projects may have to keep it — but new projects should use the current form.`,
    });
  }
  if (spec.sourceDisclosure) {
    notices.push({
      level: spec.sourceDisclosure === 'No' ? 'info' : 'info',
      zh: `OSADL 义务清单给出的源码披露义务判定是「${spec.sourceDisclosure}」。这决定你要不要把衍生作品的源码一并提供——建议在发布前逐条核对。`,
      en: `The OSADL obligations checklist rates the source-disclosure obligation as "${spec.sourceDisclosure}". That decides whether you must ship the corresponding source of derivative works — check it before releasing.`,
    });
  }
  if (spec.copyleft && spec.copyleft !== 'No') {
    notices.push({
      level: 'info',
      zh: `OSADL 的 copyleft 判定是「${spec.copyleft}」，即该许可证带有传染性条件；把它与其它许可证的代码合并前请先核对组合判定。`,
      en: `The OSADL copyleft rating is "${spec.copyleft}", meaning the license carries reciprocal conditions. Check the combination verdict before merging it with code under other licenses.`,
    });
  }
  if (!spec.curated) {
    notices.push({
      level: 'info',
      zh: '这一许可证属于长尾条目：条款字段（专利、商标、改动标注等）由**正文文本推断**得出，没有人工梳理的双语解读。要做正式合规判断时请以许可证原文与 SPDX 页面为准。',
      en: 'This is a long-tail license: its term fields (patents, trademarks, change marking, and so on) are **inferred from the license text**, and there is no hand-written commentary. For a formal compliance decision, go by the license text and the SPDX page.',
    });
  }
  // 条款字段的来源要如实交代：人工标注、人工整理、还是正文推断，三者的可信度不同。
  if (spec.factsInferred) {
    notices.push({
      level: 'info',
      zh:
        spec.termsSource === 'choosealicense'
          ? '条款字段（专利、商标、改动标注、网络触发）取自 ChooseALicense 用固定词表做的**人工标注**。'
          : '条款字段（专利、商标、改动标注、网络触发）由**正文关键词推断**得出——这一许可证不在 ChooseALicense 的 47 个标注范围内，所以标注为不确定而不是给出看起来确定的结论。',
      en:
        spec.termsSource === 'choosealicense'
          ? 'The term fields (patents, trademarks, change marking, network trigger) come from ChooseALicense’s **hand-labelled** vocabulary.'
          : 'The term fields (patents, trademarks, change marking, network trigger) are **inferred from keywords in the text** — this license is outside ChooseALicense’s 47 labelled entries, so they are marked uncertain rather than presented as settled.',
    });
  } else if (spec.termsSource === 'choosealicense') {
    notices.push({
      level: 'info',
      zh: '条款字段为人工整理，并且与 ChooseALicense 的人工标注互相印证。',
      en: 'The term fields are hand-curated here and corroborated by ChooseALicense’s hand-labelled vocabulary.',
    });
  }
  if (spec.family === 'content' || spec.id.startsWith('CC-')) {
    notices.push({
      level: 'warn',
      zh: 'Creative Commons 官方明确建议不要对软件使用 CC 许可（CC0 除外）。如果你正在给代码授权，请改用软件许可证。',
      en: 'Creative Commons explicitly advises against using CC licenses for software (CC0 excepted). If you are licensing code, pick a software license instead.',
    });
  }
  if (spec.id === 'Apache-2.0') {
    notices.push({
      level: 'info',
      zh: '如果仓库中原本已有 NOTICE 文件，不要把本工具生成的内容整体覆盖——许可证要求保留既有的归属声明，应当追加或合并。',
      en: 'If the repository already has a NOTICE file, do not overwrite it wholesale: the license requires existing attribution notices to be retained. Append or merge instead.',
    });
  }
  if (spec.id.endsWith('-or-later')) {
    notices.push({
      level: 'info',
      zh: '你选择了 `-or-later`。请确保源文件声明头里的 "or (at your option) any later version" 逐字保留；改写成 "or later version" 之类的说法会导致 SPDX 识别失败。',
      en: 'You chose `-or-later`. Keep the phrase "or (at your option) any later version" verbatim in source headers; rewording it breaks SPDX detection.',
    });
  }
  if (spec.id.endsWith('-only') && /^(A|L)?GPL-/.test(spec.id)) {
    notices.push({
      level: 'info',
      zh: '你选择了 `-only`。这意味着贡献者与下游都不能改用更新的许可证版本，这是不可逆的决定（除非所有版权人同意重新授权）。',
      en: 'You chose `-only`: neither contributors nor downstream users may move to a later version. That decision is effectively irreversible unless every copyright holder agrees to relicense.',
    });
  }
  if (spec.exceptionId) {
    notices.push({
      level: 'info',
      zh: `表达式为 \`${expression}\`。注意"许可证 + 例外"是一个整体：只保留许可证全文而丢掉例外，会让下游误判你授予的权利范围。`,
      en: `The expression is \`${expression}\`. A license plus an exception is one unit: keeping the license text while dropping the exception misleads downstream users about what you granted.`,
    });
  }

  return { files, notices, leftoverPlaceholders, headerStrategy: spec.headerStrategy };
}

/* ------------------------------------------------------------------ *
 * 合规自查清单
 * ------------------------------------------------------------------ */

export function complianceChecklist(spec: LicenseSpec, options: GeneratorOptions, lang: Lang): string[] {
  const zh = lang === 'zh';
  const expression = expressionOf(spec);
  const items: string[] = [];

  if (options.includeFileHeader) {
    items.push(
      zh
        ? `把 ${expression}.header.txt 的内容加到每个源文件顶部（不是只加一个文件）。`
        : `Add the ${expression}.header.txt block to the top of every source file, not just one.`,
    );
  }
  if (spec.requiresNotice) {
    items.push(
      zh
        ? '发布任何分发包（含二进制）时都要随附 NOTICE，这是该许可证的硬性要求。'
        : 'Ship NOTICE with every distribution, including binaries. This license requires it.',
    );
  }
  if (spec.exceptionId) {
    items.push(
      zh
        ? `把例外条款 \`${spec.exceptionId}\` 的正文与许可证一起随仓库分发，并在清单字段里写成 \`${expression}\`。`
        : `Ship the \`${spec.exceptionId}\` text with the repository and write the manifest field as \`${expression}\`.`,
    );
  }
  if (spec.facts.stateChanges) {
    items.push(zh ? '修改原文件时，在文件中标注"已修改"及日期。' : 'Mark modified files as changed, with the date.');
  }
  items.push(
    zh
      ? '把 README 的许可段落补上，并在包管理器清单里填 license 字段。'
      : 'Add the README license section and fill the manifest license field.',
  );
  if (spec.facts.patentGrant !== 'explicit') {
    items.push(
      zh
        ? '该许可证没有明确专利授权。若项目涉及专利，请评估是否需要改用 Apache-2.0 或补一份贡献者许可协议。'
        : 'This license grants no explicit patent rights. If patents are relevant, consider Apache-2.0 or a contributor agreement.',
    );
  }
  if (spec.facts.trademarkClause) {
    items.push(
      zh
        ? '许可证不含商标授权——如需保护项目名称，另立商标政策。'
        : 'No trademark grant is included — add a trademark policy if the name matters.',
    );
  }
  items.push(
    zh
      ? '贡献者提交代码时的授权方式要事先明确：DCO（Signed-off-by）或 CLA 二选一。'
      : 'Decide up front how contributions are licensed: a DCO sign-off or a CLA.',
  );
  if (!spec.curated) {
    items.push(
      zh
        ? '这是一个长尾许可证：发布前请自行通读一遍正文，确认它授予的权利符合你的预期。'
        : 'This is a long-tail license: read the text once before publishing to confirm it grants what you expect.',
    );
  }
  return items;
}
