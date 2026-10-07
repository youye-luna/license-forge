import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SUBJECT_LABEL, matchesSubject, subjectsOf } from '../src/lib/subject.ts';
import { LICENSES } from '../src/lib/licenses.ts';
import { loadUnifiedCatalog, familyFromEntry } from '../src/lib/spdx.ts';

const SPDX = JSON.parse(readFileSync(new URL('../public/data/license-index.json', import.meta.url), 'utf8'));
const SCANCODE = JSON.parse(readFileSync(new URL('../public/data/scancode-index.json', import.meta.url), 'utf8'));
const ENRICHMENT = JSON.parse(readFileSync(new URL('../public/data/license-enrichment.json', import.meta.url), 'utf8'));
const UNIFIED = loadUnifiedCatalog(SPDX, SCANCODE);

const forEntry = (e) => {
  const key = e.source === 'spdx' ? e.id : (e.scancodeKey ?? '');
  return subjectsOf(key, familyFromEntry(e, ENRICHMENT.licenses[key]));
};

/* ------------------------------------------------------------------ *
 * 用户举的两个例子：必须对
 * ------------------------------------------------------------------ */

test('MIT 适用于源代码', () => {
  const v = subjectsOf('MIT');
  assert.deepEqual(v.subjects, ['code']);
});

test('CC-BY-SA-4.0 适用于文本/媒体，而不是源代码', () => {
  const v = subjectsOf('CC-BY-SA-4.0');
  assert.ok(v.subjects.includes('media'), 'CC-BY-SA-4.0 应判为文本/媒体');
  assert.ok(!v.subjects.includes('code'), '不应把 CC 许可判为源代码许可');
  assert.ok(v.note, '应当提示 Creative Commons 不建议用于软件');
});

/* ------------------------------------------------------------------ *
 * 人工指定层
 * ------------------------------------------------------------------ */

test('字体、硬件、内容这几类不会被误判成源代码', () => {
  assert.deepEqual(subjectsOf('OFL-1.1').subjects, ['font']);
  assert.deepEqual(subjectsOf('CERN-OHL-S-2.0').subjects, ['hardware']);
  assert.ok(subjectsOf('CC-BY-4.0').subjects.includes('media'));
  // 这两类的家族分别是 permissive 与 strong-copyleft，
  // 说明"适用于"必须独立于家族判定——家族看不出作品类型
  assert.equal(subjectsOf('OFL-1.1').source, 'curated');
  assert.equal(subjectsOf('CERN-OHL-S-2.0').source, 'curated');
});

test('CC0 与 WTFPL 判为"各类作品"，并说明 CC0 不含专利授权', () => {
  assert.deepEqual(subjectsOf('CC0-1.0').subjects, ['any']);
  assert.match(subjectsOf('CC0-1.0').note.zh, /专利/);
  assert.deepEqual(subjectsOf('WTFPL').subjects, ['any']);
});

test('全部 32 个人工整理的许可证都有明确判定，不落到默认层', () => {
  for (const l of LICENSES) {
    const v = subjectsOf(l.id);
    assert.equal(v.source, 'curated', `${l.id} 应当人工指定适用于什么`);
    assert.ok(v.subjects.length > 0, `${l.id} 的适用于不能为空`);
  }
});

/* ------------------------------------------------------------------ *
 * 长尾条目的规则层
 * ------------------------------------------------------------------ */

test('长尾条目靠明确的标识符规则判定', () => {
  const cases = [
    ['OFL-1.0', 'font'],
    ['LPPL-1.3c', 'font'],
    ['Adobe-Glyph', 'font'],
    ['CERN-OHL-W-2.0', 'hardware'],
    ['TAPR-OHL-1.0', 'hardware'],
    ['ODbL-1.0', 'data'],
    ['GFDL-1.3-or-later', 'docs'],
    ['W3C', 'spec'],
    ['Unicode-3.0', 'spec'],
    ['llama-3.1-license-2024', 'model'],
    ['bigscience-open-rail-m', 'model'],
  ];
  for (const [id, expect] of cases) {
    const v = subjectsOf(id);
    assert.ok(v.subjects.includes(expect), `${id} 应含 ${expect}，实际 ${v.subjects.join('+')}（来源 ${v.source}）`);
    assert.equal(v.source, 'rule', `${id} 应当由规则判定`);
  }
});

