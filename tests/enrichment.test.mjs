import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  compatibilityOf,
  deriveFacts,
  isNonOpenCategory,
  knownIncompatibilities,
  NON_OPEN_CATEGORIES,
} from '../src/lib/spdx.ts';
import { resolveSpec } from '../src/lib/spec.ts';
import { generate } from '../src/lib/generate.ts';

/** 多源补充数据（由 scripts/fetch-enrichment.mjs 生成） */
const ENRICHMENT = (await import('../public/data/license-enrichment.json', { with: { type: 'json' } })).default;
const SNAPSHOT = (await import('../public/data/license-index.json', { with: { type: 'json' } })).default;
const TEXTS = (await import('../public/data/license-texts.json', { with: { type: 'json' } })).default;
const TERMS = (await import('../public/data/terms.json', { with: { type: 'json' } })).default;
const SCANCODE_TEXTS = (await import('../public/data/scancode-texts.json', { with: { type: 'json' } })).default;

/* ------------------------------------------------------------------ *
 * 保留版权声明与许可证（includeCopyright）
 * ------------------------------------------------------------------ */

/** 用 ChooseALicense 的人工标注推一个许可证的这一项 */
function includeCopyrightOf(id) {
  const entry = SNAPSHOT.licenses.find((l) => l.id === id);
  assert.ok(entry, `${id} 应当在 SPDX 快照里`);
  const facts = deriveFacts(
    id,
    TEXTS.licenses[id].licenseText,
    entry.osiApproved,
    ENRICHMENT.licenses[id]?.family,
    TERMS,
  );
  return facts.includeCopyright;
}

test('保留版权声明：绝大多数许可要求，但五个明确不要求', () => {
  // 要保留
  for (const id of ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-3.0-only', 'MPL-2.0', 'CC-BY-4.0']) {
    assert.equal(includeCopyrightOf(id), 'required', `${id} 应当要求保留版权声明`);
  }
  // 连署名都不要求的五个
  for (const id of ['0BSD', 'CC0-1.0', 'MIT-0', 'Unlicense', 'WTFPL']) {
    assert.equal(includeCopyrightOf(id), 'not-required', `${id} 明确不要求保留版权声明`);
  }
  // 只要求在源码形式里保留
  for (const id of ['Zlib', 'BSL-1.0']) {
    assert.equal(includeCopyrightOf(id), 'source-only', `${id} 只要求在源码里保留`);
  }
});

test('保留版权声明：长尾条目靠正文推断，措辞发散也要认出来', () => {
  // Anti-996 的写法是 "must conspicuously display, without modification,
  // this License and the notice"——retain/reproduce/include 都不命中，
  // 早先因此被误判为"正文没写"。
  const facts = deriveFacts(
    '996-icu-1.0',
    SCANCODE_TEXTS['996-icu-1.0'],
    false,
    ENRICHMENT.licenses['996-icu-1.0']?.family,
    TERMS,
  );
  assert.equal(facts.includeCopyright, 'required', 'Anti-996 有明确的保留条款');
  assert.equal(facts.termsSource, 'text', '它不在 ChooseALicense 范围内，只能靠正文推断');
});

test('保留版权声明：正文确实没写的，如实标为"没写"而不是猜一个', () => {
  // AGPL-1.0（GPL-1.0 时代）与 Adobe-2006 的正文里都没有保留义务的表述。
  // 这里要的是"承认不知道"，而不是套一个默认值。
  for (const id of ['AGPL-1.0', 'Adobe-2006']) {
    assert.equal(includeCopyrightOf(id), 'silent', `${id} 的正文没有相关要求，应标为没写`);
  }
});

/* ------------------------------------------------------------------ *
 * 用作者名义背书
 * ------------------------------------------------------------------ */

/** 用真实正文推一个许可证的背书判定 */
function endorsementOf(id) {
  const entry = SNAPSHOT.licenses.find((l) => l.id === id);
  if (entry) {
    return deriveFacts(id, TEXTS.licenses[id].licenseText, entry.osiApproved, ENRICHMENT.licenses[id]?.family, TERMS)
      .endorsement;
  }
  return deriveFacts(id, SCANCODE_TEXTS[id] ?? '', false, ENRICHMENT.licenses[id]?.family, TERMS).endorsement;
}

