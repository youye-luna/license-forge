import test from 'node:test';
import assert from 'node:assert/strict';

import { generate } from '../src/lib/generate.ts';
import { resolveSpec, expressionOf } from '../src/lib/spec.ts';
import { DEPRECATED_IDS, LICENSES } from '../src/lib/licenses.ts';
import { formatHolderLine, formatYears, renderComment, fillTemplatePlaceholders, fileHeader, hasCopyrightPlaceholder, fillLicenseText, templateLeftovers } from '../src/lib/fill.ts';
import {
  catalogStats,
  deriveFacts,
  fromSpdxExceptionDetail,
  fromSpdxExceptionList,
  fromSpdxLicenseDetail,
  fromSpdxLicenseList,
  searchCatalog,
} from '../src/lib/spdx.ts';

/**
 * 全量快照与正文数据来自 SPDX 官方 JSON API（见 scripts/fetch-spdx.mjs）。
 * 测试直接读构建产物，确保"上游数据 → 站点数据"这条链路没有走样。
 */
const SNAPSHOT = (await import('../public/data/license-index.json', { with: { type: 'json' } })).default;
const TEXTS = (await import('../public/data/license-texts.json', { with: { type: 'json' } })).default;

function options(overrides = {}) {
  return {
    lang: 'zh',
    copyright: {
      holders: [{ name: 'Acme Inc.', from: '2020', to: '2024' }],
      projectName: 'widget',
      projectDescription: 'a tiny widget',
      symbolStyle: 'word',
      joiner: 'newline',
    },
    languageId: 'c',
    manifests: ['package.json'],
    includeNotice: false,
    includeFileHeader: true,
    includeReadme: true,
    includeReuseLayout: false,
    thirdParty: 'lodash — John-David Dalton — MIT',
    contactEmail: 'legal@example.com',
    repoUrl: 'https://example.com/widget',
    ...overrides,
  };
}

/** 走真实链路：目录 + 正文 → 规格 → 生成 */
function build(id, opts = options(), exceptionId) {
  const spec = resolveSpec(id, SNAPSHOT, TEXTS, exceptionId);
  assert.ok(spec, `${id} 应当能解析出规格`);
  const result = generate({
    spec,
    options: opts,
    licenseText: TEXTS.licenses[id],
    exceptionText: exceptionId ? TEXTS.exceptions[exceptionId] : undefined,
    languages: [],
  });
  return { spec, result, get: (path) => result.files.find((f) => f.path === path) };
}

/* ------------------------------------------------------------------ *
 * 全量数据完整性
 * ------------------------------------------------------------------ */

test('全量快照来自 SPDX 官方 API，且覆盖完整', () => {
  const stats = catalogStats(SNAPSHOT);
  assert.ok(stats.licenses >= 700, `许可证数量异常：${stats.licenses}`);
  assert.ok(stats.exceptions >= 80, `例外数量异常：${stats.exceptions}`);
  assert.match(SNAPSHOT.licenseListVersion, /^\d+\.\d+\.\d+$/);
  assert.match(SNAPSHOT.generatedFrom, /spdx\/license-list-data/);
});

test('每一个许可证都有正文字段（不允许出现空壳条目）', () => {
  const missing = SNAPSHOT.licenses.filter((l) => !l.hasText || l.textLength === 0);
  assert.deepEqual(missing.map((l) => l.id), [], '存在没有正文的许可证');
  const missingTexts = SNAPSHOT.licenses.filter((l) => !TEXTS.licenses[l.id]?.licenseText);
  assert.deepEqual(missingTexts.map((l) => l.id), [], '正文文件里缺少对应条目');
});

test('每一个例外都有正文，且字段名映射正确（上游用 licenseExceptionText）', () => {
  const missing = SNAPSHOT.exceptions.filter((e) => !TEXTS.exceptions[e.id]?.licenseText);
  assert.deepEqual(missing.map((e) => e.id), [], '例外正文缺失');
  const sample = TEXTS.exceptions['Classpath-exception-2.0'];
  assert.ok(sample, 'Classpath-exception-2.0 应当存在');
  // 例外正文里并不出现 "Classpath" 这个词（文件名与正文用词无关），这里按实际内容断言
  assert.match(sample.licenseText, /Linking this library statically or dynamically/);
});

