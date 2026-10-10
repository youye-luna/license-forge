import { LICENSES, LICENSE_BY_ID } from './licenses.ts';
import type { Lang } from './types.ts';

export const UI = {
  brand: { zh: '许可证锻造台', en: 'LicenseForge' },
  tagline: {
    zh: '按真实条款差异做选择，一次生成整套合规文件',
    en: 'Choose by what the terms actually do — then generate the whole compliance set at once',
  },
  privacy: {
    zh: '所有文本与生成逻辑都在你的浏览器里运行，填写的内容不会离开这台设备。',
    en: 'All texts and generation logic run in your browser. Nothing you type leaves this device.',
  },
};

/* ------------------------------------------------------------------ *
 * 界面流程：单线，不做模式切换
 *
 * 早期版本让用户先选"新手版 / 专业版"，但实际使用下来这是多出来的一步：
 * 两个模式的差别只在文案深浅与默认值，而**选许可证这件事对谁都需要**。
 * 现在的流程是一条线：
 *
 *   打开 → 问卷（向导） → 选择与对比 → 生成产物 → 关于
 *
 *  - 一进站就是问卷，不在前面加任何门槛；
 *  - 问卷里保留「跳过问卷，直接选许可证」，熟手一步就能到选择器；
 *  - 对比能力内嵌在"选择与对比"页里（这两件事本来就在同一个决策流程里）；
 *  - 条款字段等细节只在该出现的地方展开，不再靠"模式"控制信息密度。
 * ------------------------------------------------------------------ */

export type TabId = 'wizard' | 'picker' | 'generate' | 'docs';

export const TABS: { id: TabId; zh: string; en: string }[] = [
  { id: 'wizard', zh: '问卷选许可', en: 'Questionnaire' },
  { id: 'picker', zh: '选择与对比', en: 'Pick and compare' },
  { id: 'generate', zh: '生成产物', en: 'Generate' },
  { id: 'docs', zh: '关于', en: 'About' },
];

/** 文案里需要引用页签名时的查表 */
export const TAB_LABEL = Object.fromEntries(TABS.map((t) => [t.id, t])) as Record<
  TabId,
  { id: TabId; zh: string; en: string }
>;

/**
 * 项目自身的开源信息。
 *
 * 集中在这里是为了"单一来源"：关于页、页脚、以及以后要加的元信息都读它，
 * 换仓库或换署名时只改这一处，不会出现某处还写着旧地址的情况。
 */
export const PROJECT = {
  repo: 'https://github.com/youye-luna/license-forge',
  repoLabel: 'youye-luna/license-forge',
  releases: 'https://github.com/youye-luna/license-forge/releases',
  /**
   * 当前发行版号。**必须与 package.json 的 version 同步**——这两处漂移过一次，
   * 因此加了测试守着：`发行版版本号必须与 package.json 同步`。
   *
   * 约定（见 README「版本号与发行」）：**只在有大改动时才递增版本号**。
   * 小的修复与增补直接覆盖同一个 v0.1.0 发行版，不逐次抬号；
   * 等改动大到"用户需要判断该不该升级"时（数据源换了、产物结构变了、
   * 生成结果不再向后兼容），才递增并在发行说明里写清差异。
   */
  releasesLabel: 'v0.1.0',
  issues: 'https://github.com/youye-luna/license-forge/issues',
  /**
   * 项目自身的许可证标识符。
   *
   * 用 `GPL-3.0-or-later` 而不是 `GPL-3.0`：后者是 SPDX 的**废弃**写法，
   * 本工具自己就会把它归进「旧名字（已废弃）」。
   * 三者正文完全相同，区别只在源文件声明与清单字段里——也几乎不可逆。
   */
  license: 'GPL-3.0-or-later',
  licenseUrl: 'https://github.com/youye-luna/license-forge/blob/main/LICENSE',
  author: 'youye-luna',
  authorUrl: 'https://github.com/youye-luna',
  authorNick: '幽夜Luna',
  /** 本站的 LICENSE 就是用本工具自己生成的，版权行原样照抄，可逐字节核对 */
  ownCopyright: 'Copyright (C) 2026 youye-luna',
} as const;

/** 生态 → 包管理器清单文件 */
export const ECOSYSTEM_MANIFESTS: Record<string, { label: { zh: string; en: string }; manifests: string[] }> = {
  node: { label: { zh: 'Node / JS / TS', en: 'Node / JS / TS' }, manifests: ['package.json'] },
  rust: { label: { zh: 'Rust', en: 'Rust' }, manifests: ['Cargo.toml'] },
  python: { label: { zh: 'Python', en: 'Python' }, manifests: ['pyproject.toml', 'setup.cfg'] },
  java: { label: { zh: 'Java / Maven', en: 'Java / Maven' }, manifests: ['pom.xml'] },
  ruby: { label: { zh: 'Ruby', en: 'Ruby' }, manifests: ['Gemfile'] },
  other: { label: { zh: '其他', en: 'Other' }, manifests: [] },
};

