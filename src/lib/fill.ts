import type { Lang } from './types.ts';

/* ------------------------------------------------------------------ *
 * 版权信息模型
 * ------------------------------------------------------------------ */

export interface Holder {
  /** 版权主体名称，例如 "Acme Inc." 或 "张三" */
  name: string;
  /** 可选的起始年（默认取当前年） */
  from?: string;
  /** 可选的结束年；留空则为 "至今" */
  to?: string;
  /** 该主体对该作品享有的权利说明（仅 MPL 的附录 A 使用），默认 "Copyright" */
  right?: string;
}

export interface CopyrightInput {
  holders: Holder[];
  /** 许可证类型（决定要不要生成版权行、怎么写） */
  year?: string;
  /** 作品/项目名称，用于 GPL 家族的 "How to Apply" 段落 */
  projectName: string;
  /** 一句话描述，用于 GPL 家族示例段落的首行 */
  projectDescription?: string;
  /** 联系邮箱（GPL 家族建议在声明段后补充联系方式） */
  contactEmail?: string;
  /** 仓库地址，用于 README 与 GPL 声明中的 "You should have received..." 补充 */
  repoUrl?: string;
  /**
   * 版权行的书写风格。不同司法辖区对 "(c)" 与 "©" 的效力理解不同，
   * 该选择会同时影响 LICENSE、NOTICE 与源文件头，保证全仓库一致。
   */
  symbolStyle: 'c-paren' | 'copyright-symbol' | 'word';
  /** 多个主体的连接方式 */
  joiner: 'newline' | 'and';
}

export const DEFAULT_COPYRIGHT: CopyrightInput = {
  holders: [],
  projectName: '',
  symbolStyle: 'word',
  joiner: 'newline',
};

/** 当前年份（浏览器端与构建期一致） */
export function currentYear(): number {
  return new Date().getFullYear();
}

/** 版权年份段："2026" / "2020-2026" / "2020-至今" */
export function formatYears(holder: Holder): string {
  const from = (holder.from ?? '').trim() || String(currentYear());
  const to = (holder.to ?? '').trim();
  if (!to) return from;
  if (to === from) return from;
  return `${from}-${to}`;
}

/**
 * 单个主体的版权行（不含结束符），例如 "Copyright (C) 2020-2026 Acme Inc."
 *
 * `right` 用于 MPL-2.0 附录 A 那类允许自定义权利说明的场景：一旦给出，就完整替换掉符号部分，
 * 而不是被符号逻辑吞掉——这一点在实现里很容易写错。
 */
export function formatHolderLine(holder: Holder, style: CopyrightInput['symbolStyle'] = 'word'): string {
  const symbol =
    style === 'c-paren' ? '(C)' : style === 'copyright-symbol' ? '\u00A9' : 'Copyright (C)';
  const explicit = holder.right?.trim();
  const head = explicit ? explicit : symbol;
  return `${head} ${formatYears(holder)} ${holder.name.trim()}`.replace(/\s+/g, ' ').trim();
}

/** 完整版权行集合；joiner 决定多主体是一行一条还是一行并列 */
export function formatCopyrightLines(input: CopyrightInput): string[] {
  const holders = input.holders.filter((h) => h.name.trim());
  if (!holders.length) return [];
  if (input.joiner === 'and' && holders.length > 1) {
    return [holders.map((h) => formatHolderLine(h, input.symbolStyle)).join(' and ')];
  }
  return holders.map((h) => formatHolderLine(h, input.symbolStyle));
}

/** 版权行的展示名（用于 UI 摘要） */
export function describeCopyright(input: CopyrightInput): string {
  const lines = formatCopyrightLines(input);
  return lines.length ? lines.join(' / ') : '';
}

/* ------------------------------------------------------------------ *
 * 从许可证正文中提取"填充前的原始片段"
 *
 * 这些片段一律从上游 SPDX 文本中**原样抓取**，不做手工重写，
 * 以免出现"我们改写了 GPL 文本"这种严重问题。
 * ------------------------------------------------------------------ */

/** 项目的短名（用于 GPL 家族交互式声明的 <program>） */
function programName(input: CopyrightInput): string {
  return input.projectName.trim() || 'this program';
}

/** 一句话描述（GPL 家族示例段首行；缺省时保留可读的通用描述） */
function oneLine(input: CopyrightInput): string {
  const name = programName(input);
  const desc = input.projectDescription?.trim();
  return desc ? `${name} - ${desc}` : name;
}

