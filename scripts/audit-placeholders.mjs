/**
 * 探测全量 SPDX 正文里出现的"版权占位符"形态。
 *
 * 背景：不同许可证作者写占位符的方式完全不统一。已实测到的形态至少有：
 *   MIT                Copyright (c) <year> <copyright holders>
 *   MIT-0              Copyright <YEAR> <COPYRIGHT HOLDER>
 *   BSD-2/3-Clause     Copyright (c) <year> <owner>
 *   ISC                Copyright <year> <owner>
 *   0BSD               Copyright (C) YEAR by AUTHOR EMAIL      ← 光秃秃的大写单词
 *   BSD-3-Clause-Clear Copyright (c) [xxxx]-[xxxx] [Owner Organization]
 *   Apache-2.0         Copyright [yyyy] [name of copyright owner]
 *
 * 因此"这个许可证的正文里有没有给使用者填的位置"不能靠一个正则判断，
 * 否则会像 0BSD 那样把 YEAR / AUTHOR 原样输出给用户。这个脚本把全量正文扫一遍，
 * 把命中情况打印出来，用于人工核对受控替换表（src/lib/fill.ts 的 COPYRIGHT_SLOT_PATTERNS）。
 */
import { readFileSync } from 'node:fs';

const TEXTS = JSON.parse(readFileSync('public/data/license-texts.json', 'utf8'));

/** 各类形态的探测器；顺序即优先级 */
const PROBES = [
  { name: 'angle-bracket', re: /<(?:year|copyright holders?|owner|COPYRIGHT HOLDER|YEAR)>/i },
  { name: 'square-bracket', re: /\[(?:yyyy|year|xxxx|name of copyright owner|owner organization|fullname|copyright holder|owner)\]/i },
  { name: 'bare-uppercase', re: /\b(?:YEAR|AUTHOR|FULLNAME|COPYRIGHT HOLDER|OWNER ORGANIZATION)\b/ },
];

function scan(text) {
  const head = text.slice(0, 1200);
  const hits = PROBES.filter((p) => p.re.test(head)).map((p) => p.name);
  return { hits, head };
}

const byForm = new Map();
for (const [id, entry] of Object.entries(TEXTS.licenses)) {
  const { hits, head } = scan(entry.licenseText);
  if (!hits.length) continue;
  const key = hits.join('+');
  if (!byForm.has(key)) byForm.set(key, []);
  byForm.get(key).push({ id, head });
}

console.log('=== 命中统计（按形态分组）===');
for (const [form, items] of [...byForm.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(items.length).padStart(4)} 个   ${form}`);
}
console.log(`\n合计 ${[...byForm.values()].reduce((n, v) => n + v.length, 0)} / ${Object.keys(TEXTS.licenses).length} 个许可证的正文首部含版权占位符`);

console.log('\n=== 含 bare-uppercase 的完整清单（这类最容易漏判）===');
for (const [form, items] of byForm.entries()) {
  if (!form.includes('bare-uppercase')) continue;
  for (const it of items) {
    const line = it.head
      .split('\n')
      .find((l) => /\b(?:YEAR|AUTHOR|FULLNAME|COPYRIGHT HOLDER|OWNER ORGANIZATION)\b/.test(l));
    console.log(`  ${it.id.padEnd(34)} ${JSON.stringify((line ?? '').trim().slice(0, 80))}`);
  }
}

console.log('\n=== 含 square-bracket 的完整清单 ===');
for (const [form, items] of byForm.entries()) {
  if (!form.includes('square-bracket')) continue;
  for (const it of items) {
    const line = it.head.split('\n').find((l) => /\[(?:yyyy|year|xxxx|name of copyright owner|owner organization|fullname|copyright holder|owner)\]/i.test(l));
    console.log(`  ${it.id.padEnd(34)} ${JSON.stringify((line ?? '').trim().slice(0, 80))}`);
  }
}
