import { LICENSES, LICENSE_BY_ID } from './licenses.ts';
import type { Family, LicenseEntry, Lang } from './types.ts';

/**
 * 向导问答。
 *
 * 设计立场（与本项目的调研结论直接对应）：
 *  - 问卷不是"帮你快点选一个"，而是把**取舍**摊开：每个问题都对应一条真实的许可条款差异；
 *  - 结果不做成"唯一正确答案"，而是给出**候选集 + 每个候选的代价**，把决定权还给人；
 *  - 强制显式回答 GPL 的 only / or-later 问题——竞品普遍把它藏起来，这是真实事故来源。
 */

export type AnswerValue = string | string[] | boolean | null;

export interface Question {
  id: string;
  /** 问题文本 */
  title: { zh: string; en: string };
  /** 为什么问这个（讲清背后的条款差异） */
  why: { zh: string; en: string };
  options: {
    value: string;
    label: { zh: string; en: string };
    /**
     * 选项的补充说明。
     *
     * 用**数组**而不是单个字符串：需要解释的概念往往是并列的
     * （例如"背书"与"促销"是两种不同性质的行为），各占一行比挤成一句清楚，
     * 用户扫一眼就能分清是两件事。
     */
    note?: { zh: string[]; en: string[] };
  }[];
  multi?: boolean;
  /** 是否必答 */
  required?: boolean;
}