/**
 * 提取"如何将这些条款应用到你的新程序"这一整段（GPL/LGPL/AGPL 均以此标题开始），
 * 返回 [正文部分, 该段落起止索引]，便于把占位符替换限制在这一段内。
 */
function findApplySectionIndex(text: string): number {
  const markers = ['How to Apply These Terms', 'How to Apply These Terms to Your New Programs'];
  for (const m of markers) {
    const i = text.indexOf(m);
    if (i >= 0) {
      // 回退到该行的行首，避免把上一段末尾切掉
      const lineStart = text.lastIndexOf('\n', i);
      return lineStart >= 0 ? lineStart + 1 : i;
    }
  }
  return -1;
}

/**
 * 只替换**示例段落**里的占位符，绝不触碰正文。
 * 这一点很重要：GPLv3 正文中 "Copyright (C) 2007 Free Software Foundation" 的 2007 必须保持原样，
 * 而示例段里的 <year> 才是给用户填的。竞品里常见的粗暴全文替换正是踩了这个坑。
 */
function fillApplySection(text: string, input: CopyrightInput): string {
  const idx = findApplySectionIndex(text);
  if (idx < 0) return text;

  const head = text.slice(0, idx);
  let tail = text.slice(idx);
  const name = programName(input);
  const years = input.holders.length ? formatYears(input.holders[0]) : String(currentYear());
  const author = input.holders.length
    ? input.holders.map((h) => h.name.trim()).filter(Boolean).join(', ')
    : 'the copyright holders';

  tail = tail.replaceAll('<one line to give the program\'s name and a brief idea of what it does.>', oneLine(input));
  tail = tail.replaceAll('<program>', name);
  tail = tail.replaceAll('<year>', years);
  tail = tail.replaceAll('<name of author>', author);

  if (input.contactEmail?.trim()) {
    const note = `\n\n  Contact: ${input.contactEmail.trim()}\n`;
    // 插在 "Also add information on how to contact you..." 这句之后更自然，找不到就追加在末尾
    const anchor = 'Also add information on how to contact you by electronic and paper mail.';
    if (tail.includes(anchor)) {
      tail = tail.replace(anchor, anchor + note);
    } else {
      tail = tail.trimEnd() + note;
    }
  }
  return head + tail;
}

/* ------------------------------------------------------------------ *
 * 许可证正文填充
 * ------------------------------------------------------------------ */

export interface FillResult {
  /** 填充后的完整正文 */
  text: string;
  /** 本次真正发生了哪些替换（用于在 UI 上向用户交代我们改了什么） */
  appliedFixes: string[];
  /** 仍然残留的可疑占位符（正常情况下应为空） */
  leftoverPlaceholders: string[];
}

/**
 * 把用户信息填进许可证正文。
 *
 * 处理策略按许可证"自带占位符的形态"分三类：
 *  - `copyright-line`：正文首部自带版权行（MIT / BSD / ISC），填入即完成，产物是完整可用的 LICENSE。
 *  - `apply-section`：正文尾部有 "How to Apply" 示例段（GPL / LGPL / AGPL v3），只替换该段内的占位符，
 *    并在句首补一条醒目的提醒——因为"示例段不等于生效声明"。
 *  - `metadata-only`：正文不含任何版权占位符（Apache / MPL / EPL / CC 等），
 *    正文保持逐字原样，版权信息通过 NOTICE、源文件头与包管理器字段落地。
 */
/**
 * 允许把用户版权信息写进正文的许可证白名单。
 *
 * 这是逐个核对上游文本后的结论，不是可配置的偏好：
 * 只有 MIT、BSD-2-Clause、BSD-3-Clause 的正文里**确实**留有 `<year>` / `<copyright holders>` /
 * `<owner>` 这种"给使用者填"的位置。0BSD、MIT-0、ISC、Zlib 属于免署名或零条款许可，
 * 它们的正文里没有任何版权占位符——往正文里塞一行版权声明等于篡改官方文本，
 * 所以这些许可证的版权信息只走 NOTICE、源文件头与包管理器字段。
 */
/**
 * 判断正文的**版权行区域**里是否还有"给使用者填"的位置。
 *
 * 全量扫描 740 个 SPDX 正文后确认，占位符写法至少有五种：
 *   MIT                Copyright (c) <year> <copyright holders>
 *   BSD-2/3-Clause     Copyright (c) <year> <owner>
 *   0BSD               Copyright (C) YEAR by AUTHOR EMAIL
 *   Clear BSD          Copyright (c) [xxxx]-[xxxx] [Owner Organization]
 *   MirOS              Copyright [YEAR] [NAME] [EMAIL]
 *
 * 关键坑：直接在整篇正文里搜大写单词会大量误报——BSD 系免责声明里到处是
 * "THIS SOFTWARE IS PROVIDED BY THE AUTHOR ..."，那是**正文措辞不是占位符**。
 * 审计脚本（scripts/audit-placeholders.mjs）显示 27 个"裸大写"命中里绝大多数属于误报。
 * 因此这里把搜索范围严格限定在含 "Copyright" 的那一两行，以及正文开头的一小段。
 */
