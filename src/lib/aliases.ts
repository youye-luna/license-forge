/**
 * 非正式许可证名 → SPDX 标识符。
 *
 * 搜索框里常见的写法（`GPLv3`、`Apache 2.0`、`MPL2`、`BSD-3`）和官方标识符对不上，
 * 纯子串匹配一条也命中不了。这里按 spdx-correct 的思路做一张**显式查表**，只收录
 * 含义唯一的口语写法；`GPL`、`BSD`、`Apache` 这类会指向多个版本的裸词刻意不收，
 * 免得把人带到错的许可证上。
 *
 * 键是归一化后的写法（小写、去掉空格 / 连字符 / 下划线），见 `resolveLicenseAlias`。
 */
const ALIASES: Record<string, string> = {
  apache2: 'Apache-2.0',
  'apache2.0': 'Apache-2.0',
  apache20: 'Apache-2.0',
  'apache1.1': 'Apache-1.1',

  gpl2: 'GPL-2.0-only',
  'gpl2.0': 'GPL-2.0-only',
  gplv2: 'GPL-2.0-only',
  'gplv2.0': 'GPL-2.0-only',
  'gpl2+': 'GPL-2.0-or-later',
  'gplv2+': 'GPL-2.0-or-later',
  gpl3: 'GPL-3.0-only',
  'gpl3.0': 'GPL-3.0-only',
  gplv3: 'GPL-3.0-only',
  'gplv3.0': 'GPL-3.0-only',
  'gpl3+': 'GPL-3.0-or-later',
  'gplv3+': 'GPL-3.0-or-later',

  lgpl21: 'LGPL-2.1-only',
  'lgpl2.1': 'LGPL-2.1-only',
  'lgplv2.1': 'LGPL-2.1-only',
  lgpl3: 'LGPL-3.0-only',
  'lgpl3.0': 'LGPL-3.0-only',
  lgplv3: 'LGPL-3.0-only',
  'lgplv3.0': 'LGPL-3.0-only',

  agpl3: 'AGPL-3.0-only',
  'agpl3.0': 'AGPL-3.0-only',
  agplv3: 'AGPL-3.0-only',
  'agplv3.0': 'AGPL-3.0-only',

  mpl2: 'MPL-2.0',
  'mpl2.0': 'MPL-2.0',
  mplv2: 'MPL-2.0',
  'mplv2.0': 'MPL-2.0',
  epl2: 'EPL-2.0',
  'epl2.0': 'EPL-2.0',
  eplv2: 'EPL-2.0',
  cddl1: 'CDDL-1.0',
  'cddl1.0': 'CDDL-1.0',

  bsd2: 'BSD-2-Clause',
  bsd2clause: 'BSD-2-Clause',
  bsd3: 'BSD-3-Clause',
  bsd3clause: 'BSD-3-Clause',

  cc0: 'CC0-1.0',
  'cc01.0': 'CC0-1.0',
  ccby4: 'CC-BY-4.0',
  'ccby4.0': 'CC-BY-4.0',
  ccbysa4: 'CC-BY-SA-4.0',
  'ccbysa4.0': 'CC-BY-SA-4.0',

  bsl1: 'BSL-1.0',
  'bsl1.0': 'BSL-1.0',
  boost: 'BSL-1.0',
  ofl11: 'OFL-1.1',
  'ofl1.1': 'OFL-1.1',
  artistic2: 'Artistic-2.0',
  'artistic2.0': 'Artistic-2.0',
  eupl12: 'EUPL-1.2',
  'eupl1.2': 'EUPL-1.2',
  osl3: 'OSL-3.0',
  'osl3.0': 'OSL-3.0',
  ecl2: 'ECL-2.0',
  'ecl2.0': 'ECL-2.0',
  mspl: 'MS-PL',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  python2: 'Python-2.0',
  'python2.0': 'Python-2.0',
  psf2: 'Python-2.0',
  ruby: 'Ruby',
  mulanpsl2: 'MulanPSL-2.0',
  'mulanpsl2.0': 'MulanPSL-2.0',
  upl1: 'UPL-1.0',
  'upl1.0': 'UPL-1.0',
  cernohls2: 'CERN-OHL-S-2.0',
  'cernohls2.0': 'CERN-OHL-S-2.0',
};

/**
 * 把用户输入归一化后查表。没收录的返回 null——调用方继续走原来的子串匹配。
 */
export function resolveLicenseAlias(input: string): string | null {
  const key = input
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (!key) return null;
  return ALIASES[key] ?? null;
}
