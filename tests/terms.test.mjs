import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveFacts, lookupTerms } from '../src/lib/spdx.ts';
import { resolveSpec } from '../src/lib/spec.ts';
import { generate } from '../src/lib/generate.ts';

const TERMS = (await import('../public/data/terms.json', { with: { type: 'json' } })).default;
const SPDX = (await import('../public/data/license-index.json', { with: { type: 'json' } })).default;
const TEXTS = (await import('../public/data/license-texts.json', { with: { type: 'json' } })).default;
const ENRICHMENT = (await import('../public/data/license-enrichment.json', { with: { type: 'json' } })).default;

function options(overrides = {}) {
  return {
    lang: 'zh',
    copyright: { holders: [{ name: 'Acme Inc.', from: '2024' }], projectName: 'widget', symbolStyle: 'word', joiner: 'newline' },
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

/* ------------------------------------------------------------------ *
 * 词表与数据完整性
 * ------------------------------------------------------------------ */

test('词表三段齐全，且每个标签都有 tag / label / description', () => {
  // rules.yml 是本项目唯一能拿到"条款字段"定义的来源，必须完整
  assert.equal(TERMS.vocabulary.permissions.length, 5);
  assert.equal(TERMS.vocabulary.conditions.length, 8);
  assert.equal(TERMS.vocabulary.limitations.length, 4);
  for (const [section, tags] of Object.entries(TERMS.vocabulary)) {
    for (const t of tags) {
      assert.ok(t.tag, `${section} 里有一个标签缺 tag`);
      assert.ok(t.label, `${section}/${t.tag} 缺 label`);
      assert.ok(t.description, `${section}/${t.tag} 缺 description`);
    }
  }
});

test('覆盖 47 个许可证，且每个都带 derived 字段', () => {
  assert.equal(TERMS.coverage.matched, 47);
  assert.equal(Object.keys(TERMS.licenses).length, 47);
  for (const [id, entry] of Object.entries(TERMS.licenses)) {
    assert.ok(entry.derived, `${id} 缺 derived`);
    assert.ok(['explicit', 'none', 'silent'].includes(entry.derived.patentGrant), `${id} 的 patentGrant 取值异常`);
    assert.ok(Array.isArray(entry.permissions) && Array.isArray(entry.conditions) && Array.isArray(entry.limitations));
  }
});

test('patent-use 的同名反义必须按段区分（关键陷阱）', () => {
  // Apache-2.0：permissions 里有 patent-use → 明确授予
  assert.ok(TERMS.licenses['Apache-2.0'].permissions.includes('patent-use'));
  assert.equal(TERMS.licenses['Apache-2.0'].derived.patentGrant, 'explicit');
  // BSD-3-Clause-Clear：limitations 里有 patent-use → 明确不授予
  assert.ok(TERMS.licenses['BSD-3-Clause-Clear'].limitations.includes('patent-use'));
  assert.equal(TERMS.licenses['BSD-3-Clause-Clear'].derived.patentGrant, 'none');
  // MIT：两边都没有 → 未提及
  assert.equal(TERMS.licenses.MIT.derived.patentGrant, 'silent');
});

test('已知答案抽样：条款字段与公认结论一致', () => {
  const expect = {
    'Apache-2.0': { patentGrant: 'explicit', trademarkClause: true, stateChanges: true, networkTrigger: false },
    MIT: { patentGrant: 'silent', trademarkClause: false, stateChanges: false, networkTrigger: false },
    'GPL-3.0': { patentGrant: 'explicit', stateChanges: true, networkTrigger: false },
    'AGPL-3.0': { patentGrant: 'explicit', networkTrigger: true },
    'MPL-2.0': { patentGrant: 'explicit', sameLicensePerFile: true, sameLicenseWholeWork: false },
    // CC0 的 limitations 里带 patent-use，即"明确不授予专利权"
    'CC0-1.0': { patentGrant: 'none', stateChanges: false, networkTrigger: false },
  };
  for (const [id, fields] of Object.entries(expect)) {
    for (const [key, value] of Object.entries(fields)) {
      assert.equal(TERMS.licenses[id].derived[key], value, `${id}.${key} 应为 ${value}`);
    }
  }
});

test('带网络触发标签的许可证只有 5 个（说明匹配没有泛化过头）', () => {
  // 上游实测为 AGPL-3.0 / CECILL-2.1 / EUPL-1.1 / EUPL-1.2 / OSL-3.0
  const withNetwork = Object.entries(TERMS.licenses).filter(([, v]) => v.derived.networkTrigger);
  assert.equal(withNetwork.length, 5, `带 network-use-disclose 的应为 5 个，实际 ${withNetwork.length}`);
  const ids = withNetwork.map(([id]) => id);
  assert.ok(ids.includes('AGPL-3.0'), 'AGPL 必须被标为网络触发');
  assert.ok(!ids.includes('GPL-3.0'), 'GPL 不应被标为网络触发');
  assert.ok(!ids.includes('Apache-2.0'), 'Apache-2.0 不应被标为网络触发');
});

/* ------------------------------------------------------------------ *
 * 标识符规范化匹配
 * ------------------------------------------------------------------ */

test('lookupTerms 能吃下 SPDX 的 -only / -or-later 写法', () => {
  // 上游写的是 GPL-3.0，SPDX 写的是 GPL-3.0-only / GPL-3.0-or-later
  assert.ok(lookupTerms(TERMS, 'GPL-3.0-only'), 'GPL-3.0-only 应能匹配到上游的 GPL-3.0');
  assert.ok(lookupTerms(TERMS, 'GPL-3.0-or-later'));
  assert.ok(lookupTerms(TERMS, 'AGPL-3.0-only'));
  assert.ok(lookupTerms(TERMS, 'LGPL-2.1-only'));
  assert.ok(lookupTerms(TERMS, 'LGPL-3.0-or-later'));
  // 精确匹配优先
  assert.equal(lookupTerms(TERMS, 'MIT').title, 'MIT License');
});

test('lookupTerms 对覆盖范围外的许可证返回 null，而不是乱猜', () => {
  // 47 个标注条目之外的常见许可证
  assert.equal(lookupTerms(TERMS, 'Beerware'), null);
  assert.equal(lookupTerms(TERMS, 'X11'), null);
  assert.equal(lookupTerms(TERMS, 'Artistic-1.0'), null);
  assert.equal(lookupTerms(null, 'MIT'), null);
});
/* ------------------------------------------------------------------ *
 * 推断层优先级
 * ------------------------------------------------------------------ */

test('有 ChooseALicense 标注时，条款字段来源标为 choosealicense', () => {
  const facts = deriveFacts('Apache-2.0', TEXTS.licenses['Apache-2.0'].licenseText, true, 'permissive', TERMS);
  assert.equal(facts.termsSource, 'choosealicense');
  assert.equal(facts.patentGrant, 'explicit');
  assert.equal(facts.stateChanges, true);
});

test('没有标注时退回正文推断，并标为 text', () => {
  // Beerware 不在 47 个标注范围内
  const id = 'Beerware';
  assert.ok(TEXTS.licenses[id], '需要 Beerware 的正文来做这个测试');
  const facts = deriveFacts(id, TEXTS.licenses[id].licenseText, false, undefined, TERMS);
  assert.equal(facts.termsSource, 'text');
});

test('人工标注能纠正正则的误判', () => {
  // MPL-2.0 的正文里有 "no patent license is granted" 的局部排除，
  // 正则曾把它判成"明确不授权"；人工标注明确写了 patent-use → explicit
  const withTerms = deriveFacts('MPL-2.0', TEXTS.licenses['MPL-2.0'].licenseText, true, 'weak-copyleft', TERMS);
  assert.equal(withTerms.patentGrant, 'explicit', 'MPL 的专利授权应取人工标注');
  assert.equal(withTerms.termsSource, 'choosealicense');
  // 不带标注时正则仍会给出推断结果（可能是错的，但会被标注为推断）
  const withoutTerms = deriveFacts('MPL-2.0', TEXTS.licenses['MPL-2.0'].licenseText, true, 'weak-copyleft');
  assert.equal(withoutTerms.termsSource, 'text');
});

/* ------------------------------------------------------------------ *
 * 生成产物
 * ------------------------------------------------------------------ */

function build(id) {
  const spec = resolveSpec(id, SPDX, TEXTS, undefined, ENRICHMENT.licenses, TERMS);
  assert.ok(spec, `${id} 应能解析出规格`);
  const result = generate({ spec, options: options(), licenseText: TEXTS.licenses[id], languages: [] });
  return { spec, result };
}

test('生成提示会说明条款字段来自人工标注还是推断', () => {
  const { result: apache } = build('Apache-2.0');
  assert.ok(
    apache.notices.some((n) => n.zh.includes('人工标注')),
    'Apache-2.0 应提示条款来自人工标注',
  );

  // 找一个既不在标注范围内、又能生成的许可证
  const outside = SPDX.licenses.find((l) => !TERMS.licenses[l.id] && l.hasText && !l.deprecated);
  assert.ok(outside, '应当存在标注范围外的许可证');
  const { result, spec } = build(outside.id);
  assert.equal(spec.termsSource, 'text');
  assert.ok(
    result.notices.some((n) => n.zh.includes('推断')),
    `${outside.id} 应提示条款为推断所得`,
  );
});

test('条款来源会写进 spec，供界面如实标注', () => {
  const { spec: apache } = build('Apache-2.0');
  assert.equal(apache.termsSource, 'choosealicense');
  const { spec: mit } = build('MIT');
  assert.equal(mit.termsSource, 'choosealicense', 'MIT 也在标注范围内');
  // out-of-range 的许可证必须标为 text
  const outside = SPDX.licenses.find((l) => !TERMS.licenses[l.id] && l.hasText && !l.deprecated);
  assert.equal(build(outside.id).spec.termsSource, 'text');
});
test('条款数据缺失时生成仍然成功（第三方数据不是硬依赖）', () => {
  const spec = resolveSpec('Apache-2.0', SPDX, TEXTS, undefined, undefined, null);
  assert.ok(spec);
  assert.equal(spec.termsSource, 'text', '没有标注时应如实标为推断');
  const result = generate({ spec, options: options(), licenseText: TEXTS.licenses['Apache-2.0'], languages: [] });
  assert.ok(result.files.some((f) => f.path === 'LICENSE'));
});
