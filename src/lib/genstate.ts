import type { CopyrightInput } from './fill.ts';

/**
 * 生成器的表单状态。
 *
 * 这里刻意放在不依赖 React 的纯模块里：既让界面组件保持轻量，
 * 也让默认值能被测试直接断言（tests/flow.test.mjs）。
 */
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
  thirdParty: string;
  contactEmail: string;
  repoUrl: string;
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
    thirdParty: '',
    contactEmail: '',
    repoUrl: '',
  };
}
