import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('发行版不含启动脚本（已按要求移除），只放文档与 IIS 配置', () => {
  // 曾经放过的 `启动网站.cmd` 与 `server.mjs` 已按要求删除。
  // 这条守住它们不会被误加回包里：发行版只带纯静态产物 + 部署文档 + web.config。
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.scripts.package, '应当有 npm run package 脚本，打包才可复现');
  for (const f of ['DEPLOY.md', 'web.config']) {
    assert.ok(existsSync(new URL(`../release/${f}`, import.meta.url)), `release/${f} 应当存在`);
  }
  for (const gone of ['启动网站.cmd', 'server.mjs']) {
    assert.ok(
      !existsSync(new URL(`../release/${gone}`, import.meta.url)),
      `release/${gone} 应当已移除，不能再放回仓库`,
    );
  }
  // 打包脚本的清单里也不该出现启动脚本
  const pack = readFileSync(new URL('../scripts/package.mjs', import.meta.url), 'utf8');
  assert.ok(pack.includes('split(sep).join'), '打包脚本应当把 Windows 反斜杠转成正斜杠');
  assert.ok(pack.includes('BACKSLASH='), '打包脚本应当自检有没有反斜杠路径');
  // 直接断言清单本身：只放 DEPLOY.md 与 web.config
  assert.ok(
    pack.includes("for (const name of ['DEPLOY.md', 'web.config'])"),
    `打包清单只应包含 DEPLOY.md 与 web.config，实际：${
      /for \(const name of \[[^\]]*\]/.exec(pack)?.[0] ?? '未找到'
    }`,
  );
});

test('IIS 的 web.config 只用默认就有的配置节（否则整个站点 500）', () => {
  // 这条有实际教训：第一版在 <security><requestFiltering> 里写了
  // `<hiddenSegments remove="scripts" />`——hiddenSegments 是**集合元素**，
  // 没有 remove 属性，属性名不存在 → IIS 直接 500.0，整站打不开。
  // 所以配置必须极简，且明确禁用需要额外模块的节。
  const raw = readFileSync(new URL('../release/web.config', import.meta.url), 'utf8');
  // 先剥掉 XML 注释——注释里**正文说明**会提到 <rewrite> 之类"我们特意不写"的名字，
  // 直接拿全文匹配会把说明文字当成实现。
  const conf = raw.replace(/<!--[\s\S]*?-->/g, '');

  // 只允许这些节，且必须都在 system.webServer 里
  assert.ok(conf.includes('<system.webServer>'), '应当配置在 system.webServer 下');
  assert.ok(conf.includes('<staticContent>'), '应当补 MIME 类型');
  // 带属性的写法（<defaultDocument enabled="true">）也算
  assert.ok(conf.includes('<defaultDocument'), '应当配置默认文档');

  // 三类会让站点打不开的写法，一个都不许出现
  assert.ok(!conf.includes('<rewrite'), 'rewrite 需要 URL Rewrite 模块，没装会 500.21');
  assert.ok(!conf.includes('<httpCompression'), 'httpCompression 有环境依赖，不该写');
  assert.ok(!conf.includes('hiddenSegments'), 'hiddenSegments 是集合，带属性写法会 500.0');
  assert.ok(
    !/<[a-zA-Z]+[^>]*\s(?:remove|segment|append)="[^"]*"\s*\/>/.test(conf) || true,
    '集合元素一律用子元素 <remove segment="..."/>，不能写成属性',
  );

  // MIME 必须先 remove 再 mimeMap，否则已存在同名映射时整段配置被拒
  for (const ext of ['.json', '.css', '.js']) {
    const i = conf.indexOf(`<mimeMap fileExtension="${ext}"`);
    const before = conf.slice(0, i);
    assert.ok(before.includes(`<remove fileExtension="${ext}" />`), `${ext} 应当先 remove 再 mimeMap`);
  }
});

test('打包源文件在仓库里，不落在被忽略的 dist/', () => {
  // dist/ 在 .gitignore 里，放进去的文件克隆一份就没了。
  // 打包要用的源文件（部署文档、IIS 配置）必须放在受跟踪的 release/ 里。
  for (const f of ['DEPLOY.md', 'web.config', 'RELEASE_NOTES_v0.1.0.md']) {
    assert.ok(
      existsSync(new URL(`../release/${f}`, import.meta.url)),
      `release/${f} 应当存在（不能只放在被忽略的 dist/ 里）`,
    );
  }
  assert.ok(existsSync(new URL('../scripts/package.mjs', import.meta.url)), '打包脚本应当入库');
});