test('官方文件头模板被完整保留下来（这是权威措辞的来源）', () => {
  const stats = catalogStats(SNAPSHOT);
  assert.ok(stats.withOfficialHeader >= 80, `官方头模板太少：${stats.withOfficialHeader}`);
  const withHeaderInTexts = Object.values(TEXTS.licenses).filter((t) => t.standardLicenseHeader).length;
  assert.equal(withHeaderInTexts, stats.withOfficialHeader, '索引与正文里的官方头统计不一致');
});

test('SPDX 列表解析函数能还原官方 JSON（可复用于实时 API）', () => {
  const rawList = {
    licenseListVersion: '3.29.0',
    licenses: [
      {
        reference: 'https://spdx.org/licenses/MIT.html',
        isDeprecatedLicenseId: false,
        detailsUrl: 'https://spdx.org/licenses/MIT.json',
        name: 'MIT License',
        licenseId: 'MIT',
        seeAlso: ['https://opensource.org/license/MIT'],
        isOsiApproved: true,
        isFsfLibre: true,
      },
    ],
  };
  const parsed = fromSpdxLicenseList(rawList);
  assert.deepEqual(parsed, [
    {
      id: 'MIT',
      name: 'MIT License',
      deprecated: false,
      osiApproved: true,
      fsfLibre: true,
      hasText: true,
      textLength: 0,
      hasOfficialHeader: false,
      seeAlso: ['https://opensource.org/license/MIT'],
    },
  ]);

  const detail = fromSpdxLicenseDetail({
    isDeprecatedLicenseId: false,
    name: 'MIT License',
    licenseId: 'MIT',
    licenseText: 'X',
    standardLicenseHeader: '  Copyright (C) <year> <name of author>  ',
    isOsiApproved: true,
  });
  assert.equal(detail.standardLicenseHeader, 'Copyright (C) <year> <name of author>');
  assert.equal(detail.url, 'https://spdx.org/licenses/MIT.html');

  const exc = fromSpdxExceptionDetail({
    isDeprecatedLicenseId: false,
    name: 'Classpath exception',
    licenseExceptionId: 'Classpath-exception-2.0',
    licenseExceptionText: 'Linking this library statically...',
  });
  assert.equal(exc.licenseText, 'Linking this library statically...');

  const excList = fromSpdxExceptionList({
    licenseListVersion: '3.29.0',
    exceptions: [
      {
        reference: 'https://spdx.org/licenses/Classpath-exception-2.0.html',
        isDeprecatedLicenseId: false,
        detailsUrl: 'https://spdx.org/licenses/Classpath-exception-2.0.json',
        name: 'Classpath exception 2.0',
        licenseExceptionId: 'Classpath-exception-2.0',
        seeAlso: [],
      },
    ],
  });
  assert.equal(excList[0].id, 'Classpath-exception-2.0');
  assert.equal(excList[0].hasText, true);
});

/* ------------------------------------------------------------------ *
 * 目录检索
 * ------------------------------------------------------------------ */

test('搜索：精确标识符优先，前缀命中排在名称命中之前', () => {
  assert.equal(searchCatalog(SNAPSHOT, 'mit')[0].id, 'MIT');
  assert.equal(searchCatalog(SNAPSHOT, 'GPL-3.0-only')[0].id, 'GPL-3.0-only');
  assert.equal(searchCatalog(SNAPSHOT, 'MPL-2.0')[0].id, 'MPL-2.0');
  // 前缀命中的许可证应当在结果里（搜索 'GPL-3.0' 会命中多个条目，属于预期行为）
  const prefix = searchCatalog(SNAPSHOT, 'GPL-3.0', 200).map((l) => l.id);
  assert.ok(prefix.includes('GPL-3.0-only'), '前缀搜索应包含 GPL-3.0-only');
  assert.ok(prefix.includes('GPL-3.0-or-later'), '前缀搜索应包含 GPL-3.0-or-later');
  const byName = searchCatalog(SNAPSHOT, 'mozilla').map((l) => l.id);
  assert.ok(byName.includes('MPL-2.0'), '按名称应当能搜到 MPL-2.0');
  assert.equal(searchCatalog(SNAPSHOT, 'zzz-not-a-license').length, 0);
});

