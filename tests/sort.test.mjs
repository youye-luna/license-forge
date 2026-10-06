import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FAMILY_RANK,
  PATENT_RANK,
  SORTS,
  SUBJECT_RANK,
  keyOf,
  needsLicenseText,
  sortLicenses,
} from '../src/lib/ordering.ts';
import { loadUnifiedCatalog, familyFromEntry, lookupTerms } from '../src/lib/spdx.ts';
import { subjectsOf } from '../src/lib/subject.ts';

const SPDX = JSON.parse(readFileSync(new URL('../public/data/license-index.json', import.meta.url), 'utf8'));
const SCANCODE = JSON.parse(readFileSync(new URL('../public/data/scancode-index.json', import.meta.url), 'utf8'));
const ENRICHMENT = JSON.parse(readFileSync(new URL('../public/data/license-enrichment.json', import.meta.url), 'utf8'));
const TERMS = JSON.parse(readFileSync(new URL('../public/data/terms.json', import.meta.url), 'utf8'));
const UNIFIED = loadUnifiedCatalog(SPDX, SCANCODE);

const ctx = { enrichment: ENRICHMENT, terms: TERMS, licenseTexts: {} };

const familyOf = (e) => familyFromEntry(e, ENRICHMENT.licenses[keyOf(e)]);
const subjectOf = (e) => subjectsOf(keyOf(e), familyOf(e)).subjects[0];

/* ------------------------------------------------------------------ *
 * 排序项本身
 * ------------------------------------------------------------------ */

test('四个排序项，默认按标识符', () => {
  assert.deepEqual(
    SORTS.map((s) => s.id),
    ['id', 'family', 'subject', 'patent'],
  );
  assert.equal(SORTS[0].id, 'id', '默认应当是标识符排序');
  for (const s of SORTS) assert.ok(s.zh && s.en, `${s.id} 缺少双语文案`);
});

test('只有「专利授权」依赖正文，界面据此给出说明', () => {
  assert.equal(needsLicenseText('patent'), true);
  for (const k of ['id', 'family', 'subject']) {
    assert.equal(needsLicenseText(k), false, `${k} 不应依赖正文`);
  }
});

/* ------------------------------------------------------------------ *
 * 排序结果
 * ------------------------------------------------------------------ */

test('按标识符：字母序（大小写不敏感），且稳定', () => {
  const out = sortLicenses(UNIFIED, 'id', ctx);
  assert.equal(out.length, UNIFIED.length, '排序不应丢条目');
  // 用 localeCompare 断言，而不是码点比较：后者会把 `3D-Slicer` 排在 `3com` 前面，
  // 而人期望的是大小写不敏感的字母序
  for (let i = 1; i < out.length; i++) {
    assert.ok(
      keyOf(out[i - 1]).localeCompare(keyOf(out[i])) <= 0,
      `标识符顺序不对：${keyOf(out[i - 1])} 应排在 ${keyOf(out[i])} 之前`,
    );
  }
  // 同样的输入必须得到同样的输出
  assert.deepEqual(sortLicenses(UNIFIED, 'id', ctx).map(keyOf), out.map(keyOf));
});

test('按宽松程度：从最宽松到最强著佐权，非开源垫底', () => {
  const out = sortLicenses(UNIFIED, 'family', ctx);
  const ranks = out.map((e) => FAMILY_RANK[familyOf(e) ?? 'unknown'] ?? 8);
  for (let i = 1; i < ranks.length; i++) {
    assert.ok(ranks[i - 1] <= ranks[i], `家族次序不对：第 ${i} 项 rank ${ranks[i - 1]} > ${ranks[i]}`);
  }
  // 第一个必须是宽松型，最后一个必须是 proprietary / unknown
  assert.equal(FAMILY_RANK[familyOf(out[0])], 0, '第一项应当是宽松型');
  assert.ok((FAMILY_RANK[familyOf(out[out.length - 1])] ?? 8) >= 6, '最后一项应当是非开源或未知');
});

test('按适用对象：非代码的排在前面，代码垫底', () => {
  // 选这个排序通常是想回答"哪些许可不是给代码的"，所以代码必须排最后
  const out = sortLicenses(UNIFIED, 'subject', ctx);
  const ranks = out.map((e) => SUBJECT_RANK[subjectOf(e)]);
  for (let i = 1; i < ranks.length; i++) {
    assert.ok(ranks[i - 1] <= ranks[i], `适用对象次序不对：第 ${i} 项`);
  }
  assert.equal(SUBJECT_RANK[subjectOf(out[0])], 0, '第一项应当是最专门的类别（硬件）');
  assert.equal(subjectOf(out[out.length - 1]), 'code', '最后一项应当是源代码许可');
  // 硬件与字体要真的排在最前面
  assert.ok(['hardware', 'font'].includes(subjectOf(out[0])));
  assert.ok(out.slice(0, 30).every((e) => subjectOf(e) !== 'code'), '前 30 项不应出现代码类');
});