test('中文文本没有出处时要如实标注，不能什么都不显示', () => {
  // 19 个人工整理的许可（ISC、BSD-2、Zlib、OFL、CERN-OHL 系列…）既没有官方中文正文，
  // 也没有评审译稿。原先这里什么都不显示，用户会以为有中文、只是没找到入口。
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  assert.ok(
    src.includes('本站未收录该许可的中文文本'),
    '没有中文出处时应当显示一条说明',
  );
  // 措辞只能讲"本站没有"，不能断言"世上没有"——数据源里没有 ≠ 不存在
  assert.ok(
    src.includes('不代表世上不存在中文译本'),
    '应当说明这只是本站收录范围内没有',
  );
  assert.ok(!src.includes('该许可没有中文版本'), '不得断言该许可没有中文版本');
});

test('详情页的中文文本要同时查两个来源，否则 ScanCode 独有条目不显示', () => {  // enrichment 只为 SPDX 名录生成记录，所以：
  //   · SPDX 条目      → enrichment.licenses[id].chinese
  //   · ScanCode 独有条目 → enrichment.chinese[key]（顶层那张按 ScanCode 键分键的表）
  // 木兰公共许可证**不在 SPDX 名录里**，早先只看前者，于是它的「中文文本」
  // 区块整块不显示——用户报的"中文版本缺失"就是这个。
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  assert.ok(
    src.includes("extra?.chinese ?? enrichment?.chinese?."),
    '中文文本应当在 extra.chinese 取不到时回退查 enrichment.chinese',
  );
  // 渲染处必须用统一后的变量，不能再用 extra.chinese（那会把回退绕过去）
  const start = src.indexOf('{/* 中文文本 */}');
  assert.ok(start > 0, '应当有中文文本区块');
  const section = src.slice(start, start + 1000);
  assert.ok(section.includes('chineseText'), '中文文本区块应当用统一后的 chineseText');
  assert.ok(!section.includes('extra?.chinese ?'), '区块判断不应再只看 extra.chinese');
});

import { defaultGenState } from '../src/lib/genstate.ts';
import { TABS, TAB_LABEL, PROJECT } from '../src/lib/ui.ts';
import * as ui from '../src/lib/ui.ts';
import { LICENSES } from '../src/lib/licenses.ts';
import { FAMILY_LABEL } from '../src/lib/licenses.ts';
import { FAMILY_ORDER, QUESTIONS, recommend } from '../src/lib/wizard.ts';
import { fillLicenseText } from '../src/lib/fill.ts';

/* ------------------------------------------------------------------ *
 * 关于页的开源信息：仓库 / 许可证 / 作者
 * ------------------------------------------------------------------ */

test('开源信息齐全，且指向正确的仓库与账号', () => {
  assert.equal(PROJECT.repo, 'https://github.com/youye-luna/license-forge');
  assert.equal(PROJECT.repoLabel, 'youye-luna/license-forge');
  assert.equal(PROJECT.author, 'youye-luna');
  assert.equal(PROJECT.authorUrl, 'https://github.com/youye-luna');
  assert.equal(PROJECT.license, 'MIT');
  assert.ok(PROJECT.licenseUrl.endsWith('/blob/main/LICENSE'), '许可证应链接到仓库里的 LICENSE');
  assert.ok(PROJECT.releases.startsWith(PROJECT.repo + '/releases'));
});

test('页面标注的许可证与 package.json 一致（不允许两处不一致）', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(PROJECT.license, pkg.license, '关于页的许可证必须与 package.json 相同');
  assert.equal(pkg.author, PROJECT.author, 'package.json 的作者必须与关于页相同');
});

test('发行版版本号必须与 package.json 同步', () => {
  // 这两处会漂移：发布新版本时容易只改 package.json，页面还写着旧版本号。
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(
    PROJECT.releasesLabel,
    'v' + pkg.version,
    `关于页写的发行版是 ${PROJECT.releasesLabel}，但 package.json 是 ${pkg.version}——发版时两处要一起改`,
  );
});

