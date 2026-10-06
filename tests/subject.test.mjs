import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SUBJECT_LABEL, subjectsOf } from '../src/lib/subject.ts';
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
