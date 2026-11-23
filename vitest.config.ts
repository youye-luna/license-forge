import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * 组件层测试（jsdom）。
 *
 * 只收 `tests/ui/**\/*.spec.tsx`：
 *  · 命名用 `.spec.tsx` 而不是 `.test.mjs`，是为了不和 Node 自带的 `node --test`
 *    自动发现规则重叠——那套跑的是纯逻辑测试，不认识 JSX；
 *  · 数据层与生成逻辑仍由 `node --test` 覆盖，这里只补真实交互。
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/ui/**/*.spec.tsx'],
    setupFiles: ['tests/ui/setup.ts'],
  },
});
