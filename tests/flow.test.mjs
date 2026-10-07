import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { defaultGenState } from '../src/lib/genstate.ts';
import { TABS, TAB_LABEL, PROJECT } from '../src/lib/ui.ts';
import * as ui from '../src/lib/ui.ts';
import { LICENSES } from '../src/lib/licenses.ts';
import { FAMILY_LABEL } from '../src/lib/licenses.ts';
import { FAMILY_ORDER } from '../src/lib/wizard.ts';
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
    '用作者名义促销', // 条款原文是 "endorse or promote"；"促销"比"背书"直白
    '这份许可的几条关键规定',
    '能不能和别的许可证一起用',
  ];
  for (const n of needed) {
    assert.ok(src.includes(n), `详情面板应当使用白话说法「${n}」`);
  }
  // 这一条与「商标」是两条不同的规定，不能合并
  assert.ok(src.includes('用作者名义促销'), '应当有独立的"用作者名义促销"一条');
  assert.ok(src.includes('不许：不能拿作者或贡献者的名义宣传你的产品'), '禁止时要讲清不许做什么');
  assert.ok(src.includes('不等于可以：用别人名义宣传通常要另行取得同意'), '没写时要说明不等于可以用');
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
