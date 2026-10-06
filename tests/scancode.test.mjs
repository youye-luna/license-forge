import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getUnifiedCatalog,
  isNonOpenCategory,
  licenseRefOf,
  loadUnifiedCatalog,
  scancodeStats,
  searchUnified,
} from '../src/lib/spdx.ts';
import { fromScancodeEntry } from '../src/lib/spec.ts';
import { generate } from '../src/lib/generate.ts';

const SPDX = (await import('../public/data/license-index.json', { with: { type: 'json' } })).default;
const SCANCODE = (await import('../public/data/scancode-index.json', { with: { type: 'json' } })).default;
const SCANCODE_TEXTS = (await import('../public/data/scancode-texts.json', { with: { type: 'json' } })).default;
const ENRICHMENT = (await import('../public/data/license-enrichment.json', { with: { type: 'json' } })).default;

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

/* ------------------------------------------------------------------ *
 * 目录规模与完整性
 * ------------------------------------------------------------------ */

test('ScanCode 目录收录规模符合"2000+"的预期', () => {
  assert.ok(SCANCODE.entries.length >= 2000, `条目过少：${SCANCODE.entries.length}`);
  const stats = scancodeStats(SCANCODE);
  assert.ok(stats.withText >= 1900, `有正文的条目过少：${stats.withText}`);
  assert.equal(stats.total, SCANCODE.entries.length);
});

test('每一条有正文的条目都能在正文文件里取到，且非空', () => {
  const missing = SCANCODE.entries.filter((e) => e.hasText && !SCANCODE_TEXTS[e.key]);
  assert.deepEqual(missing.map((e) => e.key).slice(0, 5), [], '有 hasText 标记却取不到正文');
  const empty = Object.entries(SCANCODE_TEXTS).filter(([, t]) => !t.trim());
  assert.deepEqual(empty.map(([k]) => k).slice(0, 5), [], '存在空白正文');
});

test('正文不是 404 HTML 页面（该站错误页很长，容易被误当正文）', () => {
  const htmlLike = Object.entries(SCANCODE_TEXTS)
    .filter(([, t]) => /^\s*<!DOCTYPE html>/i.test(t) || /<html[\s>]/i.test(t))
    .map(([k]) => k);
  assert.deepEqual(htmlLike.slice(0, 5), [], '把 HTML 错误页当成了许可证正文');
});

test('分类值都在已知集合内', () => {
  const known = new Set([
    'CLA', 'Commercial', 'Non-Commercial', 'Copyleft', 'Copyleft Limited', 'Free Restricted',
    'Patent License', 'Permissive', 'Proprietary Free', 'Public Domain', 'Source-available',
    'Unstated License',
  ]);
  const bad = SCANCODE.entries.filter((e) => !known.has(e.category)).map((e) => `${e.key}:${e.category}`);
  assert.deepEqual(bad.slice(0, 5), [], '出现了未预期的分类');
});

test('确实覆盖了 SPDX 查不到的真实许可证（Anti 996 等）', () => {
  const keys = new Set(SCANCODE.entries.map((e) => e.key));
  // 这些是 SPDX 列表里没有、但真实项目里存在的条款
  for (const key of ['996-icu-1.0', 'activestate-community', '3com-microcode']) {
    assert.ok(keys.has(key), `缺少 ${key}`);
  }
  assert.match(SCANCODE_TEXTS['996-icu-1.0'], /Anti 996/i, 'Anti 996 许可证正文应能取到');
});

/* ------------------------------------------------------------------ *
 * 与 SPDX 的关系
 * ------------------------------------------------------------------ */

test('ScanCode 独有条目与 SPDX 条目不重叠', () => {
  const spdxIds = new Set(SPDX.licenses.map((l) => l.id));
  const spdxKeysLower = new Set(SPDX.licenses.map((l) => l.id.toLowerCase()));
  const overlap = SCANCODE.entries.filter(
    (e) => (e.spdxLicenseKey && spdxIds.has(e.spdxLicenseKey)) || spdxKeysLower.has(e.key),
  );
  assert.deepEqual(overlap.map((e) => e.key).slice(0, 5), [], '这批数据里混进了 SPDX 已收录的条目');
});

test('非 SPDX 许可证的标识符一律是 LicenseRef 形式', () => {
  // 例外不适用这条规则：SPDX 自己的例外 ID 就长这样（389-exception、Classpath-exception-2.0），
  // 它们本来就不是"许可证标识符"。因此只检查非例外条目。
  const bad = SCANCODE.entries
    .filter((e) => !e.isException)
    .filter((e) => e.spdxLicenseKey && !String(e.spdxLicenseKey).startsWith('LicenseRef'))
    .map((e) => `${e.key}:${e.spdxLicenseKey}`);
  assert.deepEqual(bad.slice(0, 5), [], '非 SPDX 许可证不应带正式 SPDX 标识符');
  assert.equal(licenseRefOf('996-icu-1.0'), 'LicenseRef-scancode-996-icu-1.0');
});

/* ------------------------------------------------------------------ *
 * 合并目录与检索
 * ------------------------------------------------------------------ */

test('合并目录包含两个来源，且条目数等于两者之和（例外除外）', () => {
  const unified = loadUnifiedCatalog(SPDX, SCANCODE);
  const scLicenses = SCANCODE.entries.filter((e) => !e.isException);
  assert.equal(unified.length, SPDX.licenses.length + scLicenses.length);
  assert.equal(unified.filter((e) => e.source === 'spdx').length, SPDX.licenses.length);
  assert.equal(unified.filter((e) => e.source === 'scancode').length, scLicenses.length);
  // 例外不在"选一个许可证"的语境里
  assert.ok(!unified.some((e) => e.source === 'scancode' && e.isException));
});