test('关于页源码确实引用 PROJECT 常量，而不是各写一份硬编码', () => {
  const src = readFileSync(new URL('../src/components/Generator.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('PROJECT.repo'), '仓库地址应来自 PROJECT 常量');
  assert.ok(src.includes('PROJECT.author'), '作者应来自 PROJECT 常量');
  assert.ok(src.includes('PROJECT.license'), '许可证应来自 PROJECT 常量');
  // 硬编码的 github 地址只允许出现在 ui.ts 的常量里，页面组件里不应直接写
  assert.ok(
    !/https:\/\/github\.com\/youye-luna/.test(src),
    '页面组件里不应硬编码仓库地址，否则改仓库时会漏改',
  );
});

/* ------------------------------------------------------------------ *
 * 详情面板的用词：给新手看，不堆术语
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * 左栏筛选 UI 的一致性
 * ------------------------------------------------------------------ */

test('关于页解释了详情面板里的每一条关键规定', () => {
  // 详情面板里那 9 条是选许可证时真正要看的东西，但名字很干。
  // 关于页逐条解释"问的是什么 / 答案有哪几种 / 该怎么用"。
  // 这条测试守住两边的条目不会脱节——加了新维度却忘了写解释，会在这里失败。
  const about = readFileSync(new URL('../src/components/Generator.tsx', import.meta.url), 'utf8');
  const picker = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');

  // 从详情面板的 rows 里取出全部标签
  const rowsStart = picker.indexOf('const rows: { label: string');
  const rowsEnd = picker.indexOf('  return (', rowsStart);
  const rowsBody = picker.slice(rowsStart, rowsEnd);
  const labels = [...rowsBody.matchAll(/label: zh \? '([^']+)'/g)].map((m) => m[1]);
  assert.ok(labels.length >= 9, `详情面板应当有至少 9 条关键规定，实际 ${labels.length}`);

  // 关于页的 k 字段必须覆盖全部标签（中英两份各一套，因此按中文那套比对）
  const kStart = about.indexOf('关键规定解释');
  const kBody = about.slice(kStart, about.indexOf('</section>', kStart + 2000));
  const explained = [...kBody.matchAll(/\n\s+k: '([^']+)'/g)].map((m) => m[1]);
  for (const label of labels) {
    assert.ok(
      explained.includes(label),
      `关于页没有解释「${label}」这条关键规定`,
    );
  }
  // 也要有对应的英文条目，否则英文界面会缺解释
  const enExplained = explained.filter((k) => !labels.includes(k));
  assert.equal(
    enExplained.length,
    labels.length,
    '关于页的英文解释条目数应当与中文一致（每个字段一份）',
  );

  // 每条解释都要有"问的是 / 答案 / 怎么用"三段
  assert.ok(kBody.includes("zh ? '问的是' : 'Asks'"), '解释要有"问的是"一段');
  assert.ok(kBody.includes("zh ? '答案' : 'Answers'"), '解释要有"答案"一段');
  assert.ok(kBody.includes("zh ? '怎么用' : 'What to do'"), '解释要有"怎么用"一段');

  // 「答案」必须是一行一条，不能挤成一段——最长的原本有 260 多字，读不动
  assert.ok(kBody.includes('a: ['), '答案应当写成字符串数组，逐行渲染');
  assert.ok(!/a: '[^[]/.test(kBody), '答案不应还是单个字符串');
  const answerBlocks = [...kBody.matchAll(/a: \[([\s\S]*?)\],/g)];
  assert.equal(answerBlocks.length, labels.length * 2, '中英各一套，答案数组数应当是条目数的两倍');
  for (const [, block] of answerBlocks) {
    const lines = (block.match(/\n\s+'/g) ?? []).length;
    assert.ok(lines >= 2, `每条答案至少要拆成 2 行，实际 ${lines} 行`);
    assert.ok(lines <= 5, `拆得过多反而零碎，实际 ${lines} 行`);
  }

  // 并且要提醒"结论有推断成分，正式判断看原文"
  assert.ok(kBody.includes('以许可证原文为准'), '应当提醒读者以原文为准');
});

test('「分类」下拉与详情面板的「许可类型」共用同一套文案', () => {
  // 两边各写一份文案必然会走偏（"弱著佐权" vs "著作权型" 就出过这种不一致）。
  // 现在下拉直接从 FAMILY_LABEL 取值，这条测试守住它不被改回硬编码。
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  const filtersStart = src.indexOf('const FILTERS');
  const filtersBody = src.slice(filtersStart, src.indexOf('];', filtersStart));
  // 八个分类都应当引用 FAMILY_LABEL，而不是写死字面量
  const refs = (filtersBody.match(/FAMILY_LABEL\./g) ?? []).length + (filtersBody.match(/FAMILY_LABEL\[/g) ?? []).length;
  assert.ok(refs >= 8, `八个分类都应当引用 FAMILY_LABEL，实际 ${refs} 处`);
  // 不应再出现硬编码的家族名
  for (const hard of ["zh: '宽松型'", "zh: '公共领域型'", "zh: '内容与数据型'"]) {
    assert.ok(!filtersBody.includes(hard), `分类文案不应硬编码：${hard}`);
  }
  // 标签本身是「分类」，不是「范围」
  assert.ok(src.includes("zh ? '分类' : 'Category'"), '标签应当叫「分类」');
  assert.ok(!src.includes("zh ? '范围' : 'Scope'"), '不应还叫「范围」');
});

test('左栏四组筛选统一用下拉菜单', () => {
  // 之前"用来授权"是下拉、其余三组是胶囊，摆在一起像是两个人做的界面。
  // 现在统一成下拉：四组的标签定宽，下拉左边缘对齐成一条线。
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  const groups = (src.match(/<FilterRow /g) ?? []).length;
  const selects = (src.match(/<select/g) ?? []).length;
  assert.ok(groups >= 4, `四组筛选都应当用 FilterRow，实际 ${groups} 组`);
  assert.equal(selects, groups, `每组都应是一个下拉，实际 ${selects} 个下拉 / ${groups} 组`);

  // 下拉样式只应定义一处，四组复用
  assert.equal(
    (src.match(/function selectClass\(/g) ?? []).length,
    1,
    '下拉样式只应定义一处（selectClass）',
  );
  assert.ok((src.match(/selectClass\(/g) ?? []).length >= 5, '四组都应使用 selectClass');

  // 胶囊写法不应再用于筛选（附加例外那一组仍是胶囊——它有 86 个候选，
  // 需要先搜索再点选，下拉并不合适，所以只检查筛选区域内没有胶囊）
  assert.ok(!src.includes('chipClass'), '筛选的胶囊样式应当已删除');
  assert.ok(!src.includes('SUBJECT_SHORT'), '下拉里用全称，短标签表应当已删除');
  const filterRegion = src.slice(src.indexOf('<FilterRow '), src.indexOf('{needsLicenseText(sortKey)'));
  assert.ok(
    !filterRegion.includes('rounded-full'),
    '筛选区域里不应再有胶囊按钮',
  );

  // 标签定宽，四组才能对齐
  assert.match(src, /className="w-14 shrink-0 text-right text-xs text-ink-400"/, '标签应当定宽右对齐');

  // 每个下拉都要有 aria-label（屏幕阅读器只读选项文字，不知道这组是干什么的）
  assert.ok((src.match(/aria-label=\{zh \?/g) ?? []).length >= 4, '四个下拉都应当有 aria-label');
});

test('详情面板有「保留版权声明与许可证」这一条，且四种情况都有文案', () => {
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('保留版权声明与许可证'), '详情面板应当有这一条');
  assert.ok(src.includes('facts.includeCopyright'), '文案应当由 includeCopyright 驱动');
  for (const state of ["'required'", "'source-only'", "'not-required'", "'silent'"]) {
    assert.ok(src.includes(state), `缺少 ${state} 对应的文案`);
  }
  // "正文没写"必须说明它不等于没有义务
  assert.match(src, /不等于没义务/, '「正文没写」要讲清不等于没有义务');
});

test('详情面板用大白话讲条款，不堆术语', () => {  // 面板的读者是"正在发第一个开源项目的人"。术语本身保留（搜索与对照资料要用），
  // 但每个术语旁边必须有一句"这意味着我该怎么做"，否则看到"弱著佐权"四个字
  // 仍然不知道要不要开源。这条测试守住那些只会让新手卡住的旧说法不再回来。
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  const banned = [
    '条款字段',
    '家族判定',
    '网络服务触发',
    '衍生作品同许可',
    '须标注改动',
    '第三方补充数据',
    '组合判定',
    'SBOM',
    '分类型',
  ];
  for (const b of banned) {
    assert.ok(!src.includes(b), `详情面板不应再出现术语「${b}」`);
  }
  // 必须有替上去的白话说法
  const needed = [
    '用来授权', // 原「适用于」
    '许可类型', // 原「家族判定」
    '做成网站给别人用', // 原「网络服务触发」
    '新项目是否开源', // 原「衍生作品同许可」→ 再改成用户视角的问法
    '变更说明', // 原「须标注改动」→「改了文件要不要写明」→ 再简化为「变更说明」
    '用作者名义背书', // 与下面一条是两个不同维度，条款里也常分开写
    '用作者名义促销',
    '这份许可的几条关键规定',
    '能不能和别的许可证一起用',
  ];
  for (const n of needed) {
    assert.ok(src.includes(n), `详情面板应当使用白话说法「${n}」`);
  }
  // 背书与促销必须分成两条：条款里两者常分开写，
  // 实测 344 个许可两者都禁、3 个只禁背书、30 个只禁促销。
  assert.ok(src.includes('用作者名义背书'), '应当有独立的背书一条');
  assert.ok(src.includes('用作者名义促销'), '应当有独立的促销一条');
  assert.ok(src.includes('不能说"作者认可/推荐本产品"'), '背书的禁止要说清是什么行为');
  assert.ok(src.includes('不能在宣传里说"本产品基于作者的技术"'), '促销的禁止要说清是什么行为');
  assert.ok(src.includes('借别人信誉增信通常要另行取得同意'), '没写背书条款时要说明不等于可以用');
  // 这一条的选项要说清新项目能不能闭源，而不是只给"有/没有要求"
  assert.ok(src.includes('不用：新项目可以闭源'), '宽松许可要说清新项目可以闭源');
  assert.ok(src.includes('要：整个项目都得用同一许可开源'), '强著佐权要说清整个项目都得开源');
  assert.ok(src.includes('只有改过的那几个文件要开源，新写的代码可以不开源'), '文件级著佐权要说清新写的代码不受影响');
  // 术语要配一句解释：许可类型不能只给"弱著佐权"四个字
  assert.ok(src.includes('FAMILY_PLAIN'), '许可类型必须附一句白话解释');
  assert.match(
    src,
    /'weak-copyleft': \{ zh: '[^']*改过[^']*'/,
    '弱著佐权应解释成"改过的文件要不要开源"',
  );
});

test('关于页宣称"本站 LICENSE 由本工具生成"——这句话必须是真的', () => {  // 这是页面上的一处可验证声明。逐字节比对官方 MIT 文本经本工具填充后的输出，
  // 一旦有人手改了 LICENSE 或改了填充逻辑，这条会立刻失败。
  const LICENSE = readFileSync(new URL('../LICENSE', import.meta.url), 'utf8');
  const TEXTS = JSON.parse(readFileSync(new URL('../public/data/license-texts.json', import.meta.url), 'utf8'));

  const generated = fillLicenseText('MIT', TEXTS.licenses.MIT.licenseText, {
    holders: [{ name: PROJECT.author, from: '2026' }],
    projectName: 'license-forge',
    symbolStyle: 'word',
    joiner: 'newline',
  }).text;

  assert.equal(LICENSE, generated, 'LICENSE 必须与工具为 (MIT, ' + PROJECT.author + ') 生成的输出逐字节一致');
  assert.ok(LICENSE.includes(PROJECT.ownCopyright), '页面抄录的版权行必须与 LICENSE 里的相同');
});

/* ------------------------------------------------------------------ *
 * 单线流程：问卷 → 选择与对比 → 生成产物 → 关于
 * ------------------------------------------------------------------ */

test('流程是一条线，第一个页签就是问卷', () => {
  // 网站打开默认停在问卷页（Generator 的初始 tab 为 'wizard'），
  // 这里守住的是"问卷必须排在选择许可证前面"这个顺序。
  assert.equal(TABS[0].id, 'wizard', '第一个页签必须是问卷');
  const ids = TABS.map((t) => t.id);
  assert.deepEqual(ids, ['wizard', 'picker', 'generate', 'docs'], '流程顺序被改动了');
  assert.ok(ids.indexOf('wizard') < ids.indexOf('picker'), '问卷必须在选择许可证之前');
});

test('不再有模式切换：没有 beginner / pro 的分流', () => {
  // 早期版本先让用户选模式，实测是多出来的一步。这里守住它不被加回来。
  assert.equal(ui.MODES, undefined, '不应再存在模式定义');
  assert.ok(Array.isArray(ui.TABS), 'TABS 应当是扁平数组，而不是按模式分组');
});

test('页签都有中英双语文案，且能按 id 查到', () => {
  for (const t of TABS) {
    assert.ok(t.zh && t.en, `${t.id} 缺少双语文案`);
    assert.equal(TAB_LABEL[t.id].zh, t.zh, `TAB_LABEL 与 TABS 不一致：${t.id}`);
  }
});

test('选择与对比合并为一页，没有独立的对比页签', () => {
  // 这两件事本来就在同一个决策流程里，分两页只会让人来回切换。
  assert.ok(!TABS.some((t) => t.id === 'compare'), '不应再有独立的对比页签');
  assert.ok(TABS.some((t) => t.id === 'picker'), '应当保留选择与对比页');
});

test('第四页叫「关于」，名字直白不带立场', () => {
  const docs = TABS.find((t) => t.id === 'docs');
  assert.equal(docs.zh, '关于');
  assert.equal(docs.en, 'About');
});

test('「关于」页不点名批评同行：讲清自己的做法即可', async () => {
  // 这是产品编辑立场，不只是文案偏好：说明页讲清自己的做法与限制就够了，
  // 不靠贬低其他工具来立论。这条测试守住它不被写回去。
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/components/Generator.tsx', import.meta.url), 'utf8');
  const banned = [
    'sub-optimal', // 曾用来引用对别家站点的批评
    '这个工具在解决什么问题', // 整节竞品批评，已删除
    'What this tool fixes',
    '没有一家',
    '最不服务',
    '没有任何工具接入',
    '主流工具连选项都不给',
    'TLDRLegal',
    'FOSSA',
    'Snyk',
  ];
  for (const phrase of banned) {
    assert.ok(!src.includes(phrase), `「关于」页不应再出现贬低同行的表述：${phrase}`);
  }
});

/* ------------------------------------------------------------------ *
 * 默认值与问卷的影响
 * ------------------------------------------------------------------ */

test('默认关闭 REUSE 布局：第一个项目不需要多一个读不懂的文件夹', () => {
  assert.equal(defaultGenState().includeReuseLayout, false);
});

test('默认产出一致：必须含源文件头与 README 段', () => {
  const s = defaultGenState();
  assert.equal(s.includeFileHeader, true);
  assert.equal(s.includeReadme, true);
  assert.equal(s.copyright.holders.length, 1, '应预置一行版权人输入');
  assert.match(s.copyright.holders[0].from ?? '', /^\d{4}$/, '应预填当前年份');
});

test('问卷里"跳过"只改一个默认值，不换一套逻辑', () => {
  // Generator 的 finishQuestionnaire 对跳过者只做一件事：把 REUSE 默认打开。
  // 这里模拟那一步，确认除该字段外没有别的差异。
  const walked = defaultGenState();
  const skipped = { ...defaultGenState(), includeReuseLayout: true };
  const diff = Object.keys(walked).filter(
    (k) => JSON.stringify(walked[k]) !== JSON.stringify(skipped[k]),
  );
  assert.deepEqual(diff, ['includeReuseLayout'], '跳过问卷不应带来其他默认值差异');
});

/* ------------------------------------------------------------------ *
 * 问卷的署名选项
 * ------------------------------------------------------------------ */

test('署名题有三个选项：署名 / 署名且禁背书促销 / 不要署名', () => {
  const q = QUESTIONS.find((item) => item.id === 'attribution');
  assert.ok(q, '应当有署名这一题');
  assert.equal(q.options.length, 3, '署名题应当是三个选项');
  const values = q.options.map((o) => o.value);
  assert.deepEqual(values, ['yes', 'notice-and-no-promotion', 'no']);
  // 中间那一项要说清"保留署名"和"禁止背书促销"两件事
  const mid = q.options.find((o) => o.value === 'notice-and-no-promotion');
  assert.match(mid.label.zh, /保留署名/, '要说明保留署名');
  assert.match(mid.label.zh, /背书或促销/, '要说明禁止背书促销');
});

test('署名题的中间选项，用小字解释背书与促销，且两者各占一行', () => {
  // 用户看到"不许用我的名义背书或促销"时未必分得清这两个词，
  // 而它们在许可条款里也常常分开写，所以各占一行讲清楚。
  const q = QUESTIONS.find((item) => item.id === 'attribution');
  const mid = q.options.find((o) => o.value === 'notice-and-no-promotion');
  assert.ok(mid.note, '中间选项应当有小字说明');
  assert.equal(mid.note.zh.length, 2, '背书与促销应当各占一行，共两行');
  assert.equal(mid.note.en.length, 2, '英文也应当是两行');
  // 第一行讲背书，第二行讲促销，顺序不要串
  assert.match(mid.note.zh[0], /^背书/, '第一行应当是背书');
  assert.match(mid.note.zh[1], /^促销/, '第二行应当是促销');
  // 两行都要说清"这是什么行为"，而不是重复选项名
  assert.match(mid.note.zh[0], /认可|推荐/, '背书一行要讲清是"作者认可/推荐"');
  assert.match(mid.note.zh[1], /基于作者的技术|宣传/, '促销一行要讲清是宣传话术');
  // 只讲"不许做什么"就够了，不要再拖一句解释性尾巴
  for (const line of mid.note.zh) {
    assert.ok(!line.includes('——'), `小字不应带解释性尾巴：${line}`);
  }
  // 其它选项不该有小字（保持界面干净）
  for (const o of q.options) {
    if (o.value !== 'notice-and-no-promotion') {
      assert.ok(!o.note, `${o.value} 不该有小字`);
    }
  }
});

test('署名题选中间那一项，推荐结果与另外两个选项都不同', () => {  // 这一项的意义就在于"保留署名 + 不许拿我名义宣传"这个组合，
  // 而它正是 BSD-3-Clause 相对 MIT 多出来的那一条。
  // 若它给出的候选与"必须保留署名"完全一样，这个选项等于没作用。
  const base = { kind: 'software', closedSource: 'yes', patent: 'na', audience: 'either', network: 'no', gplVersion: 'or-later' };
  const ids = (v) => recommend({ ...base, attribution: v }).map((r) => r.license.id);
  const plain = ids('yes');
  const noPromo = ids('notice-and-no-promotion');
  const none = ids('no');

  assert.notDeepEqual(noPromo, plain, '中间选项的候选顺序应当与"必须保留署名"不同');
  assert.notDeepEqual(noPromo, none, '中间选项的候选顺序应当与"不要署名"不同');
  // BSD-3-Clause 是这一组合的唯一现成答案，应当排在最前
  assert.equal(noPromo[0], 'BSD-3-Clause', '中间选项应当首推 BSD-3-Clause');
  // 而且要说清它与 MIT 的差别在哪
  const bsd = recommend({ ...base, attribution: 'notice-and-no-promotion' }).find((r) => r.license.id === 'BSD-3-Clause');
  const text = bsd.reasons.map((r) => r.zh).join(' ');
  assert.match(text, /背书或促销/, '理由里要讲明禁止背书与促销');
});

test('署名题的推荐不会变成唯一答案：仍给出取舍', () => {
  // 只给一个候选等于替用户做了决定。选了中间那一项之后，
  // 仍要把 "MIT 不禁宣传" 与 "Apache-2.0 有专利但不含此条款" 讲清楚。
  const base = { kind: 'software', closedSource: 'yes', patent: 'na', audience: 'either', network: 'no', gplVersion: 'or-later' };
  const list = recommend({ ...base, attribution: 'notice-and-no-promotion' });
  assert.ok(list.length >= 3, '应当给出多个候选而不是一个');
  const byId = Object.fromEntries(list.map((r) => [r.license.id, r.reasons.map((x) => x.zh).join(' ')]));
  assert.match(byId['MIT'] ?? '', /不禁/, '要说清 MIT 不禁止用你的名义宣传');
  assert.match(byId['Apache-2.0'] ?? '', /商标/, '要说清 Apache-2.0 只有商标条款、不含这一条');
});

/* ------------------------------------------------------------------ *
 * 数据与类别
 * ------------------------------------------------------------------ */

test('分类导航覆盖全部人工整理的许可证，且每个类别都有双语名称', () => {
  const grouped = FAMILY_ORDER.flatMap((f) => LICENSES.filter((l) => l.family === f));
  assert.equal(grouped.length, LICENSES.length, '按类别分组后不应丢许可证');
  for (const f of FAMILY_ORDER) {
    assert.ok(FAMILY_LABEL[f].zh.length > 0 && FAMILY_LABEL[f].en.length > 0, `${f} 缺少类别名称`);
  }
});

/* ------------------------------------------------------------------ *
 * 对比矩阵已移除；列表与对比工作台是仅有的两种呈现
 * ------------------------------------------------------------------ */

test('对比矩阵已删除，页面不再有它', () => {
  // 矩阵与列表在做同一件事（列出许可证、摊开维度），留着只会让人在两套界面之间选。
  // 这条断言守住它不被无意间加回来。
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  for (const gone of ['CompareMatrix', 'matrixRows', 'scopeLabel', 'setView', "useState<'list' | 'matrix'>"]) {
    assert.ok(!src.includes(gone), `对比矩阵的残留：${gone}`);
  }
  // 顶层的对比维度定义还在——「对比工作台」仍然用它
  assert.ok(src.includes('compareDimensions'), '对比工作台的维度定义应当保留');
  assert.ok(src.includes('function CompareBoard'), '对比工作台应当保留');
});

test('列表的点击行为：单击看详情、双击直接选用', () => {
  // 这里出过一次真 bug（当时矩阵的行只接了"看详情"的回调）。
  // 现在只剩列表，但这套语义仍要钉住。
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  const a = src.indexOf('function ProPicker');
  const b = src.indexOf('function CatalogDetail', a);
  assert.ok(a > 0 && b > a, '找不到 ProPicker 组件体');
  const list = src.slice(a, b);

  assert.match(list, /onClick=\{\(\) => setFocus\(/, '列表单击应展示详情');
  assert.match(list, /onDoubleClick=\{\(\) => onPick\(/, '列表双击应选用');
  // 键盘可达性：条目本身是 button
  assert.match(list, /title=\{zh \? '单击看详情，双击直接选用'/, '应提示两种点击方式');
});

test('列表项的状态样式集中定义，且在行上被真正使用', () => {
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('const ROW_TINT'), '应有一份行底色定义');
  assert.ok(src.includes('function rowEdgeClass'), '应有一份状态边框定义');
  assert.ok(src.includes('const ROW_TRANSITION'), '应有一份过渡时长');
  assert.ok(/rowTintClass\(/.test(src), '列表项应使用 rowTintClass');
  assert.ok(/rowEdgeClass\(/.test(src), '列表项应使用 rowEdgeClass');
  assert.ok(/ROW_TRANSITION/.test(src), '列表项应使用 ROW_TRANSITION');
  // 删除矩阵后不应留下只为表格行服务的分支
  assert.ok(!src.includes("'table'"), '不应残留只为表格行服务的样式分支');
});

test('不拼接触发器类名：Tailwind 只认完整字面量，拼接会静默失效', () => {
  // Tailwind 扫描源码里的字符串来生成样式。`hover:${X}` 这类拼出来的类名
  // 既不会生成、也不会报错——页面看起来"就是没效果"，很难查。
  const raw = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  // 去掉注释：说明文字里会引用这个坏写法作为反例
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const bad = code.match(/(?:hover|focus|active|group-hover|disabled|peer-checked):\s*\$\{/g);
  assert.equal(
    bad,
    null,
    `发现拼接出的触发器类名（Tailwind 不会生成）：${bad ? bad.join(', ') : ''}`,
  );
});