test('背书：BSD-3-Clause 一类明确禁止，BSD-2-Clause / MIT 没有这条', () => {
  // BSD-3-Clause 的标志性第 3 条就是"Neither the name of the copyright holder
  // nor the names of its contributors may be used to endorse or promote…"。
  // 这正是 BSD-3 与 BSD-2 的实质差别之一，值得单独一条。
  assert.equal(endorsementOf('BSD-3-Clause'), 'prohibited');
  assert.equal(endorsementOf('BSD-3-Clause-Clear'), 'prohibited');
  assert.equal(endorsementOf('BSD-2-Clause'), 'silent', 'BSD-2-Clause 没有背书条款');
  assert.equal(endorsementOf('MIT'), 'silent', 'MIT 没有背书条款');
});

test('背书不能与商标混为一谈：Apache-2.0 有商标条款但不禁止背书', () => {
  // Apache-2.0 的 §6 讲的是"不能用人家的商品名/商标"，
  // 它并不禁止拿作者名义做宣传——把它判成"禁止背书"是错的。
  // 这两条在界面上也是分开的两行。
  const apache = deriveFacts(
    'Apache-2.0',
    TEXTS.licenses['Apache-2.0'].licenseText,
    true,
    ENRICHMENT.licenses['Apache-2.0']?.family,
    TERMS,
  );
  assert.equal(apache.trademarkClause, true, 'Apache-2.0 有商标条款');
  assert.equal(apache.endorsement, 'silent', 'Apache-2.0 不禁背书，不能误判');
});

test('背书：命中就是真的禁背书条款，抽查原句', () => {
  // 判定规则只认"名字 + endorse/promote"同现的句式，抽查几条例句确认没有误伤。
  const sources = { ...TEXTS.licenses, ...SCANCODE_TEXTS };
  for (const id of ['AAL', 'Apache-1.0', 'Artistic-1.0', 'BSD-3-Clause-acpica']) {
    const text = sources[id]?.licenseText ?? SCANCODE_TEXTS[id] ?? '';
    assert.ok(text, `${id} 应当有正文`);
    assert.match(
      text,
      /endorse or promote|used to endorse|may not be used to promote/i,
      `${id} 被判为禁止背书，正文里应当真能找到这样的句子`,
    );
    assert.equal(endorsementOf(id), 'prohibited', `${id} 应当被判为禁止背书`);
  }
});



test('商标一律不授权：没写明的也照样不授权，不能写成"没提到"', () => {
  // ChooseALicense 对 trademark-use 的说明明确写着：
  //   "This license explicitly states that it does NOT grant trademark rights,
  //    even though licenses without such a statement probably do not grant any
  //    implicit trademark rights."
  // 所以 MIT / BSD / GPL 这些没写商标条款的，实质上与 Apache-2.0 一样不授权。
  // 文案若写成"没提到"，会让人以为 MIT 的商标情况更宽松——那是误导。
  const src = readFileSync(new URL('../src/components/ProPicker.tsx', import.meta.url), 'utf8');
  const i = src.indexOf("label: zh ? '商标'");
  assert.ok(i > 0, '详情面板应当有商标一条');
  const block = src.slice(i, i + 900);

  // 两种情况的文案都必须以"不授予商标权"开头
  assert.ok(block.includes('不授予商标权（许可里写明了）'), '写明了的要说清是写明');
  assert.ok(block.includes('不授予商标权（许可里没写，但同样不授权）'), '没写的也要说清同样不授权');
  // 不允许出现"没提到"这种会误导的措辞
  assert.ok(!block.includes('没提到'), '商标一条不应再出现"没提到"');

  // 英文同理
  assert.ok(block.includes('no trademark rights, stated explicitly'));
  assert.ok(block.includes('not stated, but still not granted'));
});

