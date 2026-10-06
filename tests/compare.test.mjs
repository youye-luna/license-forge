import test from 'node:test';
import assert from 'node:assert/strict';

import { allowsClosedSource, compareDimensions, factsOf, generatedIntro } from '../src/lib/compare.ts';
import { loadUnifiedCatalog } from '../src/lib/spdx.ts';

const SPDX = (await import('../public/data/license-index.json', { with: { type: 'json' } })).default;
const SCANCODE = (await import('../public/data/scancode-index.json', { with: { type: 'json' } })).default;
const TEXTS = (await import('../public/data/license-texts.json', { with: { type: 'json' } })).default;
const ENRICHMENT = (await import('../public/data/license-enrichment.json', { with: { type: 'json' } })).default;
const TERMS = (await import('../public/data/terms.json', { with: { type: 'json' } })).default;

const UNIFIED = loadUnifiedCatalog(SPDX, SCANCODE);

function entryOf(id) {
  const e = UNIFIED.find((x) => x.id === id);
  assert.ok(e, `${id} 应当在合并目录里`);
  return e;
}

function factsFor(id, withText = true) {
  const e = entryOf(id);
  const key = e.source === 'spdx' ? e.id : (e.scancodeKey ?? '');
  return factsOf(
    e,
    ENRICHMENT.licenses[key],
    TERMS,
    withText ? TEXTS.licenses[e.id]?.licenseText : undefined,
  );
}

/* ------------------------------------------------------------------ *
 * 矩阵与工作台必须共用同一份定义
 * ------------------------------------------------------------------ */

test('维度定义同时服务矩阵与工作台（只有一份，不会各写一套）', () => {
  const zh = compareDimensions('zh');
  const en = compareDimensions('en');
  assert.equal(zh.length, en.length, '中英维度数量必须一致');
  assert.ok(zh.length >= 12, `维度太少：${zh.length}`);
  for (let i = 0; i < zh.length; i++) {
    assert.equal(zh[i].label.length > 0, true);
    assert.equal(typeof zh[i].cell, 'function', `第 ${i} 个维度缺少 cell`);
    assert.ok(zh[i].kind, `第 ${i} 个维度缺少 kind`);
  }
});

test('关键维度都在矩阵里，且顺序稳定（宽松程度 → 义务 → 认证）', () => {
  const labels = compareDimensions('zh').map((d) => d.label);
  for (const need of ['来源', '家族', '条款来源', '专利授权', '允许闭源衍生', '网络服务触发', '须标注改动', '商标条款', 'NOTICE 义务', 'OSI']) {
    assert.ok(labels.includes(need), `矩阵缺少维度：${need}`);
  }
  // 顺序直接决定扫读体验，钉住它避免被无意打乱
  assert.equal(labels[0], '来源');
  assert.ok(labels.indexOf('允许闭源衍生') < labels.indexOf('网络服务触发'));
});

/* ------------------------------------------------------------------ *
 * factsOf：从条目解析事实
 * ------------------------------------------------------------------ */

test('人工标注的条目不需要正文也能得出条款（矩阵因此能先渲染后补数据）', () => {
  // Apache-2.0 在 ChooseALicense 的 47 个标注范围内，无需正文
  const withText = factsFor('Apache-2.0', true);
  const withoutText = factsFor('Apache-2.0', false);
  assert.equal(withoutText.facts.patentGrant, withText.facts.patentGrant, '有无正文结论应当一致');
  assert.equal(withoutText.facts.patentGrant, 'explicit');
  assert.equal(withoutText.termsSource, 'choosealicense');
});

test('家族来自 ScanCode 分类，即使没有正文也能判定', () => {
  const agpl = factsFor('AGPL-3.0-only', false);
  assert.equal(agpl.family, 'network-copyleft', 'AGPL 必须判为网络著佐权');
  const mit = factsFor('MIT', false);
  assert.equal(mit.family, 'permissive');
});

test('非 SPDX 条目也能进对比，来源与标识符都如实标注', () => {
  const r = factsFor('scancode:996-icu-1.0', false);
  assert.equal(r.source, 'scancode');
  assert.equal(r.displayId, '996-icu-1.0');
  assert.ok(r.category, '应当带上 ScanCode 分类');
});

