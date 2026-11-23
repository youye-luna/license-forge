import { readdirSync, readFileSync } from 'node:fs';

const PICKER = new URL('../src/components/ProPicker.tsx', import.meta.url);
const PRO_DIR = new URL('../src/components/pro/', import.meta.url);

/**
 * 选许可证页的源码。ProPicker 拆成多个文件后，文案与结构断言要覆盖整个组件目录，
 * 而不是只读 ProPicker.tsx——否则拆出去的那句话会让测试凭空失败（或被误判为丢失）。
 *
 * 拼接顺序：ProPicker.tsx 在前，其余按文件名排序。原来靠 indexOf 判先后的断言
 * （例如排序控件在列表之前）依赖这个顺序。
 */
export function pickerSources() {
  const files = readdirSync(PRO_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .sort();
  return [
    { path: 'ProPicker.tsx', text: readFileSync(PICKER, 'utf8') },
    ...files.map((f) => ({ path: `pro/${f}`, text: readFileSync(new URL(f, PRO_DIR), 'utf8') })),
  ];
}

/** 整个选许可证组件目录拼成一份文本，供只看字符串的断言使用 */
export function pickerSource() {
  return pickerSources()
    .map((f) => f.text)
    .join('\n');
}