test('ScanCode 的小写 key 同样能命中规则', () => {
  // ScanCode 独有条目的 key 是小写的，规则必须大小写不敏感
  assert.equal(subjectsOf('odbl-1.0').source, 'rule');
  assert.ok(subjectsOf('odbl-1.0').subjects.includes('data'));
  assert.equal(subjectsOf('lppl-1.3b').source, 'rule');
  assert.ok(subjectsOf('lppl-1.3b').subjects.includes('font'));
});

/* ------------------------------------------------------------------ *
 * 默认层：诚实标注，而不是把推断当事实
 * ------------------------------------------------------------------ */

test('没有信号的条目落到默认层，且明确标为默认判定', () => {
  const v = subjectsOf('Some-Unknown-License-1.0');
  assert.deepEqual(v.subjects, ['code']);
  assert.equal(v.source, 'default', '默认判定必须能被界面识别出来并如实标注');
});

test('刻意不做宽泛关键词匹配：名字里带 data / doc 的软件协议不能被误判', () => {
  // 实测这些其实是软件协议，名字里的 data / doc 只是产品名。
  // 早期用关键词匹配会把它们判成"数据"或"文档"，因此规则只认标识符前缀。
  for (const id of ['databricks-db', 'ms-sql-server-data-tools', 'netdata-ncul1', 'CMU-Mach-nodoc-prepend']) {
    const v = subjectsOf(id);
    assert.ok(
      !v.subjects.includes('data') && !v.subjects.includes('docs'),
      `${id} 不应被判成数据或文档，实际 ${v.subjects.join('+')}`,
    );
  }
});

test('家族为 content 时兜底按媒体处理', () => {
  // 少数 CC 变体可能不在标识符规则内，家族信息可以作为兜底
  const v = subjectsOf('Weird-Content-License', 'content');
  assert.ok(v.subjects.includes('media'));
  assert.equal(v.source, 'rule');
});

/* ------------------------------------------------------------------ *
 * 数据完整性与文案
 * ------------------------------------------------------------------ */

test('每个主题都有中英双语文案', () => {
  for (const [k, label] of Object.entries(SUBJECT_LABEL)) {
    assert.ok(label.zh && label.en, `${k} 缺少双语文案`);
  }
  assert.deepEqual(
    Object.keys(SUBJECT_LABEL).sort(),
    ['any', 'code', 'data', 'docs', 'font', 'hardware', 'media', 'model', 'spec'].sort(),
    '主题集合被改动了，界面与规则要一起更新',
  );
});

test('全量 2476 个条目都能得出"适用于"，且不抛错', () => {
  let curated = 0;
  let rule = 0;
  let fallback = 0;
  for (const e of UNIFIED) {
    const v = forEntry(e);
    assert.ok(v.subjects.length > 0, `${e.id} 没有得到适用于什么`);
    for (const s of v.subjects) assert.ok(SUBJECT_LABEL[s], `${e.id} 出现未知主题 ${s}`);
    if (v.source === 'curated') curated++;
    else if (v.source === 'rule') rule++;
    else fallback++;
  }
  assert.equal(curated + rule + fallback, UNIFIED.length);
  // 规则覆盖应当是有意义的量，而不是几乎全落到默认
  assert.ok(rule > 100, `规则层只覆盖了 ${rule} 个，太少了`);
  assert.equal(curated, LICENSES.length, '人工指定层应当与人工整理的许可证数量一致');
});

