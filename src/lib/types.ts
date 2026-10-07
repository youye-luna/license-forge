/** 语言标识 */
export type Lang = Lang2;
export type Lang2 = 'zh' | 'en';

/** 双语字符串 */
export type Bi = { zh: string; en: string };

/** 许可证家族 */
export type Family =
  | 'permissive'
  | 'weak-copyleft'
  | 'strong-copyleft'
  | 'network-copyleft'
  | 'public-domain'
  | 'content'
  /**
   * 非开源条款：商业许可、非商业许可、只开放源码不给修改权的条款，
   * 以及各家厂商自定的条款。ScanCode 收录了大量这一类（943 个），
   * 它们**只能用来查证**，不能填进配置文件的 license 字段。
   */
  | 'proprietary'
  /** 正文太短或缺少可判定的措辞，无法归类（74 个） */
  | 'unknown';

/** 某个许可证需要的"填表变量"类别 */
export type FillKind =
  /** 正文自带版权行占位符（MIT / BSD / ISC 等），填入后即成为完整的 LICENSE */
  | 'copyright-line'
  /** 正文不含版权行，版权信息只进 NOTICE / 文件头 / README 与包管理器字段 */
  | 'metadata-only'
  /** 正文尾部有"如何应用"示例段，包含 <program> / <year> / <name of author> 等占位符 */
  | 'apply-section';

/** per-file 头模板的形态 */
export type HeaderStyle =
  /** 许可证自带官方式声明段（GPL 家族的 "How to Apply" 文本），必须逐字使用 */
  | 'official-boilerplate'
  /** 许可证没有官方头模板，使用 SPDX 推荐的 `SPDX-License-Identifier:` 单行式 */
  | 'spdx-tag';

export interface LicenseFacts {
  /** 是否包含明确的专利授权 */
  patentGrant: 'explicit' | 'none' | 'silent';
  /** 是否含商标条款（有则明确不授予商标权）；注意商标一律不授权，这只表示许可有没有写明 */
  trademarkClause: boolean;
  /** 修改文件时是否必须在文件中标注改动 */
  stateChanges: boolean;
  /** 是否要求衍生作品整体同许可（强著佐权） */
  sameLicenseWholeWork: boolean;
  /** 是否只要求被修改的文件保持同许可（文件级著佐权） */
  sameLicensePerFile: boolean;
  /** 是否通过网络提供服务即触发开源义务 */
  networkTrigger: boolean;
  /**
   * 分发时要不要附上版权声明与许可证全文。
   *
   * 这一项与下面两项曾经**漏在这个接口里**：deriveFacts 已经算出来了，
   * 但这里没声明，于是赋值时被类型挡住、界面上永远显示默认值。
   * 加字段时记得三处一起改：types.ts（这里）、spdx.ts 的 DerivedFacts、界面。
   */
  includeCopyright: 'required' | 'source-only' | 'not-required' | 'silent';
  /**
   * 能不能拿作者或贡献者的名义表示**认可/推荐**（背书）。
   * 与 `promote` 是不同性质的行为：背书是意见表达，促销是市场行为。
   * 实测有 53 个许可只禁背书、4 个只禁促销，因此必须是两个独立维度。
   */
  endorse: 'prohibited' | 'silent';
  /** 能不能拿作者或贡献者的名义为你的产品**促销推广**；语义同 `endorse` */
  promote: 'prohibited' | 'silent';
  /** 是否属于 OSI 认证许可 */
  osiApproved: boolean;
  /** 许可是否可撤销 */
  irrevocable: boolean;
}

export interface LicenseEntry {
  /** SPDX 标识符，必须为现行标识符 */
  id: string;
  /** 同一份正文的其他变体（如 GPL-3.0-only 与 GPL-3.0-or-later） */
  variantsOf?: string;
  family: Family;
  /** 显示名 */
  name: string;
  /** 正文文件名惯例：LICENSE，或 GNU 惯例的 COPYING；LGPL 使用 COPYING.LESSER（官方要求在 GPL 之外单独保留更宽松的条款文件） */
  fileName: 'LICENSE' | 'COPYING' | 'COPYING.LESSER';
  fill: FillKind;
  headerStyle: HeaderStyle;
  /** 该项目是否必须随附 NOTICE 文件（Apache-2.0 §4(d) 等） */
  requiresNotice: boolean;
  /** 是否在正文之后要求附加独立声明（如 GPL 的源文件声明） */
  recommendedNotices: string[];
  facts: LicenseFacts;
  /** 一句话定位 */
  tagline: Bi;
  /** 你得到什么 */
  gains: Bi;
  /** 你放弃什么（竞品普遍回避的部分） */
  tradeoffs: Bi;
  /** 常见误解 */
  misuses: Bi;
  /** 适用场景 */
  bestFor: Bi;
  /** 不适合场景 */
  avoidFor?: Bi;
  /** 是否需要用户显式选择 only / or-later */
  needsVersionChoice: boolean;
}