test('木兰许可证与开源硬件许可证都在收录范围内', () => {
  const ids = new Set(SNAPSHOT.licenses.map((l) => l.id));
  for (const id of ['MulanPSL-1.0', 'MulanPSL-2.0', 'CERN-OHL-S-2.0', 'CERN-OHL-W-2.0', 'TAPR-OHL-1.0']) {
    assert.ok(ids.has(id), `缺少 ${id}`);
  }
});

test('已废弃标识符在目录里被标记，但依然可访问（历史项目需要）', () => {
  const deprecated = SNAPSHOT.licenses.filter((l) => l.deprecated);
  assert.ok(deprecated.length >= 20, `废弃标识符数量异常：${deprecated.length}`);
  for (const id of ['GPL-3.0', 'AGPL-3.0', 'GPL-2.0+']) {
    const item = SNAPSHOT.licenses.find((l) => l.id === id);
    if (item) assert.equal(item.deprecated, true, `${id} 应标记为废弃`);
  }
});

/* ------------------------------------------------------------------ *
 * 条款推断
 * ------------------------------------------------------------------ */

test('推断：AGPL 系列必须识别出"网络服务触发开源"', () => {
  for (const id of ['AGPL-3.0-only', 'AGPL-3.0-or-later']) {
    const facts = deriveFacts(id, TEXTS.licenses[id].licenseText, true);
    assert.equal(facts.networkTrigger, true, `${id} 应识别为网络触发`);
    assert.equal(facts.family, 'network-copyleft');
    assert.equal(facts.inferred, true, '推断结果必须标记为 inferred');
  }
});

test('推断：Apache-2.0 应识别出明确专利授权，BSD-3-Clause-Clear 应识别为不授权', () => {
  const apache = deriveFacts('Apache-2.0', TEXTS.licenses['Apache-2.0'].licenseText, true);
  assert.equal(apache.patentGrant, 'explicit');
  const clear = deriveFacts('BSD-3-Clause-Clear', TEXTS.licenses['BSD-3-Clause-Clear'].licenseText, true);
  assert.equal(clear.patentGrant, 'none');
});

test('推断：MPL-2.0 是文件级著佐权，GPL-3.0 是整部作品著佐权', () => {
  const mpl = deriveFacts('MPL-2.0', TEXTS.licenses['MPL-2.0'].licenseText, true);
  assert.equal(mpl.sameLicensePerFile, true);
  assert.equal(mpl.networkTrigger, false);
  const gpl = deriveFacts('GPL-3.0-only', TEXTS.licenses['GPL-3.0-only'].licenseText, true);
  assert.equal(gpl.sameLicenseWholeWork, true);
  assert.equal(gpl.family, 'strong-copyleft');
});

test('推断：MIT 不应被误判为有专利授权或著佐权', () => {
  const mit = deriveFacts('MIT', TEXTS.licenses.MIT.licenseText, true);
  assert.equal(mit.family, 'permissive');
  assert.equal(mit.networkTrigger, false);
  assert.equal(mit.sameLicenseWholeWork, false);
});

/* ------------------------------------------------------------------ *
 * 官方式文件头（本项目的核心差异点）
 * ------------------------------------------------------------------ */

test('官方头模板优先于本地措辞，且占位符被替换', () => {
  const { result, get } = build('Apache-2.0');
  const header = get('Apache-2.0.header.txt');
  assert.ok(header, '应产出头模板');
  assert.match(header.content, /Acme Inc\./, '官方模板里的 [name of copyright owner] 应被替换');
  assert.match(header.content, /2020-2024/);
  assert.doesNotMatch(header.content, /\[name of copyright owner\]|\[yyyy\]/);
  assert.equal(result.headerStrategy, 'spdx-official');
});