/** 界面上的通用文案 */
export const T = {
  zh: {
    step: '第',
    of: '步，共',
    next: '下一步',
    prev: '上一步',
    restart: '重新回答',
    seeResults: '查看推荐结果',
    results: '推荐结果',
    reasons: '为什么推荐它',
    cautions: '必须知道的代价',
    useThis: '用这个许可证',
    editInputs: '填写版权信息',
    projectName: '项目名称',
    projectNameHint: 'GPL 家族的官方声明段里需要程序名，也会用在 NOTICE 与 README 里。',
    description: '一句话描述',
    descriptionHint: '可选。会填入 GPL 家族示例段的首行，例如 "myapp - a tiny CLI for X"。',
    holderName: '版权人',
    holderNameHint: '个人真实姓名或公司法定名称。写公司名时请注意：职务作品的著作权归属要看你的劳动合同与公司政策。',
    holderFrom: '起始年',
    holderTo: '结束年（留空表示至今）',
    addHolder: '添加版权人',
    removeHolder: '移除',
    style: '版权行写法',
    styleWord: 'Copyright (C) 2026 名称',
    styleParen: '(C) 2026 名称',
    styleSymbol: '© 2026 名称',
    styleHint: '三种写法在不同司法辖区的效力理解略有差异，但都会产生有效的版权声明。选一种并在全仓库保持一致最重要。',
    contactEmail: '联系邮箱',
    contactEmailHint: '可选。会写进 README 与 NOTICE，方便下游就许可问题联系你。',
    repoUrl: '仓库地址',
    language: '主体语言（决定源文件注释语法）',
    ecosystem: '项目生态（决定包管理器字段）',
    outputOptions: '产物选项',
    optNotice: '生成 NOTICE 文件',
    optFileHeader: '生成源文件声明头模板',
    optReadme: '生成 README 许可段落',
    optReuse: '生成 REUSE 风格布局（LICENSES/ 目录，文件名不带扩展名）',
    mandatoryLock: '该许可证强制要求，无法关闭',
    thirdParty: '第三方组件归属（每行一个）',
    thirdPartyHint: '若项目包含他人代码，逐行写出「组件名 — 版权人 — 许可证」，NOTICE 里会列成归属清单。',
    generate: '生成产物',
    downloadAll: '下载全部（ZIP）',
    copy: '复制',
    copied: '已复制',
    files: '生成的文件',
    why: '为什么需要它',
    mandatory: '必须',
    optional: '建议',
    notices: '生成前必须知道的几件事',
    checklist: '生成后仍需你做的事',
    source: '文本来源',
    chars: '字符',
    noHolderYet: '还没有填写版权人——带版权行占位符的许可证会因此报错。',
    family: '家族',
    gains: '你得到什么',
    tradeoffs: '你放弃什么',
    misuses: '常见误解',
    bestFor: '适合',
    avoidFor: '不适合',
    pickManually: '或直接按许可证浏览',
    filterAll: '全部',
    deprecatedWarn: '废弃标识符提醒',
    stats: '本站收录',
  },
  en: {
    step: 'Step',
    of: 'of',
    next: 'Next',
    prev: 'Back',
    restart: 'Start over',
    seeResults: 'See recommendations',
    results: 'Recommendations',
    reasons: 'Why it fits',
    cautions: 'What it costs you',
    useThis: 'Use this license',
    editInputs: 'Your copyright details',
    projectName: 'Project name',
    projectNameHint: 'Used in the GPL-family notice section, and in NOTICE and the README.',
    description: 'One-line description',
    descriptionHint: 'Optional. Fills the first line of the GPL-family example section, e.g. "myapp - a tiny CLI for X".',
    holderName: 'Copyright holder',
    holderNameHint: 'A real name or the company’s legal name. If you write a company name, check your employment contract and company policy first.',
    holderFrom: 'From',
    holderTo: 'To (blank = present)',
    addHolder: 'Add holder',
    removeHolder: 'Remove',
    style: 'Copyright line style',
    styleWord: 'Copyright (C) 2026 Name',
    styleParen: '(C) 2026 Name',
    styleSymbol: '© 2026 Name',
    styleHint: 'The three forms are understood slightly differently across jurisdictions but all produce a valid notice. Consistency across the repository matters most.',
    contactEmail: 'Contact email',
    contactEmailHint: 'Optional. Goes into the README and NOTICE so downstream users can reach you about licensing.',
    repoUrl: 'Repository URL',
    language: 'Primary language (sets the comment syntax)',
    ecosystem: 'Ecosystem (sets the manifest field)',
    outputOptions: 'Output options',
    optNotice: 'Generate a NOTICE file',
    optFileHeader: 'Generate a source file header template',
    optReadme: 'Generate a README license section',
    optReuse: 'Generate the REUSE layout (LICENSES/)',
    mandatoryLock: 'Required by this license; cannot be turned off',
    thirdParty: 'Third-party attribution (one per line)',
    thirdPartyHint: 'If you bundle other people’s code, list "component — holder — license" per line; NOTICE will include them.',
    generate: 'Generate',
    downloadAll: 'Download all (ZIP)',
    copy: 'Copy',
    copied: 'Copied',
    files: 'Generated files',
    why: 'Why you need it',
    mandatory: 'Required',
    optional: 'Recommended',
    notices: 'Read this before you use the output',
    checklist: 'What you still have to do',
    source: 'Text source',
    chars: 'characters',
    noHolderYet: 'No copyright holder yet — licenses with a copyright-line placeholder will report an error.',
    family: 'Family',
    gains: 'What you get',
    tradeoffs: 'What you give up',
    misuses: 'Common misunderstandings',
    bestFor: 'Good for',
    avoidFor: 'Avoid for',
    pickManually: 'Or browse by license',
    filterAll: 'All',
    deprecatedWarn: 'Deprecated identifier warning',
    stats: 'Included here',
  },
} as const;

export function t(lang: Lang) {
  return T[lang];
}

export { LICENSES, LICENSE_BY_ID };