function copyrightRegion(text: string): string {
  const lines = text.slice(0, 900).split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/copyright/i.test(lines[i])) {
      out.push(lines[i]);
      // 版权行常跨行（例如 EPICS 的 "Copyright © <YEAR> <HOLDERS>. All rights reserved."）
      if (lines[i + 1] && lines[i + 1].trim() && !/^[A-Z\s]{20,}$/.test(lines[i + 1])) out.push(lines[i + 1]);
    }
  }
  return out.join('\n');
}

/**
 * 判断正文里是否有**能被我们替换**的版权位置。
 *
 * 判定方式刻意改成"先替换、再看结果"，而不是靠一条推测性正则：
 * 早期版本用 `copyrightRegion` 找大写词，把 AAL、BSD-3-Clause-acpica 这类
 * 正文里含 "THE AUTHOR"、"COPYRIGHT HOLDERS" 的许可证误判成"有可填位置"，
 * 结果既没填到东西、又被标成可填。现在的判定与实际能力严格一致：
 * 只有 SLOT_PATTERNS 真的命中，才算"这个许可证留了位置"。
 */
export function hasCopyrightPlaceholder(text: string): boolean {
  return SLOT_PATTERNS.some(({ re }) => re.test(text));
}

/** 统计残留的占位符种类（用于自检与界面提示） */
export function findPlaceholders(text: string): string[] {
  return [
    ...text.matchAll(
      /<year>|<name of author>|<program>|<owner>|<copyright holders?>|<holders?>|<one line[^>]*>|\[(?:yyyy|year|xxxx|name|email|owner organization|copyright holders?|fullname)\]/gi,
    ),
  ].map((m) => m[0]);
}

/**
 * 受控的版权行替换表。
 *
 * 刻意不用一条通用正则去猜：全量审计表明占位符写法过于发散，
 * 泛化替换会误伤正文（例如把免责声明里的 AUTHOR 换成用户名）。
 * 因此每一条都对应一个**已核实的真实文本片段**（scripts/audit-placeholders.mjs 可复现审计）。
 *
 * 收录标准只有一条：**许可证作者自己把这个位置留给了使用者**。
 * 反例（刻意不收录）：
 *  - FTL 的 `Please replace <year> with the value from the FreeType version you actually use.`
 *    是写给读者的**说明**，不是待填位置；填掉它反而把作者的指引弄坏了。
 *  - LPL-1.0 的 `<OWNER>` 是正文里反复引用的**定义变量**，不是版权行。
 */