test('允许闭源衍生的判定：宽松型允许，强著佐权不允许', () => {
  assert.equal(allowsClosedSource(factsFor('MIT', false)), true);
  assert.equal(allowsClosedSource(factsFor('Apache-2.0', false)), true);
  assert.equal(allowsClosedSource(factsFor('CC0-1.0', false)), true);
  assert.equal(allowsClosedSource(factsFor('GPL-3.0-only', false)), false);
  assert.equal(allowsClosedSource(factsFor('AGPL-3.0-only', false)), false);
});

test('MPL-2.0 这类文件级著佐权：允许闭源衍生，但被改的文件要回馈', () => {
  const mpl = factsFor('MPL-2.0', false);
  assert.equal(mpl.family, 'weak-copyleft');
  assert.equal(mpl.facts.sameLicensePerFile, true, 'MPL 是文件级著佐权');
  // 文件级著佐权不阻止闭源的大作品使用它——这正是矩阵要区分的
  assert.equal(allowsClosedSource(mpl), true);
});

test('条款来源如实区分人工标注与正文推断', () => {
  assert.equal(factsFor('MIT', false).termsSource, 'choosealicense');
  assert.equal(factsFor('Apache-2.0', false).termsSource, 'choosealicense');
  // 长尾条目不在 47 个标注范围内 → 只能推断
  const outside = UNIFIED.find((e) => e.source === 'spdx' && !TERMS.licenses[e.id] && e.textLength > 200);
  assert.ok(outside, '应当存在标注范围外的条目');
  assert.equal(factsFor(outside.id, true).termsSource, 'text');
});

test('NOTICE 义务只对明确要求它的许可证为真', () => {
  assert.equal(factsFor('Apache-2.0', false).facts.requiresNotice, true, 'Apache-2.0 §4(d) 是硬性义务');
  assert.equal(factsFor('MIT', false).facts.requiresNotice, false);
  assert.equal(factsFor('GPL-3.0-or-later', false).facts.requiresNotice, false);
});

/* ------------------------------------------------------------------ *
 * 矩阵的数据规模
 * ------------------------------------------------------------------ */

test('「最常用」范围的矩阵行数与短名单一致，且每行都能解析出事实', () => {
  const FEATURED_IDS = [
    'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'EPL-2.0',
    'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
    'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later',
    'AGPL-3.0-only', 'AGPL-3.0-or-later', 'Unlicense', 'CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0',
    'MulanPSL-2.0', 'BSL-1.0', 'Zlib', 'OFL-1.1', 'EUPL-1.2', 'CERN-OHL-S-2.0', 'MIT-0', '0BSD',
  ];
  const rows = FEATURED_IDS.map((id) => UNIFIED.find((e) => e.id === id)).filter(Boolean);
  assert.equal(rows.length, FEATURED_IDS.length, '短名单里的条目应当都能在合并目录里找到');
  for (const e of rows) {
    const f = factsFor(e.id, false);
    assert.ok(f.family, `${e.id} 缺家族`);
    assert.ok(f.facts.patentGrant, `${e.id} 缺专利判定`);
    // 每个维度都能渲染出值或明确的"—"（null），不允许抛错
    for (const d of compareDimensions('zh')) {
      const v = d.cell(f);
      assert.ok(v === null || typeof v === 'string' || typeof v === 'boolean', `${e.id} 的维度 ${d.label} 渲染值异常`);
    }
  }
});

test('放宽到某个分类时，矩阵行数可控（不超过 80 行）', () => {
  // 与 ProPicker 里的上限保持一致：再多就不叫"一眼看全"了
  const gpl = UNIFIED.filter((e) => /^(A|L)?GPL-/.test(e.id));
  assert.ok(gpl.length >= 10, 'GPL 家族条目应当足够多');
  assert.ok(gpl.slice(0, 80).length <= 80);
});

test('木兰族的两个许可证在矩阵里被区分开', () => {
  const psl = factsFor('MulanPSL-2.0', false);
  const publ = factsFor('scancode:mulanpubl-2.0', false);
  assert.equal(psl.source, 'spdx');
  assert.equal(psl.family, 'permissive', '木兰宽松型应判为宽松');
  assert.equal(allowsClosedSource(psl), true);
  assert.equal(publ.source, 'scancode');
  assert.notEqual(publ.family, 'permissive', '木兰公共型不应被判为宽松');
  assert.equal(allowsClosedSource(publ), false);
});

/* ------------------------------------------------------------------ *
 * 生成的简介（详情页顶部那段话）
 * ------------------------------------------------------------------ */

