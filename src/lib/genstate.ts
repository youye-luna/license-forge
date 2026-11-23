import type { CopyrightInput } from './fill.ts';

/**
 * 生成器的表单状态。
 *
 * 这里刻意放在不依赖 React 的纯模块里：既让界面组件保持轻量，
 * 也让默认值能被测试直接断言（tests/flow.test.mjs）。
 */
/** 第三方组件归属的一行：三个框分别填组件名、版权人、许可证 */
export interface ThirdRow {
  name: string;
  copyright: string;
  license: string;
}

export interface GenState {
  copyright: CopyrightInput;
  /** 主体语言，决定源文件头的注释语法 */
  languageId: string;
  /** 生态，决定生成哪些包管理器字段 */
  ecosystem: string;
  includeNotice: boolean;
  includeFileHeader: boolean;
  includeReadme: boolean;
  includeReuseLayout: boolean;
  thirdParty: ThirdRow[];
  contactEmail: string;
  repoUrl: string;
}

/**
 * 把归属行序列化成 generate() 期望的文本（每行「组件名 — 版权人 — 许可证」）。
 * 三个字段全空的行不出现在文本里——用户看到的默认两行空行不应污染 NOTICE。
 */
export function thirdPartyText(rows: ThirdRow[]): string {
  return rows
    .map((r) => [r.name.trim(), r.copyright.trim(), r.license.trim()].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('\n');
}

export function defaultGenState(): GenState {
  const year = String(new Date().getFullYear());
  return {
    copyright: {
      holders: [{ name: '', from: year, to: '' }],
      projectName: '',
      projectDescription: '',
      symbolStyle: 'word',
      joiner: 'newline',
    },
    languageId: 'c',
    ecosystem: 'node',
    includeNotice: false,
    includeFileHeader: true,
    includeReadme: true,
    // 默认关闭 REUSE 布局——第一个项目不需要根目录里多一个它读不懂的文件夹。
    // 问卷里选择"跳过"的熟手会被切成 true（见 Generator 的 finishQuestionnaire）。
    includeReuseLayout: false,
    // 预置两行空归属：一行都见不到时没人知道这里还能填第三方组件
    thirdParty: [
      { name: '', copyright: '', license: '' },
      { name: '', copyright: '', license: '' },
    ],
    contactEmail: '',
    repoUrl: '',
  };
}
