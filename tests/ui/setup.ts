import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 每个用例后卸载组件，避免上一个用例的 DOM 残留影响查询
afterEach(cleanup);
