import { ImageResponse } from 'next/og';

/**
 * 分享卡片（1200×630）。
 *
 * 刻意只用英文：`ImageResponse` 默认字体不含中文字形，中文会渲染成方框。
 * 卡片上的信息与站点标题一致，不额外承诺任何东西。
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'LicenseForge — pick a license, generate every compliance file';
// 纯静态导出：卡片在构建期生成一次，不参与运行时渲染
export const dynamic = 'force-static';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '88px 96px',
        background: '#0b0f14',
        color: '#fbfbfd',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 18,
            background: '#fbfbfd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0b0f14',
            fontSize: 46,
            fontWeight: 700,
          }}
        >
          L
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>LicenseForge</div>
      </div>
      <div
        style={{
          marginTop: 44,
          display: 'flex',
          flexDirection: 'column',
          fontSize: 66,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: -2,
        }}
      >
        <div>Pick a license.</div>
        <div>Generate every compliance file.</div>
      </div>
      <div style={{ marginTop: 32, fontSize: 30, color: '#7c8aa0', lineHeight: 1.4 }}>
        LICENSE · NOTICE · source headers · README section · package fields
      </div>
      <div style={{ marginTop: 28, fontSize: 26, color: '#067647' }}>
        Full SPDX + ScanCode catalog, with plain-language terms and honest confidence labels
      </div>
    </div>,
    size,
  );
}