test('商标一律不授权：生成后的自查清单对所有许可证都提示，不只对写明了的', () => {
  // 早先只在 trademarkClause 为真时才提示，于是 MIT / BSD / GPL 的用户
  // 看不到这条，容易以为项目名称可以随便用。
  const src = readFileSync(new URL('../src/lib/generate.ts', import.meta.url), 'utf8');
  const i = src.indexOf('许可证不授予商标权');
  assert.ok(i > 0, '自查清单里应当有商标说明');
  // 这里不能再被 if (trademarkClause) 包住
  const before = src.slice(Math.max(0, i - 400), i);
  assert.ok(
    !/if \(spec\.facts\.trademarkClause\)\s*\{\s*$/m.test(before.trim().split('\n').slice(-1)[0] ?? ''),
    '商标提示不应只在写明了的时候才出现',
  );
  assert.ok(src.includes('虽然它没有写明这一句，但同样不授权'), '没写明的情况也要在提示里说明');
});

function options(overrides = {}) {
  return {
    lang: 'zh',
    copyright: {
      holders: [{ name: 'Acme Inc.', from: '2024' }],
      projectName: 'widget',
      symbolStyle: 'word',
      joiner: 'newline',
    },
    languageId: 'c',
    manifests: ['package.json'],
    includeNotice: false,
    includeFileHeader: true,
    includeReadme: true,
    includeReuseLayout: false,
    thirdParty: '',
    contactEmail: '',
    repoUrl: '',
    ...overrides,
  };
}

function build(id, opts = options()) {
  const spec = resolveSpec(id, SNAPSHOT, TEXTS, undefined, ENRICHMENT.licenses);
  assert.ok(spec, `${id} 应当能解析出规格`);
  const result = generate({ spec, options: opts, licenseText: TEXTS.licenses[id], languages: [] });
  return { spec, result };
}

/* ------------------------------------------------------------------ *
 * 数据完整性
 * ------------------------------------------------------------------ */

test('补充数据记录了全部三家来源，便于核对与署名', () => {
  const src = ENRICHMENT.generatedFrom;
  assert.match(String(src.scancode), /scancode-licensedb\.aboutcode\.org/);
  assert.match(String(src.osi), /opensource\.org/);
  assert.match(String(src.osadl?.matrix ?? ''), /osadl\.org/);
  assert.equal(src.osadl?.license, 'CC-BY-4.0');
  assert.match(String(src.zhTranslations), /gitcode\.com/);
});

test('ScanCode 分类覆盖率达标，且每条映射都落在已知分类里', () => {
  const c = ENRICHMENT.coverage;
  const ratio = c.scancodeMatched / c.spdxLicenses;
  assert.ok(ratio > 0.95, `分类覆盖率过低：${(ratio * 100).toFixed(1)}%`);
  const knownCategories = new Set([
    'CLA', 'Commercial', 'Non-Commercial', 'Copyleft', 'Copyleft Limited', 'Free Restricted',
    'Patent License', 'Permissive', 'Proprietary Free', 'Public Domain', 'Source-available',
    'Unstated License',
  ]);
  const unknown = Object.entries(ENRICHMENT.licenses)
    .filter(([, r]) => r.category && !knownCategories.has(r.category))
    .map(([id, r]) => `${id}:${r.category}`);
  assert.deepEqual(unknown, [], '出现了未预期的分类值');
});

test('OSADL 兼容矩阵已裁剪到 SPDX 收录范围，且规模正常', () => {
  const c = ENRICHMENT.coverage;
  assert.ok(c.osadlMatched >= 100, `矩阵覆盖过少：${c.osadlMatched}`);
  assert.ok(c.compatibilityEdges >= 10000, `判定条数过少：${c.compatibilityEdges}`);
  const ids = new Set(SNAPSHOT.licenses.map((l) => l.id));
  const outOfScope = [];
  for (const [row, cols] of Object.entries(ENRICHMENT.compatibility)) {
    if (!ids.has(row)) outOfScope.push(row);
    for (const col of Object.keys(cols)) if (!ids.has(col)) outOfScope.push(`${row}→${col}`);
  }
  assert.deepEqual(outOfScope.slice(0, 5), [], '矩阵里混入了 SPDX 未收录的标识符');
});

test('兼容矩阵的判定值都在已知集合内', () => {
  const allowed = new Set(['Yes', 'No', 'Same', 'Unknown', 'Check dependency']);
  const bad = [];
  for (const [row, cols] of Object.entries(ENRICHMENT.compatibility)) {
    for (const [col, verdict] of Object.entries(cols)) {
      if (!allowed.has(verdict)) bad.push(`${row}→${col}=${verdict}`);
    }
  }
  assert.deepEqual(bad.slice(0, 5), [], '出现了未预期的判定值');
});

test('中文文本来源覆盖审定稿与官方正文两类', () => {
  const kinds = new Set(Object.values(ENRICHMENT.licenses).map((r) => r.chinese?.kind).filter(Boolean));
  assert.ok(kinds.has('reviewed-translation'), '应有开放原子审定稿');
  assert.ok(kinds.has('official-text'), '应有官方中文正文');
  assert.ok(ENRICHMENT.coverage.chineseTranslations >= 14, `中文来源过少：${ENRICHMENT.coverage.chineseTranslations}`);
  // 木兰的中文具有优先效力，这条必须标出来
  const mulan = ENRICHMENT.licenses['MulanPSL-2.0'];
  assert.equal(mulan?.chinese?.kind, 'official-text');
  assert.match(mulan.chinese.note.zh, /中文版为准/);
});

/* ------------------------------------------------------------------ *
 * 用分类替代文本推断
 * ------------------------------------------------------------------ */

test('家族判定优先使用 ScanCode 分类，并标注来源', () => {
  // 挑一个标识符看不出家族、但分类能判定的长尾条目
  const longTail = SNAPSHOT.licenses.find(
    (l) => !l.deprecated && ENRICHMENT.licenses[l.id]?.family && ENRICHMENT.licenses[l.id]?.category,
  );
  assert.ok(longTail);
  const facts = deriveFacts(longTail.id, TEXTS.licenses[longTail.id].licenseText, longTail.osiApproved, ENRICHMENT.licenses[longTail.id].family);
  assert.equal(facts.familySource, 'scancode-category', '有分类时不应退回文本推断');
  assert.equal(facts.family, ENRICHMENT.licenses[longTail.id].family);
});

test('没有第三方分类时才退回 SPDX 标识符，再退回文本', () => {
  // MIT 在 ScanCode 里是 Permissive，家族应来自分类
  const mit = deriveFacts('MIT', TEXTS.licenses.MIT.licenseText, true, 'permissive');
  assert.equal(mit.familySource, 'scancode-category');
  // 不传分类时退回标识符/文本
  const aal = deriveFacts('AAL', TEXTS.licenses.AAL.licenseText, true);
  assert.ok(['spdx-id', 'text'].includes(aal.familySource));
  // 未知分类不应被当成有效分类
  const unknown = deriveFacts('3D-Slicer-1.0', TEXTS.licenses['3D-Slicer-1.0'].licenseText, false, 'unknown');
  assert.notEqual(unknown.familySource, 'scancode-category');
});

test('分类不会覆盖"网络触发"这个维度（AGPL 与 GPL 同属 copyleft 大类）', () => {
  const agpl = deriveFacts('AGPL-3.0-only', TEXTS.licenses['AGPL-3.0-only'].licenseText, true, 'strong-copyleft');
  assert.equal(agpl.networkTrigger, true, 'AGPL 必须保持网络触发');
  assert.equal(agpl.family, 'network-copyleft', '网络触发应把家族升级为 network-copyleft');
  const gpl = deriveFacts('GPL-3.0-only', TEXTS.licenses['GPL-3.0-only'].licenseText, true, 'strong-copyleft');
  assert.equal(gpl.networkTrigger, false);
});

test('非开源分类被正确识别，并触发错误级提示', () => {
  const nonOpenId = Object.entries(ENRICHMENT.licenses).find(([, r]) => r.category && NON_OPEN_CATEGORIES.has(r.category))?.[0];
  assert.ok(nonOpenId, '补充数据里应当存在非开源分类的条目');
  assert.equal(isNonOpenCategory(ENRICHMENT.licenses[nonOpenId].category), true);
  const { spec, result } = build(nonOpenId);
  assert.equal(spec.nonOpen, true);
  const errors = result.notices.filter((n) => n.level === 'error');
  assert.ok(
    errors.some((n) => n.zh.includes('不是一个开源许可证')),
    '非开源许可证必须给出错误级提示',
  );
});

test('被 OSI 标记 superseded 的许可证会收到警告', () => {
  const supersededId = Object.entries(ENRICHMENT.licenses).find(([, r]) => r.osiKeywords?.includes('superseded'))?.[0];
  assert.ok(supersededId, '补充数据里应当存在 superseded 条目');
  const { result } = build(supersededId);
  assert.ok(
    result.notices.some((n) => n.zh.includes('superseded') || n.zh.includes('被取代')),
    'superseded 必须给出提示',
  );
});

/* ------------------------------------------------------------------ *
 * 兼容性查询
 * ------------------------------------------------------------------ */

test('兼容性查询：双向都能取到判定', () => {
  const forward = compatibilityOf(ENRICHMENT, 'MIT', 'Apache-2.0');
  assert.ok(forward, 'MIT × Apache-2.0 应当有判定');
  assert.ok(['Yes', 'Same'].includes(forward.verdict), `MIT × Apache-2.0 应为可组合，实际 ${forward.verdict}`);
  // 反向至少有一个方向能取到
  const reverse = compatibilityOf(ENRICHMENT, 'Apache-2.0', 'MIT');
  assert.ok(reverse);
});

test('已知的经典不兼容组合必须被判为 No', () => {
  // Apache-2.0 与 GPL-2.0-only 的专利条款冲突是教科书级案例
  const conflict = compatibilityOf(ENRICHMENT, 'Apache-2.0', 'GPL-2.0-only');
  assert.ok(conflict, 'Apache-2.0 × GPL-2.0-only 应当有判定');
  assert.equal(conflict.verdict, 'No', 'Apache-2.0 与 GPL-2.0-only 不应被判为可组合');
});

test('不确定的判定不被伪装成确定（Unknown 与 Check dependency 原样保留）', () => {
  const agpl = compatibilityOf(ENRICHMENT, 'AGPL-3.0-only', 'GPL-3.0-only');
  assert.ok(agpl);
  assert.ok(
    ['Unknown', 'Check dependency', 'Yes', 'No'].includes(agpl.verdict),
    'AGPL 与 GPLv3 的判定应当是矩阵给出的原始值之一',
  );
  assert.ok(agpl.note.zh.length > 0, '每种判定都要有说明文案');
});

test('不兼容清单只包含 No，且不包含自身', () => {
  const list = knownIncompatibilities(ENRICHMENT, 'Apache-2.0');
  assert.ok(list.length > 0, 'Apache-2.0 应当存在不兼容项');
  assert.ok(list.every((x) => x.verdict === 'No'));
  assert.ok(!list.some((x) => x.id === 'Apache-2.0'));
});

test('没有矩阵数据时查询返回 null，而不是编造结论', () => {
  assert.equal(compatibilityOf(null, 'MIT', 'Apache-2.0'), null);
  assert.equal(compatibilityOf(ENRICHMENT, 'MulanPSL-2.0', 'MIT'), null, '木兰不在矩阵里，应返回 null');
  assert.deepEqual(knownIncompatibilities(null, 'MIT'), []);
});

/* ------------------------------------------------------------------ *
 * 生成产物里的义务提示
 * ------------------------------------------------------------------ */

test('源码披露义务会被写进生成提示（用大白话）', () => {
  const withObligation = Object.entries(ENRICHMENT.licenses).find(([, r]) => r.sourceDisclosure && r.sourceDisclosure !== 'No')?.[0];
  assert.ok(withObligation, '应当存在有源码披露义务的许可证');
  const { result } = build(withObligation);
  assert.ok(
    result.notices.some((n) => n.zh.includes('把源码一起给别人')),
    '有披露义务时必须提示，而且要说人话，不能只丢一句"源码披露义务"',
  );
});

test('copyleft 判定为非 No 时会提示"你开源我也开源"', () => {
  const copyleftId = Object.entries(ENRICHMENT.licenses).find(([, r]) => r.copyleft && r.copyleft !== 'No')?.[0];
  assert.ok(copyleftId, '应当存在 copyleft 判定');
  const { result } = build(copyleftId);
  assert.ok(result.notices.some((n) => n.zh.includes('你开源我也开源')));
  // 术语可以放在括号里做对照，但不能只丢一个 copyleft 给用户
  assert.ok(
    result.notices.some((n) => /你开源我也开源/.test(n.zh) && /copyleft/i.test(n.zh)),
    '白话说法与原始判定值应当同时给出',
  );
});

test('补充数据缺失时生成仍然成功（第三方数据不是硬依赖）', () => {
  const spec = resolveSpec('MIT', SNAPSHOT, TEXTS);
  assert.ok(spec);
  assert.equal(spec.category, undefined);
  const result = generate({ spec, options: options(), licenseText: TEXTS.licenses.MIT, languages: [] });
  assert.ok(result.files.some((f) => f.path === 'LICENSE'));
  assert.equal(result.leftoverPlaceholders.length, 0);
});

test('归属方与出处信息可被界面取到（ScanCode 未给出 owner 时如实为空）', () => {
  const withOwner = Object.entries(ENRICHMENT.licenses).find(([, r]) => r.owner)?.[0];
  if (withOwner) {
    const { spec } = build(withOwner);
    assert.ok(spec.owner && spec.owner.length > 0);
    assert.equal(spec.categorySource, 'ScanCode LicenseDB');
  } else {
    // ScanCode 的 owner 字段大量为 "Unspecified"（构建期被剔除），
    // 这种情况下必须如实为空，而不是编一个归属方出来。
    const { spec } = build('MIT');
    assert.equal(spec.owner, undefined);
    assert.equal(spec.categorySource, 'ScanCode LicenseDB', '分类来源仍应标注');
  }
});