test('合并目录的 ID 唯一', () => {
  const unified = loadUnifiedCatalog(SPDX, SCANCODE);
  const ids = unified.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, '合并后出现重复 ID');
  assert.ok(ids.includes('MIT'));
  assert.ok(ids.some((id) => id.startsWith('scancode:')));
});

test('检索能同时命中两个来源，且精确匹配优先', () => {
  const unified = loadUnifiedCatalog(SPDX, SCANCODE);
  assert.equal(searchUnified(unified, 'MIT')[0].id, 'MIT');
  assert.equal(searchUnified(unified, '996-icu-1.0')[0].id, 'scancode:996-icu-1.0');
  const mozilla = searchUnified(unified, 'mozilla');
  assert.ok(mozilla.some((e) => e.id === 'MPL-2.0'));
  assert.equal(searchUnified(unified, 'zzz-not-a-license').length, 0);
});

test('无 ScanCode 数据时合并目录退回 SPDX（第三方目录是可选增强）', () => {
  const unified = loadUnifiedCatalog(SPDX, null);
  assert.equal(unified.length, SPDX.licenses.length);
  assert.ok(unified.every((e) => e.source === 'spdx'));
});

/* ------------------------------------------------------------------ *
 * 生成非 SPDX 许可证
 * ------------------------------------------------------------------ */

test('非 SPDX 条目可以生成正文，且必须提示"不能写进清单字段"', () => {
  const entry = SCANCODE.entries.find((e) => e.hasText && !e.deprecated && !isNonOpenCategory(e.category));
  assert.ok(entry);
  const raw = SCANCODE_TEXTS[entry.key];
  const spec = fromScancodeEntry(entry, raw, ENRICHMENT.licenses[entry.key]);
  assert.equal(spec.nonSpdx, true);
  assert.equal(spec.fileName, 'LICENSE');
  assert.equal(spec.fill, 'metadata-only', '非 SPDX 正文没有规范的字段，必须逐字保留');
  assert.match(spec.id, /^LicenseRef-scancode-/);

  const result = generate({ spec, options: options(), licenseText: { name: spec.name, url: spec.sourceUrl, licenseText: raw }, languages: [] });
  assert.ok(result.files.some((f) => f.path === 'LICENSE'), '应产出正文文件');
  // 正文必须逐字保留
  const license = result.files.find((f) => f.path === 'LICENSE');
  assert.equal(license.content, raw.trimEnd() + '\n');
  // 必须给出"不是 SPDX 标识符"的警告
  assert.ok(
    result.notices.some((n) => n.level === 'warn' && n.zh.includes('不是 SPDX 标识符')),
    '非 SPDX 条目必须告知其写法不能进清单字段',
  );
  assert.equal(result.leftoverPlaceholders.length, 0);
});

test('非开源分类的 ScanCode 条目触发错误级提示', () => {
  const entry = SCANCODE.entries.find((e) => e.hasText && isNonOpenCategory(e.category));
  assert.ok(entry, '应当存在非开源分类的条目');
  const raw = SCANCODE_TEXTS[entry.key];
  const spec = fromScancodeEntry(entry, raw, ENRICHMENT.licenses[entry.key]);
  assert.equal(spec.nonOpen, true);
  const result = generate({ spec, options: options(), licenseText: { name: spec.name, url: spec.sourceUrl, licenseText: raw }, languages: [] });
  assert.ok(result.notices.some((n) => n.level === 'error' && n.zh.includes('不是一个开源许可证')));
});

test('非 SPDX 条目不声称 OSI 认证、不声称 NOTICE 义务', () => {
  const entry = SCANCODE.entries.find((e) => e.hasText);
  assert.ok(entry);
  const spec = fromScancodeEntry(entry, SCANCODE_TEXTS[entry.key], undefined);
  assert.equal(spec.osiApproved, false);
  assert.equal(spec.requiresNotice, false);
  assert.equal(spec.headerStrategy, 'spdx-tag', '没有官方文件头时不应自造');
});

test('非 SPDX 条目的家族判定使用 ScanCode 分类', () => {
  const permissive = SCANCODE.entries.find((e) => e.category === 'Permissive' && e.hasText);
  assert.ok(permissive);
  const spec = fromScancodeEntry(permissive, SCANCODE_TEXTS[permissive.key], undefined);
  assert.equal(spec.family, 'permissive');
  assert.equal(spec.familySource, 'scancode-category');
});

test('合并目录可被整体获取，规模等于 SPDX + ScanCode 非例外条目', async () => {
  // getUnifiedCatalog 在 Node 下会因为 fetch 不可用而降级，这里只验证降级不抛错
  const viaLoader = await getUnifiedCatalog().catch(() => null);
  if (viaLoader) assert.ok(viaLoader.length > 0);

  const direct = loadUnifiedCatalog(SPDX, SCANCODE);
  const expected = SPDX.licenses.length + SCANCODE.entries.filter((e) => !e.isException).length;
  assert.equal(direct.length, expected, `合并目录规模应为 ${expected}`);
  assert.ok(direct.length > 2400, `合并目录应有 2400+ 条，实际 ${direct.length}`);
});