const SLOT_PATTERNS: { name: string; re: RegExp; suffix?: string }[] = [
  // MIT / ECL-1.0 / BSD-2-Clause-Patent: Copyright (c) <year> <copyright holders>
  { name: 'mit', re: /Copyright \(c\) <year>\s+<copyright holders?>/i },
  // BSD 家族: Copyright (c) <year> <owner>（原文可能带句点）
  { name: 'bsd', re: /Copyright \(c\) <year>\s+<owner>\.?/i },
  // MIT-0 / BSD-2-Clause-Patent: Copyright <YEAR> <COPYRIGHT HOLDER>
  { name: 'angle-upper', re: /Copyright <(?:YEAR|Year|year)>\s+<COPYRIGHT HOLDERS?>/i },
  // EPICS: Copyright © <YEAR> <HOLDERS>. All rights reserved.
  { name: 'angle-holders', re: /Copyright (?:©|\(c\))\s*<(?:YEAR|Year|year)>\s+<HOLDERS>/i },
  // NCSA 等: Copyright (c) <Year> <Owner Organization Name>. All rights reserved.
  {
    name: 'owner-organization-name',
    re: /Copyright (?:©|\(c\))\s*<(?:YEAR|Year|year)>\s+<Owner Organization Name>/i,
  },
  // ASWF: <Asset Name> Copyright <Year> <Asset Owner>. All rights reserved.
  { name: 'aswf', re: /<Asset Name> Copyright <(?:YEAR|Year|year)>\s+<Asset Owner>/i },
  // Nokia: Copyright © <year> Nokia and others. All Rights Reserved.
  { name: 'nokia', re: /Copyright (?:©|\(c\))\s*<(?:YEAR|Year|year)>\s+Nokia and others/i },
  // HPND 的版权行：Copyright <year> <copyright holder>（年份也是占位符）
  { name: 'hpnd', re: /Copyright <(?:YEAR|Year|year)>\s+<copyright holders?>/i },
  // OPUBL-1.0: Copyright (c) <year> by <author's name or designee>
  { name: 'opubl', re: /Copyright \(c\) <(?:YEAR|Year|year)> by <author's name or designee>/i },
  // ISC / 0BSD 系列
  { name: 'isc', re: /Copyright <(?:YEAR|Year|year)>\s+<owner>/i },
  { name: '0bsd', re: /Copyright \(C\) YEAR by AUTHOR EMAIL/i },
  // Clear BSD: Copyright (c) [xxxx]-[xxxx] [Owner Organization]
  { name: 'clear-bsd', re: /Copyright \(c\) \[xxxx\]-\[xxxx\] \[Owner Organization\]/i },
  // UPL-1.0: Copyright (c) [year] [copyright holders]
  { name: 'upl', re: /Copyright \(c\) \[year\] \[copyright holders?\]/i },
  // MirOS: Copyright [YEAR] [NAME] [EMAIL]
  { name: 'miros', re: /Copyright \[YEAR\] \[NAME\] \[EMAIL\]/i },
  // Hippocratic-2.1: [SOFTWARE NAME] Copyright (YEAR) (COPYRIGHT HOLDER(S)/AUTHOR(S))
  { name: 'hippocratic', re: /\[SOFTWARE NAME\] Copyright \(YEAR\) \(COPYRIGHT HOLDER\(S\)\/AUTHOR\(S\)\)/i },
];

/**
 * 命中之后，如果正文别处还出现同一个占位符 token，就把那些位置也填上主体名称。
 *
 * 典型例子是 HPND：版权行是 `Copyright <year> <copyright holder>`，
 * 但免责声明里还会单独出现一次 `<copyright holder> DISCLAIMS ALL WARRANTIES...`。
 * 只填版权行会在用户仓库里留下一个尖括号占位符；而给那些位置填整行版权声明又会读不通
 * （"Copyright 2024 Acme Inc. DISCLAIMS..."），所以只能填主体名称。
 */
const TOKEN_FOLLOWUPS: { token: RegExp; value: 'holder' }[] = [
  { token: /<copyright holders?>/gi, value: 'holder' },
  { token: /<owner organization>/gi, value: 'holder' },
  { token: /<asset owner>/gi, value: 'holder' },
];

/** 版权主体名称（多个主体用 " and " 连接），用于需要"只写名字"的位置 */
function options_ownerName(input: CopyrightInput): string {
  return input.holders
    .map((h) => h.name.trim())
    .filter(Boolean)
    .join(' and ');
}

/**
 * 生成许可证正文。
 *
 * **原则：非必要不改。人怎么写的就怎么来。**
 *
 * 世界上真实的项目是怎么处理这些许可证的，这里就怎么做：
 *
 *  1. **只替换许可证作者自己留出的版权行占位符。** MIT 的
 *     `Copyright (c) <year> <copyright holders>`、ISC 的 `Copyright <year> <owner>`
 *     就是作者留给使用者的位置——每个用 MIT 的项目都会把它换成自己的版权行，这是许可证
 *     设计的正常用法，不属于"改写"。因此这一类照填。
 *
 *  2. **例示与说明段落一律不动。** GPL 的 "How to Apply These Terms" 一节是 FSF 写的
 *     **示例**，不是生效条款；真实项目也不会去改它（改了反而让人以为许可证被改过）。
 *     因此这类内容原样保留，需要的那份声明由 header 文件另行给出。
 *
 *  3. **许可证没有留位置时，一个字都不加。** Apache-2.0、MPL-2.0、EPL-2.0 的正文里
 *     没有版权行，真实项目也不会往正文里塞一行——它们靠 NOTICE 与源文件头承载归属。
 *     所以我们也不加。
 *
 *  4. **条款里的占位符要一并处理干净，但只填主体名称。** Clear BSD 的
 *     `[...] [Owner Organization]` 在正文里出现两次（版权行与背书条款），
 *     只填一处会在用户仓库里留下一个方括号占位符；两处都要填，且背书条款里只能填
 *     **主体名称**，填整行版权声明会产出读不通的句子。
 */
export function fillLicenseText(id: string, rawText: string, input: CopyrightInput): FillResult {
  const appliedFixes: string[] = [];
  let text = rawText;

  const holderLines = formatCopyrightLines(input);

  // 只替换版权行里的位置。多个主体合并成一行，因为许可证正文里的版权行本来就只占一行，
  // 插入换行会破坏原文的段落结构。
  const inline = holderLines.join(' and ');
  const ownerName = options_ownerName(input);
  if (hasCopyrightPlaceholder(text) && holderLines.length) {
    for (const { name, re } of SLOT_PATTERNS) {
      if (re.test(text)) {
        text = text.replace(re, () => inline);
        appliedFixes.push(`copyright-line:${name}`);
      }
    }
    // Clear BSD 的背书条款：`Neither the name of [Owner Organization] nor the names of its ...`
    if (ownerName) {
      const endorsement = /Neither the name of \[Owner Organization\]/;
      if (endorsement.test(text)) {
        text = text.replace(endorsement, `Neither the name of ${ownerName}`);
        appliedFixes.push('endorsement-clause');
      }
      // 其余同一 token 的出现处一并填主体名称，避免留下占位符
      for (const { token, value } of TOKEN_FOLLOWUPS) {
        if (value !== 'holder' || !ownerName) continue;
        if (token.test(text)) {
          text = text.replace(token, () => ownerName);
          appliedFixes.push('followup-holder');
        }
      }
      if (text.includes('[Owner Organization]')) {
        text = text.replaceAll('[Owner Organization]', ownerName);
        appliedFixes.push('owner-organization');
      }
    }
  }

  // 残留占位符自检——宁可让用户看到警告，也不要静默输出带 <year> 的文件
  const leftoverPlaceholders = findPlaceholders(text);

  return { text: text.trimEnd() + '\n', appliedFixes, leftoverPlaceholders };
}

/* ------------------------------------------------------------------ *
 * 源文件声明头
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * 源文件头模板
 * ------------------------------------------------------------------ */

/**
 * GPL / LGPL / AGPL 的官方 per-file 声明段。
 *
 * 注意：这不是我们编的模板，而是各许可证正文 "How to Apply These Terms" 一节里
 * 由 FSF 给出的原文措辞（仅替换 <program> / <year> / <name of author>）。
 * 使用官方措辞的意义在于：SPDX 与合规工具依赖这段固定措辞来识别许可证。
 */
export function gnuBoilerplate(id: string, input: CopyrightInput, _lang: Lang): string {
  const year = input.holders.length ? formatYears(input.holders[0]) : String(currentYear());
  const author = input.holders.length
    ? input.holders
        .map((h) => h.name.trim())
        .filter(Boolean)
        .join(', ')
    : 'the copyright holders';
  const name = programName(input);
  const desc = input.projectDescription?.trim();
  const firstLine = desc ? `${name} - ${desc}` : name;

  const isLesser = id.startsWith('LGPL');
  const isAffero = id.startsWith('AGPL');
  const programWord = isLesser ? 'library' : 'program';

  const licenseName = isAffero
    ? 'GNU Affero General Public License'
    : isLesser
      ? 'GNU Lesser General Public License'
      : 'GNU General Public License';

  // 官方示例段只区分"或更新版本"与"仅此版本"；GPL 家族正文两版相同，区别全在这句话里，
  // 所以这里必须严格跟随用户选的 SPDX 标识符，不能自行简化。
  const orLater = id.endsWith('-or-later');
  const versionNumber = id.includes('3.0') ? '3' : '2';
  const versionLine = orLater
    ? `either version ${versionNumber} of the License, or (at your option) any later version.`
    : `version ${versionNumber} of the License only.`;

  // LGPLv3 官方要求声明中指明它是对 GPLv3 的补充；这段措辞来自 LGPLv3 正文本身。
  const lgplSupplement =
    isLesser && id.includes('3.0')
      ? [
          '',
          'This version of the library incorporates the terms of the GNU Lesser',
          'General Public License, version 3, which supplements the GNU General',
          'Public License, version 3.',
        ]
      : [];

  // AGPL 的官方声明段额外包含网络交互条款提示。
  const agplNetwork = isAffero
    ? [
        '',
        'This program also provides interactive user interfaces, which must display',
        'Appropriate Legal Notices as described in section 13 of the GNU Affero',
        'General Public License.',
      ]
    : [];

  return [
    firstLine,
    `Copyright (C) ${year}  ${author}`,
    '',
    `This ${programWord} is free software: you can redistribute it and/or modify`,
    `it under the terms of the ${licenseName} as published by`,
    `the Free Software Foundation, ${versionLine}`,
    '',
    `This ${programWord} is distributed in the hope that it will be useful,`,
    'but WITHOUT ANY WARRANTY; without even the implied warranty of',
    'MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the',
    `${licenseName} for more details.`,
    '',
    `You should have received a copy of the ${licenseName}`,
    `along with this ${programWord}.  If not, see <https://www.gnu.org/licenses/>.`,
    ...lgplSupplement,
    ...agplNetwork,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** 语言的注释语法 */
export type CommentStyle =
  | 'slash' // // 与 /* */
  | 'hash' // #
  | 'dash' // --
  | 'semicolon' // ;
  | 'percent' // %
  | 'html'
  | 'xml'
  | 'rem'
  | 'quote';

export interface LanguageProfile {
  id: string;
  label: string;
  style: CommentStyle;
  /** 文件扩展名（用于生成的文件名示例） */
  ext: string;
  /** 该语言生态的包管理器清单文件，用于生成 license 字段 */
  manifests?: string[];
  /** 块注释包裹方式（有则优先用块注释） */
  block?: { open: string; line: string; close: string };
}

export const LANGUAGES: LanguageProfile[] = [
  // 这组全是 `/* */` 块注释。把 JS / TS / CSS 排在最前：它们是绝大多数项目的语言
  // （本仓库自身就是 TS + JS + CSS），用户在下拉里找自己项目的语言时应当第一眼看到。
  // CSS 之前漏掉了——它只有块注释、不支持 `//` 行注释，而这组恰好渲染成块注释，所以放这里。
  { id: 'c', label: 'JS / TS / CSS / SCSS / LESS / C / C++ / C# / Java / Go / Rust / Swift / Kotlin', style: 'slash', ext: 'c', manifests: ['package.json', 'Cargo.toml', 'pom.xml'] },
  { id: 'python', label: 'Python / Ruby / Shell / YAML / TOML', style: 'hash', ext: 'py', manifests: ['pyproject.toml', 'setup.cfg', 'Gemfile'] },
  { id: 'sql', label: 'SQL', style: 'dash', ext: 'sql', manifests: [] },
  { id: 'lisp', label: 'Lisp / Clojure / ASM', style: 'semicolon', ext: 'lisp', manifests: [] },
  { id: 'tex', label: 'LaTeX / MATLAB / Erlang', style: 'percent', ext: 'tex', manifests: [] },
  { id: 'html', label: 'HTML / Markdown / Vue', style: 'html', ext: 'html', manifests: [] },
  { id: 'xml', label: 'XML / Maven POM / SVG', style: 'xml', ext: 'xml', manifests: ['pom.xml'] },
  { id: 'batch', label: 'Windows Batch / VBScript', style: 'rem', ext: 'bat', manifests: [] },
  { id: 'plain', label: '纯文本（不加注释符号）', style: 'quote', ext: 'txt', manifests: [] },
];

/** 按语言把一段文本渲染成注释块 */
export function renderComment(body: string, style: CommentStyle): string {
  const lines = body.split('\n');
  switch (style) {
    case 'slash':
      return ['/*', ...lines.map((l) => (l ? ` * ${l}` : ' *')), ' */'].join('\n');
    case 'hash':
      return lines.map((l) => (l ? `# ${l}` : '#')).join('\n');
    case 'dash':
      return lines.map((l) => (l ? `-- ${l}` : '--')).join('\n');
    case 'semicolon':
      return lines.map((l) => (l ? `; ${l}` : ';')).join('\n');
    case 'percent':
      return lines.map((l) => (l ? `% ${l}` : '%')).join('\n');
    case 'rem':
      return lines.map((l) => (l ? `REM ${l}` : 'REM')).join('\n');
    case 'html':
      return ['<!--', ...lines.map((l) => (l ? `  ${l}` : '')), '-->'].join('\n');
    case 'xml':
      return ['<!--', ...lines.map((l) => (l ? `  ${l}` : '')), '-->'].join('\n');
    case 'quote':
    default:
      return body;
  }
}

/** SPDX 两行式（REUSE 3.x 推荐写法） */
export function spdxHeader(id: string, input: CopyrightInput): string {
  const lines: string[] = [];
  const holders = input.holders.filter((h) => h.name.trim());
  if (holders.length) {
    for (const h of holders) {
      lines.push(`SPDX-FileCopyrightText: ${formatYears(h)} ${h.name.trim()}`);
    }
  } else {
    lines.push(`SPDX-FileCopyrightText: ${currentYear()} the copyright holders`);
  }
  lines.push(`SPDX-License-Identifier: ${id}`);
  return lines.join('\n');
}

/**
 * 填充 **SPDX 官方文件头模板**里的占位符。
 *
 * 审计（scripts/audit-official-headers.mjs）覆盖了官方数据里全部 93 个模板，
 * 实测占位符写法至少有这些形态：
 *   Apache-2.0 / ECL-2.0     Copyright [yyyy] [name of copyright owner]
 *   MulanPSL-2.0             Copyright (c) [Year] [name of copyright holder]
 *   AGPL-3.0-only            Copyright (C) [year] [name of author]
 *   GPL-2.0-only / BUSL-1.1  Copyright (C) yyyy name of author      ← 连括号都没有
 *   GPL-3.0-* / ECL-1.0      Copyright (C) <year> <name of author>
 *   GFDL-1.3-only            Copyright (c) YEAR YOUR NAME
 *   CPAL-1.0                 ... you may obtain a copy of the License at ______
 *   AGPL-3.0 / GPL-3.0       You should have received ... <https://www.gnu.org/licenses/>
 *
 * 两个必须小心的地方：
 *  1. 模板里有真实 URL（`<https://www.gnu.org/licenses/>`）与真实年份（`[2019]`）。
 *     因此**先保护 URL 段**，且不收录 `[2019]` 这类具体值——它可能是示例也可能是事实，
 *     替换掉会篡改原文。
 *  2. 必须报告替换后仍像占位符的 token。宁可让界面给出警告并让用户手工填写，
 *     也绝不静默输出带 `[year]` 的文件。
 */
export function fillTemplatePlaceholders(template: string, input: CopyrightInput): string {
  const years = input.holders.length ? formatYears(input.holders[0]) : String(currentYear());
  const author = options_ownerName(input) || 'the copyright holders';
  const name = input.projectName.trim();
  const desc = input.projectDescription?.trim();
  const oneLine = desc ? `${name} - ${desc}` : name;

  // 1) 先把 URL 段摘出来，避免后续规则把 <https://...> 或 [____] 之类的替换弄坏
  const urls: string[] = [];
  let out = template.replace(/<https?:\/\/[^>\s]+>/g, (m) => {
    urls.push(m);
    return `\u0000URL${urls.length - 1}\u0000`;
  });

  // 2) 按"先具体、后宽泛"的顺序替换。顺序很关键：
  //    较长的短语必须排在较短的裸词之前，否则文本会被切碎（`name of author` 先被
  //    `author` 吃掉一半，就再也匹配不上了）。
  //    替换值一律用函数形式返回：字符串里的 `$1` 会被当成捕获组引用，
  //    只是恰好这些值里没有 `$`，但用函数可以彻底避免这类隐式行为。
  const subs: [RegExp, string][] = [
    // 版权主体（覆盖方括号、尖括号、裸词三种写法）
    [/\[name of copyright owner\]|\[name of copyright holder\]|\[copyright holders?\]|\[name of author\]|\[owner organization\]|\[owner\]|\[fullname\]/gi, author],
    [/<name of author>/gi, author],
    [/<copyright holders?>/gi, author],
    [/\[author\]|\[name\]|\[holder\]/gi, author],
    [/\bname of author\b/gi, author],
    [/\bname of copyright holder\b/gi, author],
    [/\bYOUR NAME\b/g, author],
    // 年份（顺序：先合并区间，再逐个形式）
    [/\[xxxx\]-\[xxxx\]/gi, years],
    [/\[yyyy\]|\[year\]|\[xxxx\]|<yyyy>|<year>|\[Year\]/gi, years],
    [/\byyyy\b/gi, years],
    // GFDL 系列的模板写成 "Copyright (c) YEAR YOUR NAME"，YEAR 是单独的裸词。
    // 只在紧跟在 Copyright 后面的位置替换，避免误伤正文里正常的 "year"。
    [/(Copyright (?:\(c\)|©)\s*)YEAR\b/gi, years],
    // 软件名 / 程序名 / 描述
    [/\[ ?name of software ?, ?version number ?, ?and release date ?\]/gi, name || author],
    [/\[Software Name\]|\[software name\]|\[name of software\]|\[project name\]/gi, name || author],
    [/<program>/gi, name || 'this program'],
    [/<one line to give the program's name and a brief idea of what it does\.>/gi, oneLine],
    // 其他示例占位
    [/\[contact email\]|\[email\]/gi, input.contactEmail?.trim() || author],
    [/\[\$date-of-software\]|\[date\]/gi, String(currentYear())],
    [/\[\$name_of_software: \$distribution_URI\]/gi, input.repoUrl?.trim() || name || author],
  ];
  for (const [re, value] of subs) out = out.replace(re, () => value);

  // CPAL-1.0 / CUA-OPL-1.0 等用连续下划线表示"填你的信息"，且可能被方括号包着。
  // 这两步必须一起做：只换下划线会留下 `[Acme Inc.]` 这种半成品。
  out = out.replace(/\[_{3,}\]/g, () => author);
  out = out.replace(/_{3,}/g, () => author);

  // 3) 还原 URL
  out = out.replace(/\u0000URL(\d+)\u0000/g, (_m, i) => urls[Number(i)] ?? '');

  return out;
}

/**
 * 找出替换后**仍然像占位符**的 token。
 *
 * 判定刻意保守，只报告"看起来像给使用者留的空"的东西：
 * 方括号/尖括号包起来的文本、以及已知的裸写占位词。排除两类明确的误报源：
 *   - URL（`<https://www.gnu.org/licenses/>`）
 *   - 脚注编号（W3C 的正文里 `[1]` 就是在引用文末的链接，不是占位符）
 * 宁可少报也不要刷屏，否则真正的风险会被噪音淹掉。
 */
export function templateLeftovers(text: string): string[] {
  const tokens = new Set<string>();
  const protectedText = text.replace(/<https?:\/\/[^>\s]+>/g, ' ');
  for (const m of protectedText.matchAll(/\[[^\]\n]{1,60}\]/g)) {
    if (/^\[\d+\]$/.test(m[0])) continue; // 脚注编号
    tokens.add(m[0]);
  }
  for (const m of protectedText.matchAll(/<[^>\n]{1,60}>/g)) tokens.add(m[0]);
  for (const m of protectedText.matchAll(
    /\b(?:yyyy|yy|name of author|name of copyright holder|copyright holder|fullname|your name)\b/gi,
  )) {
    tokens.add(m[0]);
  }
  // 裸写的 YEAR 只在 Copyright 上下文里才算占位符
  for (const m of protectedText.matchAll(/Copyright (?:\(c\)|©)\s*(YEAR)\b/gi)) tokens.add(m[1]);
  return [...tokens];
}

/** 生成源文件头。
 *
 * 三条路线，优先级从高到低：
 *  1. `spdx-official`：SPDX 数据自带 standardLicenseHeader。这是权威措辞，
 *     而且**精确区分 `-only` / `-or-later`**（"version 3." 对比 "either version 3 … or any later version"），
 *     所以只要它存在就一定优先使用。
 *  2. `gnu-boilerplate`：官方数据缺失时的 GNU 家族回落到许可证正文自带的示例段措辞。
 *  3. `spdx-tag`：许可证没有官方模板。此时**不自造法律声明**，
 *     只给 SPDX / REUSE 推荐的两行式——这一点是本项目与竞品的重要差别。
 */
export function fileHeader(
  id: string,
  input: CopyrightInput,
  style: CommentStyle,
  options?: {
    includeSpdxTag?: boolean;
    officialHeader?: string;
    strategy?: 'spdx-official' | 'gnu-boilerplate' | 'spdx-tag';
    expression?: string;
  },
): { text: string; leftovers: string[] } {
  const tag = options?.expression ?? id;
  const withTag = (body: string) =>
    options?.includeSpdxTag === false ? body : `${body}\n\nSPDX-License-Identifier: ${tag}`;

  if (options?.officialHeader?.trim()) {
    const filled = fillTemplatePlaceholders(options.officialHeader, input);
    return { text: renderComment(withTag(filled.trimEnd()), style) + '\n', leftovers: templateLeftovers(filled) };
  }
  if (id.startsWith('GPL') || id.startsWith('LGPL') || id.startsWith('AGPL')) {
    const body = gnuBoilerplate(id, input, 'en');
    return { text: renderComment(withTag(body), style) + '\n', leftovers: findPlaceholders(body) };
  }
  const body = spdxHeader(tag, input);
  return { text: renderComment(body, style) + '\n', leftovers: [] };
}

/** 许可证声明的语言说明：文件内容恒为英文官方措辞，界面语言只影响解释文案 */
export const BOILERPLATE_LANGUAGE_NOTE: { zh: string; en: string } = {
  zh: '生成的文件内容一律使用英文官方措辞。许可证声明是写给下游使用者的，使用非官方译文会削弱其在合规工具链中的可识别性与法律效力；界面语言只影响解释与提示。',
  en: 'Generated file contents always use the official English wording. License notices are read by downstream users and by automated compliance tooling, so paraphrasing or translating them weakens both detectability and legal effect. The interface language only affects the explanations.',
};
