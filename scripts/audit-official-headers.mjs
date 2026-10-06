/**
 * 审计 SPDX 官方许可数据里**全部 93 个 standardLicenseHeader 模板**的占位符写法。
 *
 * 这些模板是"官方文件头措辞"的唯一权威来源，我们承诺逐字使用并把占位符换成用户信息。
 * 因此必须先把它们实际用到的占位符形态全部摸清——否则会输出带占位符的文件。
 * 实测已经踩过两个坑：
 *   - 木兰 MulanPSL-2.0 用的是 `[name of copyright holder]`（我们表里只写了 copyright owner）
 *   - GPL-2.0-only 用的是 `Copyright (C) yyyy name of author`（连括号都没有）
 *
 * 用法：node scripts/audit-official-headers.mjs
 */
import { readFileSync } from 'node:fs';

const TEXTS = JSON.parse(readFileSync('public/data/license-texts.json', 'utf8'));

/** 一个"像占位符"的 token：方括号、尖括号，或裸写的小写说明词 */
const TOKEN_PATTERNS = [
  { name: 'square', re: /\[[^\]\n]{2,60}\]/g },
  { name: 'angle', re: /<[^>\n]{2,60}>/g },
  {
    name: 'bare',
    re: /\b(?:yyyy|yy|year|date|name of author|name of copyright holder|copyright holder|fullname|owner|organization|author|program|email)\b/gi,
  },
];

const headers = Object.entries(TEXTS.licenses).filter(([, v]) => v.standardLicenseHeader);

console.log(`共 ${headers.length} 个许可证带官方文件头模板\n`);

const tokensByPattern = new Map();
const perLicense = [];

for (const [id, entry] of headers) {
  const h = entry.standardLicenseHeader;
  const found = [];
  for (const p of TOKEN_PATTERNS) {
    for (const m of h.matchAll(p.re)) {
      const token = m[0];
      found.push(`${p.name}:${token}`);
      if (!tokensByPattern.has(token)) tokensByPattern.set(token, new Set());
      tokensByPattern.get(token).add(id);
    }
  }
  perLicense.push({ id, tokenCount: found.length, unique: [...new Set(found)] });
}

console.log('=== 出现过的 token（按出现次数排序）===');
const sorted = [...tokensByPattern.entries()].sort((a, b) => b[1].size - a[1].size);
for (const [token, ids] of sorted) {
  console.log(`${String(ids.size).padStart(4)} 个许可证   ${JSON.stringify(token)}`);
}

console.log('\n=== 每个模板的 token 明细（只看有 token 的）===');
for (const row of perLicense.filter((r) => r.tokenCount > 0)) {
  console.log(`  ${row.id.padEnd(30)} ${row.unique.join(' , ')}`);
}

console.log('\n=== 原始模板前 3 行（供人工核对）===');
for (const [id, entry] of headers) {
  const head = entry.standardLicenseHeader.split('\n').slice(0, 3).join(' ⏎ ');
  console.log(`  ${id.padEnd(30)} ${JSON.stringify(head.slice(0, 120))}`);
}
