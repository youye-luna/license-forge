/**
 * 全站唯一的图标来源：线性（stroke）图标，24×24 网格、1.5px 描边、圆头端点。
 *
 * 界面里不再用 emoji、`●`/`○`/`✕` 这类字符画图标——字符在不同系统上的字形、
 * 基线、粗细完全不可控，混在一起看着就像拼凑的。这里每个图标都是同一套参数下
 * 的 SVG，尺寸由调用方给的 class 决定（默认 16px）。
 */
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<'svg'>, 'viewBox' | 'fill' | 'stroke' | 'strokeWidth'> & { size?: number };

function Icon({ size = 16, className, children, ...rest }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

/** 右箭头：按钮里的「继续 / 去下一步」 */
export function ArrowRight(props: Props) {
  return (
    <Icon {...props}>
      <path d="M4 12h16" />
      <path d="M13 5l7 7-7 7" />
    </Icon>
  );
}

/** 勾：结论为「是」 */
export function Check(props: Props) {
  return (
    <Icon {...props}>
      <path d="M4 12.5l5 5 11-11" />
    </Icon>
  );
}

/** 短横：结论为「否」或未启用 */
export function Minus(props: Props) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

/** 叉：关闭 / 移出 */
export function X(props: Props) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Icon>
  );
}

/** 锁：本地运行、不上传 */
export function Lock(props: Props) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 017 0v3" />
    </Icon>
  );
}

/** 三角感叹号：警示 / 免责声明 */
export function AlertTriangle(props: Props) {
  return (
    <Icon {...props}>
      <path d="M12 3.5l9.5 16.5H2.5L12 3.5z" />
      <path d="M12 9.5v5" />
      <path d="M12 17.6v.1" />
    </Icon>
  );
}

/** 圆圈感叹号 i：中性提示（GitHub 式条款框里「条件」一组的图标） */
export function Info(props: Props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.7v.1" />
    </Icon>
  );
}

/** 空心方框：清单条目 */
export function Square(props: Props) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </Icon>
  );
}