test('判为非纯代码的条目数量在合理范围，没有大规模误判', () => {
  const nonCode = UNIFIED.filter((e) => {
    const v = forEntry(e);
    return !(v.subjects.length === 1 && v.subjects[0] === 'code');
  });
  // 目前约 157 个。放宽上限是为了容错，但数量暴增通常意味着规则写宽了。
  assert.ok(nonCode.length > 50, `非代码条目只有 ${nonCode.length} 个，规则可能失效了`);
  assert.ok(nonCode.length < 400, `非代码条目达到 ${nonCode.length} 个，规则可能过宽导致误判`);
});

/* ------------------------------------------------------------------ *
 * 「用来授权」筛选项
 * ------------------------------------------------------------------ */

const famOf = (e) => familyFromEntry(e, ENRICHMENT.licenses[e.source === 'spdx' ? e.id : (e.scancodeKey ?? '')]);

test('筛选项：不限时全部通过，选定类型时只留该类型', () => {
  for (const e of UNIFIED) {
    assert.equal(matchesSubject(e, 'all', famOf(e)), true, `${e.id} 在不限时应当通过`);
  }
  const fonts = UNIFIED.filter((e) => matchesSubject(e, 'font', famOf(e)));
  assert.ok(fonts.length > 0, '应当能筛出字体许可');
  for (const e of fonts) {
    assert.ok(subjectsOf(e.source === 'spdx' ? e.id : (e.scancodeKey ?? ''), famOf(e)).subjects.includes('font'));
  }
  // 字体筛选里不应混进 MIT 这类纯代码许可
  assert.ok(!fonts.some((e) => e.id === 'MIT'), 'MIT 不该出现在字体筛选里');
});

test('筛选项的判定与详情面板完全一致（同一套规则，不会自相矛盾）', () => {
  // 早先界面里另有两个按名字前缀猜的筛选（"给文档和图片用的""给硬件设计用的"），
  // 会出现"筛出来但详情页说不是"的矛盾。现在两处共用 subjectsOf。
  for (const e of UNIFIED) {
    const key = e.source === 'spdx' ? e.id : (e.scancodeKey ?? '');
    const verdict = subjectsOf(key, famOf(e)).subjects;
    for (const s of Object.keys(SUBJECT_LABEL)) {
      assert.equal(
        matchesSubject(e, s, famOf(e)),
        verdict.includes(s),
        `${e.id} 在 ${s} 上，筛选项与详情面板的判定不一致`,
      );
    }
  }
});

test('一个许可可以同时属于多种类型：CC-BY-SA-4.0 同时是媒体与数据，但不是代码', () => {
  const cc = UNIFIED.find((e) => e.id === 'CC-BY-SA-4.0');
  assert.ok(cc);
  assert.equal(matchesSubject(cc, 'media', famOf(cc)), true);
  assert.equal(matchesSubject(cc, 'data', famOf(cc)), true);
  assert.equal(matchesSubject(cc, 'code', famOf(cc)), false);
  assert.equal(matchesSubject(cc, 'font', famOf(cc)), false);
});

test('筛选项覆盖全部作品类型，每个都有中英文案', () => {
  // 界面下拉里的顺序与这里保持一致
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('SUBJECT_FILTERS'), '界面应当有「用来授权」筛选项');
  assert.ok(src.includes('matchesSubject'), '筛选项必须复用 lib/subject.ts 的判定');
  assert.ok(src.includes("zh ? '用来授权' : 'Used for'"), '筛选项的标签应当是「用来授权」');
  // 9 种作品类型都要能选到
  for (const s of Object.keys(SUBJECT_LABEL)) {
    assert.ok(src.includes(`'${s}'`), `筛选项里缺作品类型：${s}`);
  }
  // 旧的、按名字前缀猜的两个筛选必须已删除，避免两套机制并存
  assert.ok(!src.includes("'给文档和图片用的'"), '按前缀猜的旧筛选应当已删除');
  assert.ok(!src.includes("'给硬件设计用的'"), '按前缀猜的旧筛选应当已删除');
});