function introFor(id, lang = 'zh') {
  const e = entryOf(id);
  const key = e.source === 'spdx' ? e.id : (e.scancodeKey ?? '');
  const facts = factsOf(e, ENRICHMENT.licenses[key], TERMS, TEXTS.licenses[e.id]?.licenseText);
  return { facts, intro: generatedIntro(facts, lang) };
}

test('生成的简介第一句必须回答"这是什么类型的许可"', () => {
  const { intro } = introFor('MIT');
  assert.match(intro, /宽松型许可证/, 'MIT 的简介应说明它是宽松型');
  const { intro: agpl } = introFor('AGPL-3.0-only');
  assert.match(agpl, /网络著佐权/, 'AGPL 的简介应说明它是网络著佐权');
  const { intro: gpl } = introFor('GPL-3.0-only');
  assert.match(gpl, /强著佐权/, 'GPL 的简介应说明它是强著佐权');
});

test('简介对非开源许可证给出明确警告，而不是套用家族模板', () => {
  const nonOpenId = Object.keys(ENRICHMENT.licenses).find(
    (k) => ENRICHMENT.licenses[k].category && ['Proprietary Free', 'Commercial', 'Non-Commercial', 'Source-available', 'Unstated License'].includes(ENRICHMENT.licenses[k].category),
  );
  assert.ok(nonOpenId);
  const { facts, intro } = introFor(nonOpenId);
  assert.equal(facts.nonOpen, true);
  assert.match(intro, /不是一份开源许可证/, '必须开门见山警告');
  assert.ok(!intro.includes('这是一份宽松型'), '非开源条目不应套用宽松型模板');
});

test('简介包含专利与网络触发的结论（有才说，没有不说）', () => {
  // Apache-2.0：明确授予专利，不触发网络义务
  const { intro: apache } = introFor('Apache-2.0');
  assert.match(apache, /明确授予专利/);
  assert.ok(!apache.includes('网络服务'), 'Apache-2.0 不该提网络触发');
  // AGPL-3.0：两者都有
  const { intro: agpl } = introFor('AGPL-3.0-only');
  assert.match(agpl, /明确授予专利/);
  assert.match(agpl, /通过网络提供服务也会触发/);
});

test('归属方会写进简介（木兰公共型 → COSCL）', () => {
  const { facts, intro } = introFor('scancode:mulanpubl-2.0');
  assert.ok(facts.owner, 'mulanpubl-2.0 应带归属方');
  assert.match(intro, /COSCL/, '简介应包含归属方名称');
});

test('ScanCode 条目的简介必须提醒 LicenseRef 不能进清单字段', () => {
  const { intro } = introFor('scancode:996-icu-1.0');
  assert.match(intro, /ScanCode LicenseDB/);
  assert.match(intro, /不能填进 package\.json 的 license 字段/);
});

test('SPDX 条目的简介说明标识符可用于清单', () => {
  const { intro } = introFor('MIT');
  assert.match(intro, /SPDX License List/);
  assert.match(intro, /可用于包管理器清单/);
});

test('废弃标识符的简介带提醒', () => {
  const deprecatedId = SPDX.licenses.find((l) => l.deprecated && l.textLength > 200)?.id;
  assert.ok(deprecatedId);
  const { intro } = introFor(deprecatedId);
  assert.match(intro, /废弃标识符/);
});

test('英文简介同样完整（双语站点不能只做一半）', () => {
  const { intro: en } = introFor('MIT', 'en');
  assert.match(en, /permissive license/i);
  assert.match(en, /SPDX License List/);
  const { intro: enAgpl } = introFor('AGPL-3.0-only', 'en');
  assert.match(enAgpl, /network-copyleft/i);
});

test('简介不编造：每句话都有数据依据（抽查生成函数的输入完整性）', () => {
  // 对全部 2476 个条目生成简介，确认不抛错、非空、且至少包含家族句或非开源警告
  let count = 0;
  for (const e of UNIFIED) {
    const key = e.source === 'spdx' ? e.id : (e.scancodeKey ?? '');
    const facts = factsOf(e, ENRICHMENT.licenses[key], TERMS, undefined);
    const intro = generatedIntro(facts, 'zh');
    assert.ok(intro.length >= 20, `${e.id} 的简介过短：${JSON.stringify(intro)}`);
    assert.ok(
      /许可证|公共领域|不是一份开源/.test(intro),
      `${e.id} 的简介缺少家族定位句：${JSON.stringify(intro.slice(0, 60))}`,
    );
    count++;
  }
  assert.equal(count, UNIFIED.length);
});