test('按专利授权：明确授予的排最前，未加载正文的退化为"未提及"', () => {
  const out = sortLicenses(UNIFIED, 'patent', ctx);
  assert.equal(out.length, UNIFIED.length);

  // 第一项必须是"明确授予专利"的那一类（具体是哪一个取决于字母序，不要去猜 ID）
  const firstKey = keyOf(out[0]);
  const firstCal = lookupTerms(TERMS, firstKey);
  assert.ok(firstCal, `第一项 ${firstKey} 应当有 ChooseALicense 人工标注，否则不该排在最前`);
  assert.equal(firstCal.derived.patentGrant, 'explicit', `第一项 ${firstKey} 应当是明确授予专利`);

  // 明确授予专利的那批必须在靠前区间
  const top200 = out.slice(0, 200).map(keyOf);
  for (const id of ['Apache-2.0', 'AFL-3.0', 'MPL-2.0']) {
    assert.ok(top200.includes(id), `${id} 有明确专利授权，应当排在靠前位置`);
  }

  // 排名必须单调不减。判定要与实现走同一条查找路径：`lookupTerms` 会
  // 规范化 -only / -or-later，直接查 TERMS.licenses[key] 会漏掉 GPL 系列。
  const grantOf = (e) => lookupTerms(TERMS, keyOf(e))?.derived.patentGrant ?? 'silent';
  const ranks = out.map((e) => PATENT_RANK[grantOf(e)]);
  for (let i = 1; i < ranks.length; i++) {
    assert.ok(ranks[i - 1] <= ranks[i], `专利次序不对：第 ${i} 项（${keyOf(out[i - 1])} → ${keyOf(out[i])}）`);
  }
});

test('排序不丢条目、不重复', () => {
  for (const s of SORTS) {
    const out = sortLicenses(UNIFIED, s.id, ctx);
    assert.equal(out.length, UNIFIED.length, `${s.id} 排序后数量变了`);
    assert.equal(new Set(out.map((e) => e.id)).size, UNIFIED.length, `${s.id} 排序后出现重复`);
  }
});

test('排序不改动输入数组（纯函数）', () => {
  const input = UNIFIED.slice(0, 50);
  const snapshot = input.map((e) => e.id);
  sortLicenses(input, 'family', ctx);
  assert.deepEqual(input.map((e) => e.id), snapshot, '不应原地修改传入的数组');
});

/* ------------------------------------------------------------------ *
 * 界面接线
 * ------------------------------------------------------------------ */

test('列表使用 sortLicenses，且排序控件在列表所在的那一栏', () => {
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes("from '../lib/ordering.ts'"), '应当从 lib/ordering.ts 引入排序');
  assert.match(src, /sortLicenses\(results, sortKey,/, '列表应当用 sortLicenses 排序');
  assert.ok(src.includes('sortedResults.map('), '渲染的应当是排序后的结果');
  // 排序控件必须出现在列表之前（同一栏内）
  const sortIdx = src.indexOf("zh ? '排序' : 'Sort'");
  const listIdx = src.indexOf('sortedResults.map(');
  assert.ok(sortIdx > 0 && listIdx > sortIdx, '排序控件应当位于列表之前');
  // 组件内不应再留一份排序常量
  assert.ok(!src.includes('const FAMILY_RANK'), '排序常量不应在组件里重复一份');
});

/* ------------------------------------------------------------------ *
 * 两个会静默毁掉构建的坑，各钉一条
 * ------------------------------------------------------------------ */

test('排序模块必须叫 ordering.ts —— 叫 sort.ts 会让构建失败', () => {
  // 实测：把同一份代码放进 src/lib/sort.ts 并 import 进来，
  // `next build --webpack` 会在静态导出阶段失败，报
  //   Could not find the module "src/components/Generator.tsx#default"
  //   in the React Client Manifest
  // 而 Generator.tsx 本身完全没被改过（客户端清单里会丢掉它）。
  // 改名为 ordering.ts 后一切正常：同样的内容、同样的引用路径，
  // 只有文件名不同。原因在 Next.js 内部，未能定位到具体机制。
  // 这条断言的作用是：不要让后来者"顺手"把它改回更自然的名字。
  const lib = readdirSync(new URL('../src/lib', import.meta.url));
  assert.ok(lib.includes('ordering.ts'), 'src/lib/ordering.ts 应当存在');
  assert.ok(!lib.includes('sort.ts'), 'src/lib/sort.ts 会让构建失败，不要改回这个名字');
  assert.ok(
    !existsSync(new URL('../src/lib/sort.ts', import.meta.url)),
    'src/lib/sort.ts 会让构建失败，不要创建它',
  );
});

test('客户端组件首行必须是 use client，且文件不能带 BOM', () => {
  // BOM 会让 SWC 认不出 `'use client'` 指令，于是该组件被当成服务端组件、
  // 不注册进客户端清单，报的却是"找不到另一个组件"的错误——极难定位。
  // 实测踩过一次：用 PowerShell 的 Get-Content/Set-Content 往返写文件，
  // 既加了 BOM 又按 ANSI 解码损坏了中文。
  const srcRoot = fileURLToPath(new URL('../src', import.meta.url));
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
    );

  let checked = 0;
  for (const file of walk(srcRoot)) {
    const raw = readFileSync(file, 'utf8');
    const label = relative(srcRoot, file).replace(/\\/g, '/');
    assert.notEqual(raw.charCodeAt(0), 0xfeff, `${label} 带了 BOM，'use client' 会失效`);
    assert.ok(!raw.includes('\uFFFD'), `${label} 含替换符，说明编码已损坏`);
    if (/use client/.test(raw)) {
      assert.match(raw, /^['"]use client['"]/, `${label} 的 'use client' 不在文件首行`);
      checked++;
    }
  }
  assert.ok(checked >= 3, `应当检查到至少 3 个客户端组件，实际 ${checked}`);
});