export const QUESTIONS: Question[] = [
  {
    id: 'kind',
    title: { zh: '你要授权的是什么？', en: 'What are you licensing?' },
    why: {
      zh: '软件、内容与硬件适用的许可证不同。Creative Commons 官方明确建议不要对软件使用 CC 许可；硬件设计本身不受著作权保护，需要专门的硬件许可。',
      en: 'Software, content and hardware need different licenses. Creative Commons advises against CC licenses for software, and hardware designs are not protected by copyright in the same way, so dedicated hardware licenses exist.',
    },
    options: [
      { value: 'software', label: { zh: '软件 / 代码', en: 'Software / code' } },
      { value: 'library', label: { zh: '供别人集成使用的库 / 框架', en: 'A library or framework others integrate' } },
      { value: 'content', label: { zh: '文档 / 图片 / 数据集 / 教程', en: 'Docs, images, datasets, tutorials' } },
      { value: 'fonts', label: { zh: '字体 / 字形设计', en: 'Fonts / typefaces' } },
      { value: 'hardware', label: { zh: '硬件设计 / CAD / 电路图', en: 'Hardware designs, CAD, schematics' } },
    ],
    required: true,
  },
  {
    id: 'closedSource',
    title: {
      zh: '你允许别人把你的作品做进闭源产品再分发吗？',
      en: 'May others ship your work inside closed-source products?',
    },
    why: {
      zh: '这是所有许可证里影响最大的一条分界线。允许就是宽松型（MIT / Apache / BSD），不允许就是著佐权（GPL / AGPL）。中文资料常把这一条包装成"是否商业友好"，那是误导——著佐权许可同样允许商用，限制的是闭源而非收费。',
      en: 'This is the single most consequential dividing line. Allowing it means a permissive license; forbidding it means copyleft. Chinese guides often frame this as "business friendliness", which misleads: copyleft licenses allow commercial use too — they restrict closing the source, not charging money.',
    },
    options: [
      { value: 'yes', label: { zh: '允许闭源再分发', en: 'Yes, closed-source redistribution is fine' } },
      { value: 'no', label: { zh: '不允许，衍生作品必须保持开源', en: 'No, derivatives must stay open' } },
      { value: 'unsure', label: { zh: '不确定，请把两种后果都告诉我', en: 'Not sure — show me both consequences' } },
    ],
    required: true,
  },
  {
    id: 'network',
    title: {
      zh: '如果有人把你的代码部署成在线服务（不发布软件本体），你要求他公开源码吗？',
      en: 'If someone runs your code as an online service without distributing it, must they publish their source?',
    },
    why: {
      zh: '只有 AGPL 系列覆盖这一场景。GPLv3 不要求——这正是大量中文对比表把 GPL-3.0 标成"适用于网络服务"的错误所在。反过来，AGPL 会让很多公司直接禁止引入你的依赖，采用成本明显更高。',
      en: 'Only the AGPL family covers this. The GPLv3 does not — which is exactly the mistake made by many comparison tables that label GPL-3.0 as network-triggered. Conversely, AGPL leads many companies to ban the dependency outright, so adoption costs more.',
    },
    options: [
      { value: 'yes', label: { zh: '要求，网络服务也算分发', en: 'Yes — running it as a service counts' } },
      { value: 'no', label: { zh: '不要求，我只关心软件分发', en: 'No — I only care about software distribution' } },
    ],
  },
  {
    id: 'patent',
    title: {
      zh: '专利对你重要吗？',
      en: 'Do patents matter for your project?',
    },
    why: {
      zh: 'MIT / BSD / ISC 对专利**一字未提**，是否隐含授权至今有争议；Apache-2.0、MPL-2.0、GPLv3 有明确授权与诉讼终止条款；BSD-3-Clause-Clear 则明确**不**授权。企业法务通常偏好有明确专利条款的许可，这也是同一份代码在企业里"能不能用"的分水岭。',
      en: 'MIT, BSD and ISC say nothing about patents, and whether a grant is implied is genuinely disputed. Apache-2.0, MPL-2.0 and GPLv3 grant patents explicitly with retaliation terms, while BSD-3-Clause-Clear explicitly does not. Corporate legal teams generally prefer an explicit clause, and it often decides whether a company can adopt your code at all.',
    },
    options: [
      { value: 'grant', label: { zh: '要明确授予使用者专利许可', en: 'Grant users an explicit patent license' } },
      { value: 'none', label: { zh: '明确不授予专利许可', en: 'Explicitly grant no patent rights' } },
      { value: 'na', label: { zh: '项目不涉及专利，不在意', en: 'No patents involved, do not care' } },
    ],
  },
  {
    id: 'attribution',
    title: {
      zh: '你要求使用者保留你的署名吗？',
      en: 'Must users keep your attribution?',
    },
    why: {
      zh: '放弃署名义务（MIT-0 / 0BSD / CC0）能让代码被最无摩擦地复制，代价是你的贡献可能永远不会被提及。反过来，署名之外还可以再要求一件事：不许拿你的名字去给他的产品做宣传——那对应 BSD-3-Clause 那一类许可。',
      en: 'Dropping the attribution requirement (MIT-0, 0BSD, CC0) makes reuse maximally frictionless, at the cost of your contribution possibly never being mentioned. Beyond attribution you may also forbid one more thing: using your name to promote their product — that is the BSD-3-Clause family.',
    },
    options: [
      { value: 'yes', label: { zh: '必须保留署名与版权声明', en: 'Yes, keep my notice' } },
      {
        value: 'notice-and-no-promotion',
        label: { zh: '保留署名，且不许用我的名义背书或促销', en: 'Keep my notice, and no endorsing or promoting with my name' },
        // 背书与促销是两件事，各占一行讲清楚——用户看到选项名时未必分得清，
        // 而这两条在许可条款里也常常分开写。
        note: {
          zh: [
            '背书：不能说"作者认可 / 推荐本产品"',
            '促销：不能在宣传里说"本产品基于作者的技术构建"',
          ],
          en: [
            'Endorsement: they may not say "the authors endorse or recommend this product"',
            'Promotion: they may not advertise it as "built on the authors’ work"',
          ],
        },
      },
      { value: 'no', label: { zh: '不需要，随便用', en: 'No, use it freely' } },
    ],
  },
  {
    id: 'audience',
    title: {
      zh: '你更希望这个项目被谁采用？',
      en: 'Who do you most want to adopt this?',
    },
    why: {
      zh: '这不是法律问题，但会实质影响选择：企业法务对 Apache-2.0 的接受度最高；AGPL 与 CDDL 常被企业政策直接禁止；BSD-3-Clause-Clear 在开源硬件与自由软件社区更受认可。',
      en: 'Not a legal question, but it changes the answer in practice: Apache-2.0 clears corporate review most easily, while AGPL and CDDL are often banned by company policy, and BSD-3-Clause-Clear is better received in free-software and open-hardware circles.',
    },
    options: [
      { value: 'enterprise', label: { zh: '企业 / 商业集成', en: 'Enterprises / commercial integration' } },
      { value: 'community', label: { zh: '自由软件与开源社区', en: 'Free software and open-source communities' } },
      { value: 'either', label: { zh: '都想，尽量广泛', en: 'Both — as widely as possible' } },
    ],
  },
  {
    id: 'ecosystem',
    title: {
      zh: '你的项目属于哪个生态？（影响包管理器字段与文件命名）',
      en: 'Which ecosystem is this? (affects manifest fields and file naming)',
    },
    why: {
      zh: '不同生态对 license 字段的写法要求不同：npm 与 Cargo 要 SPDX 标识符，Maven 不解析标识符需要名称 + URL。只给一句"用 MIT"是不够的，字段写错会导致下游工具识别失败。',
      en: 'Each ecosystem expects a different form: npm and Cargo want an SPDX identifier, while Maven does not parse identifiers and needs a name plus URL. "Use MIT" is not enough — a wrong field breaks downstream tooling.',
    },
    options: [
      { value: 'node', label: { zh: 'Node / JavaScript / TypeScript', en: 'Node / JavaScript / TypeScript' } },
      { value: 'rust', label: { zh: 'Rust', en: 'Rust' } },
      { value: 'python', label: { zh: 'Python', en: 'Python' } },
      { value: 'java', label: { zh: 'Java / Maven', en: 'Java / Maven' } },
      { value: 'ruby', label: { zh: 'Ruby', en: 'Ruby' } },
      { value: 'other', label: { zh: '其他 / 原生 / 多语言', en: 'Other / native / polyglot' } },
    ],
  },
  {
    id: 'gplVersion',
    title: {
      zh: '如果结果是 GPL 家族，你希望允许使用者改用更新版本吗？',
      en: 'If the result is a GPL-family license: may users move to a later version?',
    },
    why: {
      zh: '这是被所有主流工具藏起来、却真实造成事故的一个选择：GPL-3.0-only 与 GPL-3.0-or-later 的**许可证正文完全相同**，区别只在源文件声明与包管理器字段里，而且几乎不可逆。Linux 内核选 `-only`，多数 GNU 项目选 `-or-later`。',
      en: 'This choice is hidden by every mainstream tool yet causes real incidents: GPL-3.0-only and GPL-3.0-or-later have identical license text. The difference lives only in the source notice and manifest field, and it is practically irreversible. The Linux kernel chose `-only`; most GNU projects chose `-or-later`.',
    },
    options: [
      { value: 'or-later', label: { zh: '允许（推荐，官方与社区的主流做法）', en: 'Yes, allow later versions (recommended; the FSF and most communities do)' } },
      { value: 'only', label: { zh: '不允许，锁定当前版本', en: 'No, lock to this version' } },
    ],
  },
];

