/**
 * 站点基路径——子路径部署的唯一配置点。
 *
 * `next.config.ts` 的 `basePath` 与所有数据加载都读同一个环境变量，
 * 所以不会再出现「页面在 `/licenses/` 下、数据却还去根路径取」这种半套配置。
 *
 * 用法：构建时设 `NEXT_PUBLIC_BASE_PATH=/licenses`，然后 `npm run build`。
 * 默认空串表示部署在域名根路径。
 */
const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim().replace(/\/+$/, '');

export const BASE_PATH = raw && !raw.startsWith('/') ? `/${raw}` : raw;