test('官方头精确区分 -only 与 -or-later（竞品普遍混淆之处）', () => {
  const only = build('GPL-3.0-only').get('GPL-3.0-only.header.txt').content;
  const later = build('GPL-3.0-or-later').get('GPL-3.0-or-later.header.txt').content;
  assert.match(only, /version 3 of the License only|version 3\./);
  assert.match(later, /either version 3 of the License, or \(at your option\) any later version/);
  assert.doesNotMatch(only, /any later version/);
  assert.notEqual(only, later);
});

test('LGPL-3.0 的官方头也能正确填充（上游模板措辞与 GPL 不同）', () => {
  const { get } = build('LGPL-3.0-or-later');
  const header = get('LGPL-3.0-or-later.header.txt');
  assert.ok(header);
  assert.match(header.content, /Acme Inc\./);
  assert.match(header.content, /any later version/);
});

test('没有官方头模板的许可证：不自造法律声明，改用 SPDX 两行式', () => {
  const { result, get } = build('MIT');
  assert.equal(result.headerStrategy, 'spdx-tag', 'MIT 在 SPDX 数据里没有官方头模板');
  const header = get('MIT.header.txt');
  assert.match(header.content, /SPDX-FileCopyrightText: 2020-2024 Acme Inc\./);
  assert.match(header.content, /SPDX-License-Identifier: MIT/);
  // 不能凭空冒出"Permission is hereby granted"这类正文句子
  assert.doesNotMatch(header.content, /Permission is hereby granted/);
});

test('模板占位符填充覆盖五种实测形态（尖括号/方括号/裸大写/大小写）', () => {
  const input = {
    holders: [{ name: 'Acme Inc.', from: '2024' }],
    projectName: 'widget',
    projectDescription: 'a tiny widget',
    symbolStyle: 'word',
    joiner: 'newline',
  };
  const filled = (t) => fillTemplatePlaceholders(t, input);
  assert.equal(filled('Copyright [yyyy] [name of copyright owner]'), 'Copyright 2024 Acme Inc.');
  assert.equal(filled('Copyright <YEAR> <COPYRIGHT HOLDER>'), 'Copyright 2024 Acme Inc.');
  assert.equal(filled('Copyright (C) <year> <name of author>'), 'Copyright (C) 2024 Acme Inc.');
  assert.equal(filled('Copyright (c) [xxxx]-[xxxx] [Owner Organization]'), 'Copyright (c) 2024 Acme Inc.');
  assert.equal(filled('Copyright [YEAR] [NAME] [EMAIL]'), 'Copyright 2024 Acme Inc. Acme Inc.');
  // GFDL 系列：YEAR 与 YOUR NAME 都是裸词占位符。替换值必须用函数形式返回，
  // 否则 `$1` 会被当作捕获组引用，产出 "$12024 Acme Inc." 这种垃圾。
  assert.equal(filled("Copyright (c) YEAR YOUR NAME"), '2024 Acme Inc.');
  assert.doesNotMatch(filled('Copyright (c) YEAR YOUR NAME'), /\$\d/);
  // 裸 yyyy 与下划线占位（GPL-2.0-only / CPAL-1.0 的真实写法）
  assert.equal(filled('Copyright (C) yyyy name of author'), 'Copyright (C) 2024 Acme Inc.');
  assert.equal(filled('The Original Code is [_______] .'), 'The Original Code is Acme Inc. .');
  // 认不出的占位符必须原样保留，好让上层报告出来
  assert.equal(filled('Copyright [whatever holder]'), 'Copyright [whatever holder]');
});