export interface Recommendation {
  license: LicenseEntry;
  /** 匹配分数，仅用于排序 */
  score: number;
  /** 命中的理由（逐条解释为什么推荐它） */
  reasons: { zh: string; en: string }[];
  /** 需要提醒的代价 */
  cautions: { zh: string; en: string }[];
}

export type Answers = Record<string, AnswerValue>;

/** 问卷结果 → 候选许可证排序 */
export function recommend(answers: Answers): Recommendation[] {
  const kind = (answers.kind as string) ?? 'software';
  const closed = (answers.closedSource as string) ?? 'unsure';
  const network = (answers.network as string) ?? 'no';
  const patent = (answers.patent as string) ?? 'na';
  const attribution = (answers.attribution as string) ?? 'yes';
  const audience = (answers.audience as string) ?? 'either';
  const gplVersion = (answers.gplVersion as string) ?? 'or-later';

  /* ---- 非软件分支 ---- */
  if (kind === 'content') {
    return rank(['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'MIT'], {
      'CC-BY-4.0': [
        [true, { zh: '内容与数据的默认选择：署名即可自由使用。', en: 'The default for content and data: free use with attribution.' }],
        // CC 4.0 的 §6 标题就叫 No endorsement，正文明确不许宣称"获得了授权方认可"
        [attribution === 'notice-and-no-promotion', { zh: 'CC 4.0 第 6 条正是「No endorsement」：不许宣称你获得了作者的认可或赞助，与你的要求一致。', en: 'CC 4.0 §6 is literally "No endorsement": nobody may claim your approval or sponsorship. That matches what you asked for.' }],
      ],
      'CC-BY-SA-4.0': [
        [closed === 'no', { zh: '你要求衍生作品保持开放，CC BY-SA 是内容层面的著佐权。', en: 'You want derivatives to stay open, and CC BY-SA is copyleft for content.' }],
        [attribution === 'notice-and-no-promotion', { zh: '同样带第 6 条的禁止背书条款，并且要求改编作品沿用同一许可。', en: 'It carries the same §6 no-endorsement clause and additionally requires adaptations to keep the same license.' }],
      ],
      'CC0-1.0': [
        [attribution === 'no', { zh: '你不在意署名，CC0 提供最彻底也最可执行的放弃权利方案（比 Unlicense 法律确定性更高）。', en: 'Attribution does not matter to you, and CC0 is both the most thorough and the most enforceable dedication — more predictable than the Unlicense.' }],
      ],
      MIT: [
        [false, { zh: '如果这其实是代码而不是内容，CC 许可是错误选择——Creative Commons 官方也这么建议。', en: 'If this is actually code rather than content, a CC license is the wrong tool — Creative Commons says so themselves.' }],
      ],
    });
  }
  if (kind === 'fonts') {
    // OFL 用 Reserved Font Name 同时满足两种诉求：改名的衍生字体可以闭源分发，
    // 沿用原名的必须继续用 OFL。所以它既覆盖"允许闭源"也覆盖"衍生保持开放"。
    const fontPool = closed === 'no' ? ['OFL-1.1'] : ['OFL-1.1', 'CC-BY-4.0'];
    return rank(fontPool, {
      'OFL-1.1': [
        [true, { zh: '字体专用许可，解决字体嵌入与再分发问题，同时用 Reserved Font Name 保护字形设计。', en: 'The font-specific license: it handles embedding and redistribution while protecting the typeface through a Reserved Font Name.' }],
        // 这条给 OFL 第二个命中，保证它在"允许闭源"时仍排在 CC-BY 之前。
        // 只靠"字体专用"一条命中时，CC-BY 会凭两条泛泛命中的理由反超，
        // 于是字体问题给出一个内容许可当首选——那是错的建议。
        [attribution !== 'no', { zh: '它强制保留作者署名与版权声明。', en: 'It mandates keeping the authors’ notice and copyright.' }],
        [closed === 'no', { zh: '沿用原名的衍生字体必须继续用 OFL，符合你"衍生作品保持开放"的要求。', en: 'Derivatives that keep the original name must stay under the OFL, which matches your requirement that derivatives stay open.' }],
        [attribution === 'notice-and-no-promotion', { zh: '第 4 条明确禁止拿作者名义为修改版促销或背书，与你的要求一致。', en: 'Clause 4 explicitly bans using the authors’ names to promote or endorse a modified version — exactly your requirement.' }],
      ],
      'CC-BY-4.0': [
        [true, { zh: '备选：如果你的产物不止字体（例如字体加配图说明），CC-BY 覆盖面更宽。', en: 'The alternative: if what you are licensing is more than the font itself — say a font plus documentation — CC-BY covers the wider work.' }],
        [false, { zh: '它是内容许可，没有 OFL 的保留字体名机制，字体嵌入与改名场景都不如 OFL 贴切。', en: 'It is a content license with no reserved-font-name mechanism, so it fits embedding and renaming less well than the OFL.' }],
      ],
    });
  }
  if (kind === 'hardware') {
    // 硬件许可也有宽松 / 弱互惠 / 强互惠三档。原来这里写的是两个候选，
    // 而且第一个 ID 重复了两次，被 rank 去重后实际只剩两条——等于完全忽略了
    // "能不能闭源"这个最重要的答案。
    const hwPool =
      closed === 'yes'
        ? ['CERN-OHL-P-2.0', 'Apache-2.0', 'CERN-OHL-W-2.0']
        : closed === 'no'
          ? ['CERN-OHL-S-2.0', 'CERN-OHL-W-2.0']
          : ['CERN-OHL-S-2.0', 'CERN-OHL-W-2.0', 'CERN-OHL-P-2.0'];
    return rank(hwPool, {
      'CERN-OHL-P-2.0': [
        [true, { zh: '宽松版硬件许可：修改者不必回馈，采用阻力最小。', en: 'The permissive hardware license: modifiers need not give anything back, the least friction.' }],
        [closed === 'yes', { zh: '你允许闭源，CERN-OHL-P 正是为此准备的。', en: 'You allow closed derivatives, which is exactly what CERN-OHL-P is for.' }],
      ],
      'CERN-OHL-W-2.0': [
        [true, { zh: '弱互惠版：只要求改过的那部分设计回馈，可以与其他设计组合。', en: 'Weakly reciprocal: only the parts you changed must be given back, and it combines with other designs.' }],
        [closed === 'unsure', { zh: '你不确定时它是折中：给出去的设计要回馈，你自己的部分不受影响。', en: 'A middle path when unsure: what you were given comes back, your own parts are unaffected.' }],
      ],
      'CERN-OHL-S-2.0': [
        [true, { zh: '强互惠版硬件许可：衍生设计整体要沿用同一许可，Codeberg 官方指南对硬件项目的首选。', en: 'The strongly reciprocal hardware license: derivative designs stay under it. Codeberg’s top pick for hardware.' }],
        [closed === 'no', { zh: '你要求衍生作品保持开放，它把这一点落实到设计文件本身。', en: 'You require derivatives to stay open, and it enforces that on the design files themselves.' }],
      ],
      'Apache-2.0': [
        [true, { zh: '如果项目里还有配套的固件或上位机软件，Apache-2.0 是硬件项目里最常见的软件侧选择。', en: 'If the project also ships firmware or host software, Apache-2.0 is the usual software-side choice in hardware projects.' }],
      ],
    });
  }

  /* ---- 软件分支 ---- */
  const pool: string[] = [];
  const reasons: Record<string, [boolean, { zh: string; en: string }][]> = {};

  if (closed === 'yes') {
    // 宽松型
    if (patent === 'grant') {
      pool.push('Apache-2.0', 'MPL-2.0', 'MIT');
      reasons['Apache-2.0'] = [
        [true, { zh: '宽松 + 明确专利授权：这正是企业法务最熟悉、最容易批准的组合。', en: 'Permissive with an explicit patent grant — the combination corporate legal approves most easily.' }],
        [audience === 'enterprise', { zh: '你希望被企业采用，Apache-2.0 的通过率最高。', en: 'You target enterprises, and Apache-2.0 clears review most often.' }],
        [attribution === 'yes', { zh: '你要求保留署名，Apache-2.0 会强制这一点（并且要求 NOTICE 文件）。', en: 'You require attribution, which Apache-2.0 enforces — including a NOTICE file.' }],
      ];
      reasons['MPL-2.0'] = [
        [kind === 'library', { zh: '这是库项目：MPL-2.0 是文件级著佐权，允许闭源产品链接使用，同时被改动的核心文件必须回馈。', en: 'It is a library: MPL-2.0 is file-level copyleft, so proprietary products may link it while modified core files must be given back.' }],
        [true, { zh: '含明确专利授权，且允许闭源的大作品使用你的代码。', en: 'Includes an explicit patent grant while allowing proprietary larger works.' }],
      ];
      reasons['MIT'] = [
        [audience === 'either', { zh: '如果想追求最广泛的采用，MIT 的生态认知度最高、集成阻力最小。', en: 'For maximum adoption, MIT is the most recognised and the least friction to integrate.' }],
        [attribution === 'yes', { zh: '你要求署名，MIT 会保留版权声明要求。', en: 'You want attribution, and MIT keeps the notice requirement.' }],
        [true, { zh: '注意：MIT 对专利条款只字未提，这一点需要在下面权衡。', en: 'Caveat: MIT says nothing about patents; weigh that in the trade-offs below.' }],
      ];
    } else if (patent === 'none') {
      pool.push('BSD-3-Clause-Clear', 'BSD-3-Clause', 'MIT');
      reasons['BSD-3-Clause-Clear'] = [
        [true, { zh: '你明确不想授予专利许可，BSD-3-Clause-Clear 把这一点写成白纸黑字，而不是靠"沉默"表达。', en: 'You want no patent grant, and BSD-3-Clause-Clear states that explicitly instead of relying on silence.' }],
      ];
      reasons['BSD-3-Clause'] = [
        [true, { zh: 'BSD-3-Clause 同样未授予专利，并额外禁止他人用你的名字为衍生品背书。', en: 'BSD-3-Clause also grants no patents and additionally blocks endorsement claims using your name.' }],
      ];
    } else {
      pool.push('MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC');
      reasons['MIT'] = [
        [true, { zh: '附加条件最少的宽松许可，采用率最高。', en: 'The permissive license with the fewest conditions and the widest adoption.' }],
        [attribution === 'yes', { zh: '你会保留署名要求。', en: 'It keeps your attribution requirement.' }],
      ];
      reasons['Apache-2.0'] = [
        [audience === 'enterprise', { zh: '面向企业采用时，明确的专利条款能显著降低法务阻力。', en: 'For enterprise adoption, the explicit patent clause substantially reduces legal friction.' }],
        [true, { zh: '代价是要维护 NOTICE 文件并标注文件改动。', en: 'The cost: maintaining a NOTICE file and marking changed files.' }],
      ];
      reasons['BSD-3-Clause'] = [
        [true, { zh: '与 MIT 接近，但额外禁止用你的名义为衍生品背书。', en: 'Close to MIT, but it also bans endorsement claims made in your name.' }],
      ];
      reasons['ISC'] = [[true, { zh: '与 MIT 法律效果接近，文本更短。', en: 'Legally close to MIT with shorter text.' }]];
    }
    if (attribution === 'no') {
      pool.unshift('MIT-0', '0BSD');
      reasons['MIT-0'] = [[true, { zh: '你不在意署名，MIT-0 直接去掉了署名义务，同时保持 MIT 的其余宽松条款。', en: 'You do not need attribution, and MIT-0 removes that requirement while keeping MIT’s permissiveness.' }]];
      reasons['0BSD'] = [[true, { zh: '零条款版本，条件比 MIT-0 还少，且被 OSI 认证。', en: 'A zero-condition variant, even lighter than MIT-0 and OSI-approved.' }]];
    }
    // 「保留署名，但不许用我的名义背书或促销」——这正是 BSD-3-Clause 相对 MIT
    // 多出来的那一条。把它提到最前，否则用户选了这一项后看到的候选与"必须保留署名"
    // 完全一样，等于这个选项没有作用。
    if (attribution === 'notice-and-no-promotion') {
      pool.unshift('BSD-3-Clause');
      reasons['BSD-3-Clause'] = [
        [true, { zh: '正是你要的组合：保留署名与版权声明，并额外禁止他人用你的名义为衍生品背书或促销。', en: 'Exactly what you asked for: attribution stays, and using your name to endorse or promote derivatives is forbidden.' }],
        [true, { zh: '注意它**没有**专利授权条款——如果专利对你重要，看下面 Apache-2.0 的取舍。', en: 'Caveat: it grants no patent rights. If patents matter, weigh that against Apache-2.0 below.' }],
      ];
      reasons['MIT'] = [
        [true, { zh: 'MIT 也要求保留署名，但**不禁**用你的名义宣传；差异就在这一条。', en: 'MIT also keeps the notice but does not ban promotion with your name — that is the whole difference.' }],
      ];
      reasons['Apache-2.0'] = [
        [true, { zh: '同样要求署名，且明确授予专利；但它不含禁止背书/促销条款，只禁止用你的商标。', en: 'Also requires attribution and adds an explicit patent grant, but it has no endorsement/promotion ban — only a trademark clause.' }],
      ];
    }
  } else if (closed === 'no') {
    const familyRoot = gplVersion === 'only' ? '-only' : '-or-later';
    if (network === 'yes') {
      pool.push(`AGPL-3.0${familyRoot}`, `GPL-3.0${familyRoot}`, `LGPL-3.0${familyRoot}`, 'EUPL-1.2');
      reasons[`AGPL-3.0${familyRoot}`] = [
        [true, { zh: '只有 AGPL 覆盖"部署为在线服务也要开源"这一场景。', en: 'Only the AGPL covers the case where running your code as a service still requires sharing source.' }],
      ];
      reasons[`GPL-3.0${familyRoot}`] = [
        [network !== 'yes', { zh: '如果你其实不介意网络服务闭源，GPL 的采用阻力比 AGPL 小得多。', en: 'If you do not actually mind closed services, the GPL is far easier to adopt than the AGPL.' }],
      ];
    } else if (kind === 'library') {
      pool.push(`LGPL-3.0${familyRoot}`, `GPL-3.0${familyRoot}`, 'MPL-2.0', 'EPL-2.0');
      reasons[`LGPL-3.0${familyRoot}`] = [
        [true, { zh: '库项目用 LGPL 是经典折中：闭源程序可以动态链接，但库本身的修改必须回馈。', en: 'For libraries, the LGPL is the classic compromise: proprietary programs may link dynamically while changes to the library come back.' }],
      ];
      reasons['MPL-2.0'] = [
        [true, { zh: '如果希望企业更容易采用，MPL-2.0 的文件级著佐权比 LGPL 更易通过法务。', en: 'If corporate adoption matters, MPL-2.0’s file-level copyleft clears review more easily than the LGPL.' }],
      ];
      reasons['EPL-2.0'] = [[audience === 'enterprise', { zh: 'Java 生态与企业插件体系的常见选择。', en: 'A common choice in the Java and enterprise-plugin world.' }]];
    } else {
      pool.push(`GPL-3.0${familyRoot}`, `AGPL-3.0${familyRoot}`, `GPL-2.0${familyRoot}`, 'EUPL-1.2');
      reasons[`GPL-3.0${familyRoot}`] = [
        [true, { zh: '强著佐权 + 明确专利授权 + 反 Tivoization，是希望代码永久开源时的主流选择。', en: 'Strong copyleft with an explicit patent grant and anti-Tivoization — the mainstream choice for code that must stay open.' }],
      ];
      reasons[`GPL-2.0${familyRoot}`] = [
        [true, { zh: '只有当你要与既有的 GPLv2-only 代码互操作时才需要选它；它没有专利条款，且与 Apache-2.0 不兼容。', en: 'Choose this only to interoperate with existing GPLv2-only code. It has no patent clause and is incompatible with Apache-2.0.' }],
      ];
      reasons['EUPL-1.2'] = [[audience === 'community', { zh: '若项目偏公共部门或需要多语言同等效力的正式文本，EUPL 有罕见的法律明确性。', en: 'For public-sector work or where multilingual authentic texts matter, the EUPL offers unusual legal clarity.' }]];
    }
    if (gplVersion === 'only') {
      for (const key of Object.keys(reasons)) {
        if (key.endsWith('-only')) {
          reasons[key].push([true, { zh: '你选择了锁定版本：这会放弃未来版本的兼容性收益，且几乎不可逆。', en: 'You chose to lock the version, which forfeits future-version compatibility and is practically irreversible.' }]);
        }
      }
    }
  } else {
    // 不确定：把两条路都摆出来
    pool.push('MIT', 'Apache-2.0', 'GPL-3.0-or-later', 'AGPL-3.0-or-later', 'MPL-2.0');
    reasons['MIT'] = [[true, { zh: '宽松路线的起点：最大采用度，但无法阻止闭源。', en: 'The permissive starting point: maximum adoption, no protection against closed forks.' }]];
    reasons['Apache-2.0'] = [[true, { zh: '宽松路线里对企业和专利最友好的一个。', en: 'The most enterprise- and patent-friendly permissive option.' }]];
    reasons['GPL-3.0-or-later'] = [[true, { zh: '著佐权路线的主流选择：衍生作品必须开源。', en: 'The mainstream copyleft route: derivatives must stay open.' }]];
    reasons['AGPL-3.0-or-later'] = [[true, { zh: '著佐权的加强版：连网络服务也要开源，代价是企业采用阻力大。', en: 'Copyleft plus network use, at the cost of significant corporate friction.' }]];
    reasons['MPL-2.0'] = [[true, { zh: '中间路线：只要求被改动的文件保持开源。', en: 'The middle path: only modified files must stay open.' }]];
  }

  return rank(pool, reasons);
}

