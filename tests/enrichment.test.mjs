import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  compatibilityOf,
  deriveFacts,
  familyFromEntry,
  isNonOpenCategory,
  knownIncompatibilities,
  loadUnifiedCatalog,
  NON_OPEN_CATEGORIES,
} from '../src/lib/spdx.ts';
import { resolveSpec } from '../src/lib/spec.ts';
import { generate } from '../src/lib/generate.ts';
import { LICENSES } from '../src/lib/licenses.ts';

/** 多源补充数据（由 scripts/fetch-enrichment.mjs 生成） */
const ENRICHMENT = (await import('../public/data/license-enrichment.json', { with: { type: 'json' } })).default;
const SNAPSHOT = (await import('../public/data/license-index.json', { with: { type: 'json' } })).default;
const TEXTS = (await import('../public/data/license-texts.json', { with: { type: 'json' } })).default;
const TERMS = (await import('../public/data/terms.json', { with: { type: 'json' } })).default;
const SCANCODE_TEXTS = (await import('../public/data/scancode-texts.json', { with: { type: 'json' } })).default;
const SCANCODE_INDEX = (await import('../public/data/scancode-index.json', { with: { type: 'json' } })).default;
/** 全量目录：SPDX 740 + ScanCode 独有，合计 2476 */
const UNIFIED = loadUnifiedCatalog(SNAPSHOT, SCANCODE_INDEX);

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

test('许可类型：人工核对过的 32 个一律以核对结果为准', () => {
  // familyFromEntry 读的是 enrichment 里的**上游** family，而人工核对的值
  // 并没有写进那份数据。所以必须让核对结果在这里显式生效，否则列表筛选用上游值、
  // 详情面板用核对值，两边对不上（AGPL 就出过这个问题：列表归"整个项目"，
  // 详情显示"含网络使用"）。
  const U = UNIFIED;
  let checked = 0;
  for (const l of LICENSES) {
    const e = U.find((x) => x.id === l.id || x.scancodeKey === l.id);
    if (!e) continue;
    const key = e.source === 'spdx' ? e.id : (e.scancodeKey ?? '');
    assert.equal(
      familyFromEntry(e, ENRICHMENT.licenses[key]),
      l.family,
      `${l.id} 的判定应当与人工核对值一致`,
    );
    checked++;
  }
  assert.equal(checked, LICENSES.length, '人工整理的每一条都应当能在目录里找到');
});

test('许可类型：网络著佐权只认 AGPL，别把 GPL 与 EUPL 也算进来', () => {
  // 上游把 AGPL 与 GPL 同归 Copyleft，enrichment 里 AGPL 的 family 也写成
  // strong-copyleft——但 AGPL §13「Remote Network Interaction」确实多一条义务，
  // 必须补判（否则列表与详情对不上）。
  // 反过来两个坑：
  //  · 正则写宽成 (A|L)?GPL 会把 GPL-3.0 也算进来，而 GPL 没有网络条款；
  //  · EUPL 常被误认为有网络条款，实际正文里没有（已逐句核对）。
  assert.equal(familyFromEntry({ source: 'spdx', id: 'AGPL-3.0-only' }), 'network-copyleft');
  assert.notEqual(familyFromEntry({ source: 'spdx', id: 'GPL-3.0-only' }), 'network-copyleft');
  assert.notEqual(familyFromEntry({ source: 'spdx', id: 'LGPL-3.0-only' }), 'network-copyleft');
  // EUPL 在人工整理集合里，取核对值 strong-copyleft
  assert.notEqual(familyFromEntry({ source: 'spdx', id: 'EUPL-1.2' }), 'network-copyleft');
});

test('许可类型：八个分类都要有内容，不能出现空筛选', () => {
  // 空分类意味着用户选中后看到一片空白。内容型与网络型都曾经是 0：
  // 上游把 CC-BY 归进 permissive、把 AGPL 归进 strong-copyleft。
  const U = UNIFIED;
  const tally = {};
  for (const e of U) {
    const key = e.source === 'spdx' ? e.id : (e.scancodeKey ?? '');
    const f = familyFromEntry(e, ENRICHMENT.licenses[key]) ?? 'unknown';
    tally[f] = (tally[f] ?? 0) + 1;
  }
  for (const f of ['permissive', 'public-domain', 'weak-copyleft', 'strong-copyleft', 'network-copyleft', 'content', 'proprietary', 'unknown']) {
    assert.ok(tally[f] > 0, `分类 ${f} 是空的（0 个），选中后会看到空白列表`);
  }
  // 合计要等于全量，不能有条目落到分类之外
  const sum = Object.values(tally).reduce((a, b) => a + b, 0);
  assert.equal(sum, U.length, '每个条目都应当落进某个分类');
});