test('全部 93 个官方文件头模板都能把占位符填干净（零残留）', () => {
  // 这是本项目的核心承诺：逐字使用官方措辞，且不把占位符丢给用户。
  // 实测踩过的坑都固化在这里：木兰的 [name of copyright holder]、
  // GPL-2.0 的裸 yyyy、GFDL 的裸 YEAR、CPAL 的下划线、以及真实 URL 不能被破坏。
  const input = {
    holders: [{ name: 'Acme Inc.', from: '2020', to: '2024' }],
    projectName: 'widget',
    projectDescription: 'a tiny widget',
    symbolStyle: 'word',
    joiner: 'newline',
    contactEmail: 'legal@example.com',
    repoUrl: 'https://example.com/widget',
  };
  const headers = Object.entries(TEXTS.licenses).filter(([, v]) => v.standardLicenseHeader);
  assert.ok(headers.length >= 90, `官方头模板数量异常：${headers.length}`);
  const withLeftovers = [];
  for (const [id, entry] of headers) {
    const filled = fillTemplatePlaceholders(entry.standardLicenseHeader, input);
    const left = templateLeftovers(filled);
    if (left.length) withLeftovers.push(`${id}: ${left.join(', ')}`);
  }
  assert.deepEqual(withLeftovers, [], '以下官方头模板替换后仍有占位符残留');

  // 真实 URL 必须原样保留（GPL 家族的模板里带 gnu.org 链接）
  const gpl = fillTemplatePlaceholders(TEXTS.licenses['GPL-3.0-or-later'].standardLicenseHeader, input);
  assert.match(gpl, /https:\/\/www\.gnu\.org\/licenses\//, '模板里的真实 URL 不能被替换破坏');
  assert.doesNotMatch(gpl, /\$\d/, '替换值不能把捕获组引用当字面量写进去');
});

test('fileHeader 在官方模板缺失时会报告残留占位符，而不是静默通过', () => {
  const input = {
    holders: [{ name: 'Acme Inc.', from: '2024' }],
    projectName: 'widget',
    symbolStyle: 'word',
    joiner: 'newline',
  };
  const out = fileHeader('MIT', input, 'slash', {
    officialHeader: 'Copyright [unknown token]',
  });
  assert.ok(out.leftovers.length > 0, '应报告未识别的占位符');
});

/* ------------------------------------------------------------------ *
 * 生成产物
 * ------------------------------------------------------------------ */

test('MIT：版权行占位符被真正替换，且不残留占位符', () => {
  const { result, get } = build('MIT');
  const license = get('LICENSE');
  assert.ok(license);
  assert.match(license.content, /Copyright \(C\) 2020-2024 Acme Inc\./);
  assert.doesNotMatch(license.content, /<year>|<copyright holders?>/i);
  assert.equal(result.leftoverPlaceholders.length, 0);
  assert.match(license.content, /Permission is hereby granted, free of charge/);
});

test('MIT-0：正文用大写占位符，同样必须被替换', () => {
  const { get } = build('MIT-0');
  const license = get('LICENSE');
  assert.doesNotMatch(license.content, /<YEAR>|<COPYRIGHT HOLDER>/i);
  assert.match(license.content, /Copyright \(C\) 2020-2024 Acme Inc\./);
});

test('MIT：没有版权人时给出错误级提示，而不是静默输出', () => {
  const opts = options({ copyright: { ...options().copyright, holders: [{ name: '', from: '2020' }] } });
  const { result } = build('MIT', opts);
  assert.ok(result.notices.some((n) => n.level === 'error' && /版权/.test(n.zh)));
});

test('GPL-3.0-or-later：COPYING 正文逐字保留，FSF 的版权年份不被替换', () => {
  const { get } = build('GPL-3.0-or-later');
  const copying = get('COPYING');
  assert.ok(copying);
  assert.match(copying.content, /Free Software Foundation/);
  assert.match(copying.content, /<year>/);
  assert.doesNotMatch(copying.content, /Acme Inc\./);
});

test('无版权位置的许可证（Zlib）正文必须逐字保留，版权信息只走其他文件', () => {
  const { spec, get } = build('Zlib');
  assert.equal(spec.fill, 'metadata-only', 'Zlib 的正文里没有版权行占位符');
  const license = get(spec.fileName);
  assert.doesNotMatch(license.content, /Acme Inc\./, 'Zlib 的正文不应被填入用户信息');
  assert.match(get('Zlib.header.txt').content, /Acme Inc\./, 'Zlib 的版权信息应出现在源文件头');
});

test('裸大写与方括号占位符也必须被替换：0BSD 与 Clear BSD', () => {
  const zero = build('0BSD').get('LICENSE');
  assert.doesNotMatch(zero.content, /YEAR by AUTHOR EMAIL/, '0BSD 的裸大写占位符必须被替换');
  assert.match(zero.content, /Copyright \(C\) 2020-2024 Acme Inc\./);

  // Clear BSD 的 `[Owner Organization]` 在正文里出现**两次**：版权行与背书条款。
  // 只替换版权行会给用户留下一个方括号占位符，因此两处都必须填。
  const clear = build('BSD-3-Clause-Clear').get('LICENSE');
  assert.doesNotMatch(clear.content, /\[xxxx\]|\[Owner Organization\]/, 'Clear BSD 的方括号占位符必须全部被替换');
  assert.match(clear.content, /Copyright \(C\) 2020-2024 Acme Inc\./);
  // 背书条款里只填**主体名称**（不带年份），否则会产出读不通的句子
  assert.match(clear.content, /Neither the name of Acme Inc\. nor the names of its/);
});

test('免责声明里的大写词不能被误判为占位符', () => {
  // BSD 系正文到处是 "THIS SOFTWARE IS PROVIDED BY THE AUTHOR"，那是正文措辞
  const bsd = build('BSD-2-Clause').get('LICENSE');
  assert.match(bsd.content, /THE AUTHOR|COPYRIGHT HOLDERS/, '免责声明的原文必须保持不动');
  assert.doesNotMatch(bsd.content, /<year>|<owner>/i);
});

test('EPICS 的 "© <YEAR> <HOLDERS>" 形态也能被替换', () => {
  const { get } = build('EPICS');
  const license = get('LICENSE');
  assert.doesNotMatch(license.content, /<YEAR>|<HOLDERS>/i, 'EPICS 的占位符必须被替换');
  assert.match(license.content, /Acme Inc\./);
});

test('Apache-2.0：NOTICE 是硬性义务，即使调用方关闭也要生成', () => {
  const { result, get } = build('Apache-2.0', options({ includeNotice: false }));
  const notice = get('NOTICE');
  assert.ok(notice);
  assert.equal(notice.mandatory, true);
  assert.match(notice.content, /lodash — John-David Dalton — MIT/);
  assert.ok(result.notices.some((n) => n.zh.includes('NOTICE')));
});

test('REUSE 布局保存逐字原文，与根目录填好的文件不同', () => {
  const { get } = build('MIT', options({ includeReuseLayout: true }));
  const root = get('LICENSE');
  // 文件名不带扩展名（按用户要求去掉）。REUSE 3.0 规范要的是
  // 「SPDX 标识符 + 适当的扩展名」，所以这不是严格合规的布局，
  // 该文件的 why 文案里已如实说明。
  const reuse = get('LICENSES/MIT');
  assert.ok(reuse);
  assert.ok(!get('LICENSES/MIT.txt'), '不应当再带 .txt 后缀');
  assert.match(root.content, /Acme Inc\./);
  assert.match(reuse.content, /<copyright holders>/);
  assert.notEqual(reuse.content, root.content);
  // 说明里要讲清与 REUSE 规范的差异，不能让用户以为 reuse lint 能过
  assert.match(reuse.why.zh, /reuse lint/, 'why 文案应当说明这样会让 reuse lint 报不合规');
});

test('包管理器字段使用完整 SPDX 表达式', () => {
  const { get } = build('GPL-3.0-or-later', options({ manifests: ['package.json', 'Cargo.toml', 'pyproject.toml', 'pom.xml'] }));
  assert.match(get('manifest/package.json.snippet').content, /"license": "GPL-3\.0-or-later"/);
  assert.match(get('manifest/Cargo.toml.snippet').content, /license = "GPL-3\.0-or-later"/);
  assert.match(get('manifest/pom.xml.snippet').content, /spdx\.org\/licenses\/GPL-3\.0-or-later\.html/);
});

/* ------------------------------------------------------------------ *
 * WITH 例外
 * ------------------------------------------------------------------ */

test('WITH 例外：表达式、例外正文与清单字段三处一致', () => {
  const { spec, get } = build('GPL-2.0-only', options(), 'Classpath-exception-2.0');
  assert.equal(expressionOf(spec), 'GPL-2.0-only WITH Classpath-exception-2.0');
  const exceptionFile = get('LICENSE.Classpath-exception-2.0');
  assert.ok(exceptionFile, '例外正文必须随附');
  assert.equal(exceptionFile.mandatory, true);
  assert.match(exceptionFile.content, /Linking this library statically or dynamically/);
  const header = get('GPL-2.0-only WITH Classpath-exception-2.0.header.txt');
  assert.ok(header, '头模板应使用完整表达式作为文件名');
  assert.match(header.content, /SPDX-License-Identifier: GPL-2\.0-only WITH Classpath-exception-2\.0/);
});

test('WITH 例外：REUSE 布局下例外也有可校验副本', () => {
  const { get } = build('GPL-2.0-only', options({ includeReuseLayout: true }), 'Classpath-exception-2.0');
  assert.ok(get('LICENSES/Classpath-exception-2.0'), 'REUSE 需要例外副本（同样不带扩展名）');
  assert.ok(get('LICENSES/GPL-2.0-only'), '许可证本身也要有副本');
});

/* ------------------------------------------------------------------ *
 * 长尾许可证
 * ------------------------------------------------------------------ */

test('长尾许可证也能生成完整产物，并如实声明条款是推断所得', () => {
  // 挑一个既没有人工整理、又不在常见名单里的条目
  const longTail = SNAPSHOT.licenses.find(
    (l) => !l.deprecated && !LICENSES.some((c) => c.id === l.id) && l.textLength > 200,
  );
  assert.ok(longTail, '应当存在长尾许可证');
  const { result, spec, get } = build(longTail.id);
  assert.equal(spec.curated, null, '长尾条目不应被标为人工整理');
  assert.equal(spec.factsInferred, true, '条款必须标注为推断');
  assert.ok(get(spec.fileName), '长尾许可证也要产出正文文件');
  assert.ok(
    result.notices.some((n) => n.zh.includes('推断')),
    '必须提示条款是文本推断',
  );
});

test('废弃标识符仍可生成，但必须给出明确警告', () => {
  const deprecated = SNAPSHOT.licenses.find((l) => l.deprecated && l.textLength > 200);
  assert.ok(deprecated);
  const { result, spec } = build(deprecated.id);
  assert.equal(spec.deprecated, true);
  assert.ok(result.notices.some((n) => n.level === 'warn' && n.zh.includes('废弃')));
});

/* ------------------------------------------------------------------ *
 * 注册表一致性
 * ------------------------------------------------------------------ */

test('人工整理集合里的每一个标识符都必须是现行写法', () => {
  for (const l of LICENSES) {
    assert.equal(DEPRECATED_IDS[l.id], undefined, `${l.id} 是已废弃写法，不应出现在人工整理集合里`);
  }
});

test('注册表自检：fill 标记必须与上游正文实际形态一致', () => {
  // 这条守门断言保证"该填的填、不该填的一个字都不加"：
  // 标记为 copyright-line 的必须有可识别的版权位置（且能填干净），
  // 标记为 metadata-only 的则必须一个占位符都识别不到。
  for (const l of LICENSES) {
    const raw = TEXTS.licenses[l.id]?.licenseText ?? '';
    assert.ok(raw.length > 0, `${l.id} 缺少正文数据`);
    const hasSlot = hasCopyrightPlaceholder(raw);
    if (l.fill === 'copyright-line') {
      assert.ok(hasSlot, `${l.id} 标记为 copyright-line，但正文里没有可识别的版权位置`);
      const filled = fillLicenseText(l.id, raw, {
        holders: [{ name: 'Acme Inc.', from: '2024' }],
        projectName: 'widget',
        symbolStyle: 'word',
        joiner: 'newline',
      });
      assert.equal(filled.leftoverPlaceholders.length, 0, `${l.id} 的版权位置填不干净`);
    }
    if (l.fill === 'metadata-only') {
      assert.ok(!hasSlot, `${l.id} 标记为 metadata-only，但正文里存在可识别的版权位置`);
    }
  }
});

test('GPL 家族的示例段一律原样保留（非必要不改）', () => {
  for (const l of LICENSES.filter((x) => x.fill === 'apply-section')) {
    const { get, result } = build(l.id, options({ includeFileHeader: true }));
    const main = get(l.fileName);
    // 正文里的示例段占位符必须原封不动
    assert.match(main.content, /<year>/, `${l.id} 的示例段应保持原样`);
    assert.doesNotMatch(main.content, /Acme Inc\./, `${l.id} 的正文不应被填入用户信息`);
    // 用户需要的声明由头文件承担，而不是去改正文示例段
    assert.ok(get(`${l.id}.header.txt`), `${l.id} 应产出头文件`);
    assert.equal(result.leftoverPlaceholders.length, 0, '正文不该被判定为有残留占位符');
  }
});

test('正文不含可填位置时，输出与官方文本逐字一致', () => {
  // 这是"非必要不改"最直接的检验：逐字节比对
  for (const id of ['Apache-2.0', 'MPL-2.0', 'Zlib', 'EPL-2.0', 'FTL']) {
    const { spec, get } = build(id);
    assert.equal(spec.fill, 'metadata-only', `${id} 不应被判定为有可填版权位置`);
    const license = get(spec.fileName);
    assert.equal(license.content, TEXTS.licenses[id].licenseText.trimEnd() + '\n', `${id} 的正文被改动了`);
  }
});

test('FTL 的 "Please replace <year>" 说明句不能被当成占位符填掉', () => {
  // 那句是作者写给读者的指引，不是待填位置；填掉它等于把作者的说明弄坏
  const { spec, get } = build('FTL');
  assert.equal(spec.fill, 'metadata-only');
  assert.match(get(spec.fileName).content, /Please replace <year> with the value from the FreeType version/, '作者的说明句必须保留');
});

test('人工整理集合里的每个许可证都实际存在于 SPDX 快照中', () => {
  const ids = new Set(SNAPSHOT.licenses.map((l) => l.id));
  for (const l of LICENSES) {
    assert.ok(ids.has(l.id), `人工整理集合里的 ${l.id} 不在 SPDX 快照中`);
  }
});

/* ------------------------------------------------------------------ *
 * 工具函数
 * ------------------------------------------------------------------ */

test('注释语法渲染对各语言都产生合法包裹', () => {
  assert.match(renderComment('a\nb', 'hash'), /^# a\n# b$/);
  assert.match(renderComment('a', 'slash'), /^\/\*\n \* a\n \*\/$/);
  assert.match(renderComment('a', 'html'), /^<!--\n  a\n-->$/);
});

test('年份格式化：单年、区间与重复年份', () => {
  assert.equal(formatYears({ name: 'x', from: '2024' }), '2024');
  assert.equal(formatYears({ name: 'x', from: '2020', to: '2024' }), '2020-2024');
  assert.equal(formatYears({ name: 'x', from: '2020', to: '2020' }), '2020');
});

test('版权行格式化：自定义权利说明会替换掉符号', () => {
  assert.match(formatHolderLine({ name: 'Acme Inc.', from: '2024', right: 'Copyright' }), /^Copyright 2024 Acme Inc\.$/);
  assert.match(formatHolderLine({ name: 'Acme Inc.', from: '2024' }), /^Copyright \(C\) 2024 Acme Inc\.$/);
});

test('多版权人与非 ASCII 姓名原样保留', () => {
  const opts = options({
    copyright: {
      ...options().copyright,
      holders: [
        { name: 'Acme Inc.', from: '2020', to: '2024' },
        { name: '某某科技有限公司', from: '2025' },
      ],
    },
  });
  const { get } = build('MIT', opts);
  const content = get('LICENSE').content;
  assert.match(content, /Copyright \(C\) 2020-2024 Acme Inc\./);
  assert.match(content, /Copyright \(C\) 2025 某某科技有限公司/);
});
