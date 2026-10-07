import { LICENSES } from './licenses.ts';

/*
 * 首页用到的覆盖统计。
 *
 * 这里原先还有一套"对比矩阵"的列定义与渲染函数——对比矩阵已从界面移除，
 * 那些导出没有任何调用方，属于死代码，已一并删除（它们携带的术语也
 * 不应该继续出现在前端产物里）。
 */

/** 人工核对过的许可证的覆盖情况，用于首页说明"我们做了多少" */
export function coverageStats() {
  return {
    total: LICENSES.length,
    gnuVariants: LICENSES.filter((l) => l.needsVersionChoice || l.id.startsWith('GPL') || l.id.startsWith('LGPL') || l.id.startsWith('AGPL')).length,
    withNotice: LICENSES.filter((l) => l.requiresNotice).length,
    withOfficialHeader: LICENSES.filter((l) => l.headerStyle === 'official-boilerplate').length,
    chineseNative: LICENSES.filter((l) => l.id === 'MulanPSL-2.0' || l.id === 'EUPL-1.2').length,
  };
}