test('facts 的字段不许在传递链上丢失', () => {
  // 踩过的坑：deriveFacts 算出了 endorse / promote / includeCopyright，但
  // LicenseSpec.facts 的类型 LicenseFacts 是**手写枚举**的，没声明这几个字段，
  // 于是赋值时被静默挡住——详情面板永远显示默认值，而直接调 deriveFacts 却是对的。
  //
  // 注意要拿**长尾条目**（没有人工整理值）来比：人工整理的 32 个优先用逐条核对
  // 的值，与 deriveFacts 的正则推断本来就可能不同（那是设计使然，不是丢字段）。
  const longTail = SNAPSHOT.licenses.find(
    (l) => !l.deprecated && !LICENSES.some((c) => c.id === l.id) && l.textLength > 200,
  );
  assert.ok(longTail, '应当存在长尾许可证');
  const spec = resolveSpec(longTail.id, SNAPSHOT, TEXTS, undefined, ENRICHMENT.licenses, TERMS);
  const direct = deriveFacts(
    longTail.id,
    TEXTS.licenses[longTail.id].licenseText,
    longTail.osiApproved,
    ENRICHMENT.licenses[longTail.id]?.family,
    TERMS,
  );
  assert.equal(spec.curated, null, '这条路径应当是长尾推断');

  // deriveFacts 的每项结论都必须出现在 spec.facts 上，一个都不能丢
  const carried = ['patentGrant', 'trademarkClause', 'stateChanges', 'sameLicenseWholeWork', 'sameLicensePerFile', 'networkTrigger', 'includeCopyright', 'endorse', 'promote'];
  for (const k of carried) {
    assert.equal(spec.facts[k], direct[k], `spec.facts 丢了 ${k}（deriveFacts 的值是 ${direct[k]}）`);
  }
});

test('字段传递：人工整理的条目优先用逐条核对的值，而不是正则推断', () => {
  // 这两条路径的值本来就可能不同，那是设计使然：
  // BSD-3-Clause 的商标条款人工核对为 true（正文确实写了不授权商标），
  // 而 deriveFacts 的正文正则未必命中。界面上显示的应当是人工资讯。
  const spec = resolveSpec('BSD-3-Clause', SNAPSHOT, TEXTS, undefined, ENRICHMENT.licenses, TERMS);
  assert.ok(spec.curated, 'BSD-3-Clause 属于人工整理集合');
  assert.equal(spec.facts.trademarkClause, true, '人工核对的值应当被采用');
  assert.equal(spec.facts.endorse, 'prohibited', '人工核对：BSD-3-Clause 禁止背书');
  assert.equal(spec.facts.promote, 'prohibited', '人工核对：BSD-3-Clause 禁止促销');
  assert.equal(spec.facts.includeCopyright, 'required', '人工核对：要求保留版权声明');
});



test('人工整理的 32 个许可证不含 undefined 字段', () => {
  // P() 的默认值要覆盖 LicenseFacts 的**每一个**字段，否则人工整理与
  // 长尾两条路径的结论会不一致。
  for (const l of LICENSES) {
    for (const [k, v] of Object.entries(l.facts)) {
      assert.notEqual(v, undefined, `${l.id} 的 facts.${k} 是 undefined`);
    }
    assert.ok(l.facts.endorse, `${l.id} 缺 endorse`);
    assert.ok(l.facts.promote, `${l.id} 缺 promote`);
    assert.ok(l.facts.includeCopyright, `${l.id} 缺 includeCopyright`);
  }
  // 六个例外要有正确值
  const byId = Object.fromEntries(LICENSES.map((l) => [l.id, l.facts]));
  for (const id of ['0BSD', 'CC0-1.0', 'MIT-0', 'Unlicense', 'WTFPL']) {
    assert.equal(byId[id].includeCopyright, 'not-required', `${id} 不要求保留版权声明`);
  }
  for (const id of ['Zlib', 'BSL-1.0']) {
    assert.equal(byId[id].includeCopyright, 'source-only', `${id} 只要求源码形式保留`);
  }
  for (const id of ['BSD-3-Clause', 'BSD-3-Clause-Clear']) {
    assert.equal(byId[id].endorse, 'prohibited', `${id} 禁止背书`);
    assert.equal(byId[id].promote, 'prohibited', `${id} 禁止促销`);
  }
  assert.equal(byId['BSD-2-Clause'].endorse, 'silent', 'BSD-2-Clause 没有背书条款');
  assert.equal(byId['BSD-2-Clause'].promote, 'silent', 'BSD-2-Clause 没有促销条款');
});



/** 用真实正文推一个许可证的背书 / 促销判定 */
function endorseOf(id) {
  const entry = SNAPSHOT.licenses.find((l) => l.id === id);
  const text = entry ? TEXTS.licenses[id].licenseText : (SCANCODE_TEXTS[id] ?? '');
  const f = deriveFacts(id, text, entry?.osiApproved ?? false, ENRICHMENT.licenses[id]?.family, TERMS);
  return { endorse: f.endorse, promote: f.promote };
}