/**
 * 把候选池排成带理由的推荐列表。
 *
 * 打分：`命中数 × 10 − 池内位置`。
 *
 * ⚠️ 落空项**刻意不扣分**，这一点容易改错：
 * `[条件, 理由]` 里的条件为假，绝大多数情况只是"这条理由不适用于你的回答"
 * （例如 `[closed === 'no', '衍生作品必须保持开放']` 对"允许闭源"的人不适用），
 * 那**不是冲突**。曾经给落空项扣过 60 分，结果是 OFL-1.1 在"字体 + 允许闭源"
 * 下被扣成负分，排到了 CC-BY-4.0 后面——把领域内唯一的专用许可挤掉了。
 * 真正表示"这份许可不适合你"的用法只有一处（内容分支里的 MIT），
 * 那种情况靠"零命中 + 落空"自然排到最后，并配一句如实的理由（见下）。
 */
function rank(
  ids: string[],
  reasons: Record<string, [boolean, { zh: string; en: string }][]>,
): Recommendation[] {
  const seen = new Set<string>();
  const out: Recommendation[] = [];
  ids.forEach((id, index) => {
    const entry = LICENSE_BY_ID[id];
    // 不在人工整理集合里的 ID 会被静默丢弃。写候选池时务必确认 ID 存在，
    // 否则用户看不到任何提示，只觉得"候选莫名其妙少了一个"。
    if (!entry || seen.has(id)) return;
    seen.add(id);
    const raw = reasons[id] ?? [];
    const hits = raw.filter(([ok]) => ok).map(([, r]) => r);
    const misses = raw.filter(([ok]) => !ok).map(([, r]) => r);
    out.push({
      license: entry,
      score: hits.length * 10 - index,
      reasons: hits.length
        ? hits
        : misses.length
          ? // 一条都没命中却有落空项：别说"没有冲突"，如实讲它为什么在这儿
            [{ zh: '它不是为你这些回答准备的，列在这里是让你看到差别。', en: 'Not built for the answers you gave — it is listed so you can see the contrast.' }]
          : [{ zh: '与你刚才的回答没有直接冲突。', en: 'No direct conflict with your answers.' }],
      cautions: [
        ...misses,
        { zh: entry.tradeoffs.zh, en: entry.tradeoffs.en },
      ],
    });
  });
  return out.sort((a, b) => b.score - a.score);
}

/** 依问卷结果给出"必答但你没答"的问题 */
export function missingRequired(answers: Answers): Question[] {
  return QUESTIONS.filter((q) => q.required && (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === ''));
}

/** 把问答结果浓缩成一句可读摘要（便于分享与复查） */
export function summarizeAnswers(answers: Answers, lang: Lang): string {
  return QUESTIONS.filter((q) => answers[q.id])
    .map((q) => {
      const v = answers[q.id];
      const opt = q.options.find((o) => o.value === v);
      return `${q.title[lang]} → ${opt ? opt.label[lang] : String(v)}`;
    })
    .join('\n');
}

export const FAMILY_ORDER: Family[] = [
  'permissive',
  'weak-copyleft',
  'strong-copyleft',
  'network-copyleft',
  'public-domain',
  'content',
];

/** 用于界面上的"全量浏览" */
export function byFamily(): Record<Family, LicenseEntry[]> {
  const out = {} as Record<Family, LicenseEntry[]>;
  for (const f of FAMILY_ORDER) out[f] = LICENSES.filter((l) => l.family === f);
  return out;
}
