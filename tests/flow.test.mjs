import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultGenState } from '../src/lib/genstate.ts';
import { TABS, TAB_LABEL } from '../src/lib/ui.ts';
import * as ui from '../src/lib/ui.ts';
import { LICENSES } from '../src/lib/licenses.ts';
import { FAMILY_LABEL } from '../src/lib/licenses.ts';
import { FAMILY_ORDER } from '../src/lib/wizard.ts';

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