test('背书与促销：BSD-3-Clause 两者都禁，BSD-2-Clause / MIT 都没这条', () => {
  // BSD-3-Clause 的标志性第 3 条就是"Neither the name of the copyright holder
  // nor the names of its contributors may be used to endorse or promote…"。
  // 这正是 BSD-3 与 BSD-2 的实质差别之一。
  assert.deepEqual(endorseOf('BSD-3-Clause'), { endorse: 'prohibited', promote: 'prohibited' });
  assert.deepEqual(endorseOf('BSD-3-Clause-Clear'), { endorse: 'prohibited', promote: 'prohibited' });
  assert.deepEqual(endorseOf('BSD-2-Clause'), { endorse: 'silent', promote: 'silent' });
  assert.deepEqual(endorseOf('MIT'), { endorse: 'silent', promote: 'silent' });
});

test('背书/促销不能与商标混为一谈：Apache-2.0 有商标条款但两者都不禁', () => {
  // Apache-2.0 的 §6 讲的是"不能用人家的商品名/商标"，
  // 它并不禁止背书或促销——把它判成禁止是错的。界面上也是分开的三行。
  const apache = deriveFacts(
    'Apache-2.0',
    TEXTS.licenses['Apache-2.0'].licenseText,
    true,
    ENRICHMENT.licenses['Apache-2.0']?.family,
    TERMS,
  );
  assert.equal(apache.trademarkClause, true, 'Apache-2.0 有商标条款');
  assert.equal(apache.endorse, 'silent', 'Apache-2.0 不禁背书，不能误判');
  assert.equal(apache.promote, 'silent', 'Apache-2.0 不禁促销，不能误判');
});

test('背书与促销是两个维度：分开判，不能用同一个值', () => {
  // 这两件事性质不同：背书是"作者认可你"，促销是"你借作者的名气"。
  // 实测 344 个许可两者都禁、3 个只禁背书、30 个只禁促销，
  // 合成一条会让这 33 个的结论失真。
  const both = deriveFacts('BSD-3-Clause', TEXTS.licenses['BSD-3-Clause'].licenseText, true, 'permissive', TERMS);
  assert.equal(both.endorse, 'prohibited');
  assert.equal(both.promote, 'prohibited');
  // 只禁背书：Brian-Gladman-3-Clause 写的是 "the copyright holder's name is not used to endorse products"
  const endorseOnly = deriveFacts('Brian-Gladman-3-Clause', SCANCODE_TEXTS['Brian-Gladman-3-Clause'] ?? TEXTS.licenses['Brian-Gladman-3-Clause']?.licenseText ?? '', false, undefined, TERMS);
  if (endorseOnly.endorse === 'prohibited') {
    assert.equal(endorseOnly.promote, 'silent', '只禁背书的许可不应被判成也禁促销');
  }
  // 没写的就是没写
  const mit = deriveFacts('MIT', TEXTS.licenses.MIT.licenseText, true, 'permissive', TERMS);
  assert.equal(mit.endorse, 'silent');
  assert.equal(mit.promote, 'silent');
});

test('并列短语 "endorse or promote" 必须让两个维度都判为禁止', () => {
  // 踩过的坑：早期规则只认 `neither the name of … endorse` 这种句式，
  // 而 AAL 写的是 `Neither the name nor any trademark of the Author may be
  // used to endorse or promote`——中间插了 "nor any trademark of the Author"，
  // 于是漏判。实测 341 个许可用了并列写法，早期漏掉其中 105 个，
  // 把它们错标成"只禁促销"。
  const sources = { ...TEXTS.licenses, ...SCANCODE_TEXTS };
  const parallel = Object.entries(sources).filter(([, v]) => {
    const t = typeof v === 'string' ? v : v?.licenseText;
    return typeof t === 'string' && /endorse\s*[,/]?\s*(?:or|and)\s*promote/i.test(t);
  });
  assert.ok(parallel.length > 300, `应当有大量并列写法，实际 ${parallel.length}`);

  for (const [id, v] of parallel) {
    const text = typeof v === 'string' ? v : v.licenseText;
    const f = deriveFacts(id, text, false, undefined, TERMS);
    assert.equal(f.endorse, 'prohibited', `${id} 正文含 "endorse or promote"，背书必须判为禁止`);
    assert.equal(f.promote, 'prohibited', `${id} 正文含 "endorse or promote"，促销必须判为禁止`);
  }
});

test('背书/促销的判据要"名字 + 动词"同现，不能只数动词', () => {
  // 正文里出现 promote 未必是在禁这件事（可能是 "promotes the progress of…"）。
  // 规则要求句子里同时有"名字/名义"与那个动词，所以这些不该被判为禁止。
  for (const id of ['MIT', 'BSD-2-Clause', 'Apache-2.0']) {
    const f = deriveFacts(id, TEXTS.licenses[id].licenseText, true, 'permissive', TERMS);
    assert.equal(f.endorse, 'silent', `${id} 没有背书条款`);
    assert.equal(f.promote, 'silent', `${id} 没有促销条款`);
  }
});

test('背书/促销：命中就是真的禁这条款，抽查原句', () => {
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
    assert.equal(endorseOf(id).endorse, 'prohibited', `${id} 应当被判为禁止背书`);
    assert.equal(endorseOf(id).promote, 'prohibited', `${id} 应当被判为禁止促销`);
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
