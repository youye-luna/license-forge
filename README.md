# LicenseForge · 许可证锻造台

> 按**真实条款差异**选许可证，然后一次生成整套合规文件。

一个纯静态的开源许可证选择与产物生成器：收录 **2469 个**许可证（SPDX 全量 + ScanCode 独有部分），
用问卷或类别浏览帮你选，选中后一次产出 `LICENSE`、`NOTICE`、源文件声明头、README 许可段、
包管理器 `license` 字段，以及 REUSE 布局的 `LICENSES/` 目录。

所有许可证文本与生成逻辑都在浏览器里运行，**你填写的版权信息不会离开这台设备**。

<sub>**English:** LicenseForge is a static site that helps you choose an open-source license by what its
clauses actually do, then generates the whole compliance set at once — `LICENSE`, `NOTICE`, source-file
headers, a README section, package-manager fields and a REUSE layout. It covers 2,476 licenses
(the full SPDX list plus the ScanCode-only long tail), runs entirely in your browser, and uploads nothing.</sub>

---

## 它解决的具体问题

绝大多数项目在"选许可证"这一步只得到一段文本，剩下的坑得自己踩。这个项目把那些坑做进了工具里：

| 常见的坑 | 这里的做法 |
|---|---|
| 复制来的许可证里还留着 `<year>` `<copyright holders>` | 按许可证作者留出的位置填好；**没留位置的一个字都不加** |
| 不知道 `GPL-3.0-only` 和 `GPL-3.0-or-later` 差在哪 | 强制显式选择，并用官方模板生成不同措辞的声明头 |
| Apache-2.0 项目没放 `NOTICE` | 识别为硬性义务（§4(d)），界面里关不掉 |
| 把废弃标识符写进了 `package.json` | 32 个废弃标识符仍可生成但会给警告，并给出替代写法 |
| 只看到"简单宽松"，不知道放弃了什么 | 每个许可证并列给出**你得到什么 / 你放弃什么 / 常见误解** |
| 不知道代码里那段陌生条款是什么 | 收录 ScanCode 独有部分，`Anti 996`、厂商条款这类也能查到 |

---

## 快速开始

```bash
pnpm install
pnpm run data        # 构建期抓取全部许可证数据（首次必须执行，约 20MB）
pnpm run dev         # 开发服务器
pnpm run build       # 静态导出到 out/
pnpm run test        # 123 项测试
pnpm run typecheck   # 类型检查
```

`out/` 可直接部署到任意静态托管（GitHub Pages / Cloudflare Pages / 对象存储 / Nginx）。

仓库里**已经包含**一份构建期抓好的数据快照（`public/data/`，约 19MB），
所以 `pnpm install` 之后可以直接 `pnpm run dev`——`pnpm run data` 是用来更新或核对快照的。

其他脚本：

```bash
pnpm run data:spdx        # 只更新 SPDX 数据
pnpm run data:scancode    # 只更新 ScanCode 独有部分
pnpm run data:enrich      # 只更新第三方补充数据
pnpm run data:terms       # 只更新条款字段标注
pnpm run data:refresh     # 忽略缓存，全部重抓
pnpm run audit:headers    # 审计 93 个官方文件头模板的替换结果（应为 0 残留）
pnpm run audit:placeholders  # 审计 740 个许可证正文里的版权占位符形态
node scripts/serve-out.mjs 4173   # 本地预览 out/ 产物（开发自检用，部署不需要）
```

---

## 数据来源

许可证正文来自 SPDX 官方 License List；条款分类由 ScanCode LicenseDB 补齐；兼容性判定来自
OSADL 义务清单；条款字段的人工标注来自 ChooseALicense；OSI 审批标签来自 OSI 官方 API；
中文审定稿链接来自开放原子《源译识》。

全部在**构建期**抓取一次，作为静态文件随站点分发——运行时不依赖外部网络，
也不受任何 API 的限流影响，并且任何人可以重跑抓取脚本核对快照。

| 来源 | 提供什么 | 覆盖 | 许可 |
|---|---|---|---|
| **[SPDX License List](https://spdx.org/licenses/)** | 标识符、全量正文、`standardLicenseHeader`（93 个官方文件头）、OSI/FSF 状态 | 740 + 86 例外 | CC0 |
| **[ScanCode LicenseDB](https://scancode-licensedb.aboutcode.org/)** | 权威 `category` 分类、归属方、主页，以及 **SPDX 没收录的 1729 个许可证正文** | 分类 726/740；独有 1729 条 | CC-BY-4.0 |
| **[OSADL Obligations Checklist](https://www.osadl.org/Checklists)** | 兼容性矩阵、copyleft 判定、源码披露义务 | 115 个许可 / 13225 条判定 | CC-BY-4.0 |
| **[ChooseALicense](https://github.com/github/choosealicense.com)** | 条款字段的人工标注（专利、商标、改动标注、网络触发） | 47 个主流许可 | CC-BY-3.0 |
| **[OSI 官方 API](https://opensource.org/api/licenses)** | `keywords`（superseded / non-reusable 等）、批准日期 | 123/740 | — |
| **[开放原子《源译识》](https://gitcode.com/translation/license-translation)** | 15 个许可证的中英对照审定稿链接 | 15 | 译文 CC0 |

**合计可选 2469 个许可证**：SPDX 的 740 个 + ScanCode 独有的 1729 个。

ScanCode 那部分正是 SPDX 查不到的东西——`Anti 996` License、ActiveState Community License、
各类厂商的 Proprietary Free / Non-Commercial / Source-available 条款。这些在真实代码库里
会撞到，但用 SPDX 查不出来。其中 **50 个**被判定为非开源，选用时会给出 error 级提示。

### 条款字段有三级可信度，界面会如实标注

同一个"是否有专利授权"，来源不同，可靠性完全不同。所以每一项都带出处：

| 来源 | 覆盖 | 界面标注 |
|---|---|---|
| 人工整理（本项目逐条核对） | 32 | 绿色「人工整理」 |
| ChooseALicense 人工标注 | 47 | 绿色「来自 ChooseALicense 的人工标注」 |
| 正文关键词推断 | 其余 | 橙色「由正文推断，非权威认定」 |

界面不会把推断结果和人工核对显示成同一种东西。

---

## 生成许可证正文的原则：非必要不改，人怎么搞的就怎么来

判定标准只有一条——**许可证作者自己有没有把那个位置留给使用者**。

| 情形 | 做法 | 例子 |
|---|---|---|
| 作者留了版权行位置 | 只替换那一处 | MIT `Copyright (c) <year> <copyright holders>`、ISC、BSD、0BSD、HPND、NCSA、ASWF、UPC… |
| 同一占位符在条款里出现多次 | 每处都填，但只填**主体名称** | Clear BSD 的 `[Owner Organization]` 在版权行与背书条款各出现一次；HPND 的 `<copyright holder>` 在免责声明里还有一次 |
| 正文没有留位置 | **一个字都不加** | Apache-2.0、MPL-2.0、EPL-2.0、Zlib、Unlicense、CC0 |
| 那一节是**示例**而非生效条款 | 原样保留，需要的声明另给 | GPL / LGPL / AGPL 的 "How to Apply These Terms" |
| 那句是**写给读者的说明** | 原样保留，绝不填 | FTL 的 `Please replace <year> with the value from the FreeType version you actually use.` |
| 那是正文反复引用的**定义变量** | 原样保留 | LPL-1.0 的 `<OWNER>` |

判定"有没有可填位置"的方式是**先替换、再看结果**，而不是靠推测性正则——
早期版本用正则找大写词，把 AAL、BSD-3-Clause-acpica 这类正文里含 "THE AUTHOR" 的许可证
误判成"有可填位置"，结果既没填到东西、又被标成可填。

现在判定与实际能力严格一致：**全量 740 个许可证里有 27 个被判为有可填位置，全部填得干净，0 残留。**
逐字节比对官方文本，不含可填位置的许可证输出与原文完全一致（有测试守着）。

`pnpm run audit:placeholders` 可复现这次审计；`SLOT_PATTERNS`（`src/lib/fill.ts`）是一张
**受控白名单**，每条都对应一个已核实的真实文本片段。

### 源文件声明头：优先用官方模板

SPDX 官方数据里 **93 个许可证自带 `standardLicenseHeader`**，这是权威措辞，且**精确区分
`-only` 与 `-or-later`**（`"version 3."` 对比 `"either version 3 … or any later version"`）。
只要存在就一定优先使用。

这些模板的占位符写法同样发散（`[yyyy]`、`[name of copyright owner]`、`yyyy`、`YEAR YOUR NAME`、
含真实 URL 等），因此：

- 替换前先保护 URL 段（`<https://www.gnu.org/licenses/>` 必须原样保留）；
- 不替换 `[2019]` 这类具体值——它可能是示例也可能是事实；
- 替换后执行**残留检测**，任何仍像占位符的 token 都会报到界面上，绝不静默输出。
  脚注编号（如 W3C 正文里的 `[1]`）被显式排除，避免误报淹没真风险。

`pnpm run audit:headers` 会对 93 个模板跑一遍替换并报告残留数，**当前为 0**。

没有官方模板的许可证，给出 SPDX / REUSE 推荐的两行式写法，而不自己编一段"看起来像法律声明"的文字：

```
SPDX-FileCopyrightText: 2024 某某科技有限公司
SPDX-License-Identifier: MIT
```

---

## 界面流程

一条线，不做模式切换——选许可证这件事对谁都需要：

```
打开 → ① 问卷选许可 → ② 选择与对比 → ③ 生成产物 → ④ 关于
```

| 步骤 | 做什么 |
|---|---|
| ① 问卷选许可 | 8 个问题，每题说明"为什么问这个"与背后的条款差异；产出**候选集 + 各自的代价**，而不是"唯一正确答案" |
| ② 选择与对比 | 2469 个许可证，按类别/来源/搜索定位；列表与**对比矩阵**两种视图；最多 4 个放进对比工作台细看 |
| ③ 生成产物 | 许可证全文、源文件头、NOTICE（可选）、README 段、包管理器字段，打包下载 |
| ④ 关于 | 数据从哪来、遵守哪几条硬规则、有哪些已知限制 |

**熟手不会被问卷挡住**：问卷页顶部就有「跳过问卷，直接选许可证」。跳过的唯一影响是
REUSE 布局默认开启——是换一个默认值，不是换一套逻辑（有测试守着）。

### 选择与对比

同一个页面里两种视图，回答两个不同的问题：

- **列表** —— "我已经知道要找什么"：检索、看某个许可证的完整条款；
- **对比矩阵** —— "有哪些选择、它们互相差在哪"：行是许可证、列是 14 个维度
  （来源 / 家族 / 条款来源 / 专利授权 / 允许闭源衍生 / 网络服务触发 / 须标注改动 /
  商标条款 / NOTICE 义务 / 官方文件头 / OSI / copyleft / 源码披露 / 分类），支持 4 种排序。

矩阵的行数跟随筛选：默认「最常用」29 行（条款全部人工核对）；选了类别或数据源就摊开该范围，
上限 80 行。每行都能直接选用或加入对比工作台。

条款面板底部有「加入对比」，最多放 4 个，在工作台里逐列横向摊开。
**任何条目都能加入**（含长尾与 ScanCode 独有），而表格里的「条款来源」一行会如实区分
人工标注与正文推断。

### 分类

- **宽松型** — MIT、MIT-0、0BSD、ISC、BSD-2-Clause、BSD-3-Clause、BSD-3-Clause-Clear、Apache-2.0、BSL-1.0、Zlib、OFL-1.1
- **弱著佐权** — MPL-2.0、EPL-2.0、CDDL-1.0、LGPL-2.1/3.0 的 only 与 or-later
- **强著佐权** — GPL-2.0/3.0 的 only 与 or-later、CERN-OHL-S-2.0、EUPL-1.2
- **网络著佐权** — AGPL-3.0 的 only 与 or-later
- **公共领域** — Unlicense、CC0-1.0、WTFPL
- **内容/数据** — CC-BY-4.0、CC-BY-SA-4.0

正文按需加载：首屏只取目录（约 1.2MB 元数据），选定一个 SPDX 许可证才拉 5.3MB 的
SPDX 全文，选定一个 ScanCode 独有条目才拉 13MB 的对应全文——不会为了其中一边把另一边也拉下来。

### 其他几条硬规则

- **只用现行 SPDX 标识符**：GPL 家族强制显式选择 `-only` / `-or-later`，声明头按选择生成不同措辞，
  并有测试断言二者必须不同。**32 个废弃标识符仍然可以生成**——历史项目有时必须沿用——但会给明确警告。
- **`WITH` 例外**：支持 86 个例外条款，表达式、例外正文（`LICENSE.<ID>`）与清单字段三处保持一致，
  REUSE 布局下也会为例外生成可校验副本。
- **把强制义务做实**：Apache-2.0 的 NOTICE 关不掉，并提示不要整体覆盖仓库里已有的 NOTICE；
  每个许可证都附一份"生成后仍需你做的事"清单（文件头要加到每个源文件、改动要标注、贡献者授权方式要先定）。
- **讲代价，不只讲好处**：明确写出 MIT 对专利只字未提（而不是打勾或留空）；
  纠正"GPL 不能商用"与"GPL-3.0 适用于网络服务"（那是 AGPL）这两个流传极广的错误。
- **本地运行，不上传**：纯静态导出，数据随站点分发，填写的版权信息不会被发送到任何服务器。

---

## SPDX 与 ScanCode 是两套标识符体系（界面上会讲清楚）

| | SPDX 条目 | ScanCode 独有条目 |
|---|---|---|
| 标识符 | 正式 SPDX ID（`MIT`、`GPL-3.0-only`） | `LicenseRef-scancode-<key>` |
| 能否写进 `package.json` 的 license 字段 | ✅ | ❌ 那些工具只认 SPDX 标识符 |
| OSI 认证结论 | 有 | 无（不声称） |
| 官方文件头 | 93 个自带 | 无（不编造） |
| 可用场景 | 直接选用 | 参考与审计："代码里这段条款到底是什么" |

生成 ScanCode 独有条目时会给出**警告级**提示，把这条差异讲明白——而不是让用户拿着一个
`LicenseRef` 去填 `package.json` 然后被工具判为无效。

---

## 木兰族是两个不同的许可证

木兰是**两支**，法律效果完全不同，这里分别收录并如实归类：

| 许可证 | 定位 | 标识符 | 分类 | 来源 |
|---|---|---|---|---|
| **木兰宽松许可证** Mulan PSL v2 | 宽松型——允许闭源衍生 | `MulanPSL-2.0`（**OSI 认证**） | Permissive | SPDX |
| **木兰公共许可证** Mulan PubL v2 | **公共型/著佐权**——要求衍生作品同许可 | `LicenseRef-scancode-mulanpubl-2.0` | Copyleft | ScanCode |
| 木兰宽松 v1 | 同上，v1 | `MulanPSL-1.0` | Permissive | SPDX |
| 木兰公共 v1 | 同上，v1 | `LicenseRef-scancode-mulanpubl-1.0` | Copyleft | ScanCode |

两者同属 **COSCL（中国开源云联盟）**，但 **MulanPubL 不在 SPDX 列表里**，
所以它的标识符是 `LicenseRef` 形式，不能直接写进 `package.json` 的 license 字段。
MulanPSL-2.0 的正文为中英双语，且其第 6 条明确"以中文版为准"——这是极少数中文具有优先效力的许可证。

---

## 数据加工时必须小心的几个陷阱

这些坑都在代码注释与测试里写明了，列出来是因为重跑抓取脚本的人会踩到同样的：

**1. 不要把局部排除当成整体拒绝。** MPL-2.0 的正文里有
"no patent license is granted by a Contributor: (a) for any …"——但它同时明文授予了专利许可。
早期用 `no patent` 匹配会把 MPL 判成"明确不授权"。同理 BSD-3-Clause-Clear 的全大写句
"NO EXPRESS OR IMPLIED LICENSES TO ANY PARTY'S PATENT RIGHTS ARE GRANTED" 里
出现了 `PATENT` 与 `GRANTED`，判定顺序反了就会把明确拒绝判成明确授权。

**2. 不要把"分类相同"当成"条款相同"。** AGPL 与 GPL 在 ScanCode 里同属 copyleft 大类，
但只有 AGPL 有网络触发义务。因此分类只决定家族，**网络触发必须看正文**。

**3. ChooseALicense 的 `patent-use` 同名反义。** 这个词在 permissions 里表示"明确授予专利权"，
在 limitations 里表示"明确**不**授予专利权"。合并时若不分段，Apache-2.0 与
BSD-3-Clause-Clear 会被判成同一类。

**4. ScanCode 的分类不覆盖独有条目。** enrichment 只覆盖 SPDX 列表内的 740 个，
ScanCode 独有的 1729 个在它里面找不到记录。家族判定必须先查 enrichment、
查不到再退回条目自带的 `category`，否则会全部默认成 permissive。

**5. 各源自身的字段坑**：

- SPDX 详情分两条路径且**字段名不同**：许可证走 `json/details/<ID>.json` 的 `licenseText`，
  例外走 `json/exceptions/<ID>.json` 的 `licenseExceptionText`。
- ScanCode 该站 404 时返回的是 **9KB 的 HTML 错误页**，必须按内容嗅探挡住，
  否则会把错误页当成许可证正文。它的 `standard_notice` 字段**实测恒为 null**，不能当文件头来源。
  非 SPDX 条目的正文要按索引里的 `license` 字段给的 URL 取，**不要自己拼 key**。
- OSADL 的 `matrix.json` 顶层混了 `timeformat` / `timestamp` / `disclaimer` 等元数据键，必须剔除；
  `sourcedisclosure.json` 的内部键名是 `disclosure`，与文件名不一致。
- OSI API **覆盖不完整**：只有 126 条，连 AGPL/GPL 系列都不在里面，而 SPDX 标为 OSI-approved 的有 154 个。
  因此 **OSI 认证状态一律以 SPDX 为准**，该 API 只用于补充它独有的 `keywords`。
- 开放原子项目的 `git/trees?recursive=1` **只返回顶层**，不递归展开子目录；
  文件名有拼写错误（`BDS-3-clause`），因此构建期做**显式映射**而不是靠字符串猜。
  只记录**链接**不抓取正文：译本的法律效力需读者自行判断。

---

## 项目结构

```
scripts/
  fetch-spdx.mjs              抓取 SPDX 全量许可证与例外（磁盘缓存 + 并发池 + 重试）
  fetch-scancode-extra.mjs    抓取 SPDX 未收录的 ScanCode 条目（正文与名称）
  fetch-enrichment.mjs        合并 ScanCode 分类 / OSADL 矩阵 / OSI keywords / 中文链接
  fetch-choosealicense.mjs    抓取条款字段的人工标注（含 6 项已知答案自检）
  audit-official-headers.mjs  审计 93 个官方文件头模板的替换结果
  audit-placeholders.mjs      审计 740 个许可证正文里的版权占位符形态
  serve-out.mjs               开发期本地预览 out/ 的极简静态服务器
public/data/                  构建期数据快照（约 19MB，随仓库分发）
src/lib/
  types.ts                    数据模型
  licenses.ts                 人工整理的 32 个许可证（条款字段 + 双语解读）
  spec.ts                     统一规格：人工整理与长尾推断两层的桥接、文件头策略选择
  spdx.ts                     SPDX/ScanCode 数据读取、解析、条款推断、家族映射
  compare.ts                  对比维度定义与事实解析（矩阵与工作台共用）
  fill.ts                     占位符填充（受控白名单）、版权行格式化、注释语法、文件头生成
  generate.ts                 完整产物生成、NOTICE、清单字段、合规自查清单
  genstate.ts                 生成器表单状态与默认值
  wizard.ts                   问卷问题与推荐排序
  matrix.ts                   兼容性提示
  ui.ts                       流程步骤与界面文案（中英双语）
src/components/
  Generator.tsx               应用外壳、步骤导航、「关于」
  Wizard.tsx                  步骤①：问卷与推荐结果（含"跳过问卷"出口）
  ProPicker.tsx               步骤②：列表 + 对比矩阵 + 条款详情 + 对比工作台 + WITH 例外
  Outputs.tsx                 步骤③：版权信息表单、产物选项、生成结果与下载
```

### 测试

```bash
pnpm run test
```

共 **202 项**，全部基于真实数据快照（不需要网络）：

| 文件 | 项数 | 覆盖 |
|---|---|---|
| `generate.test.mjs` | 44 | 全量数据完整性、非必要不改（逐字节比对）、官方文件头、产物、`WITH` 例外 |
| `enrichment.test.mjs` | 41 | 多源融合、分类优先、兼容性查询、义务提示、人工值与推导值的一致性 |
| `flow.test.mjs` | 38 | 流程顺序、无模式切换、默认值、关于页编辑立场、编码损坏与 404 页 |
| `compare.test.mjs` | 22 | 对比维度一致性、事实解析、简介生成、木兰两支区分 |
| `subject.test.mjs` | 17 | 「用来授权」的三层判定（人工 / 规则 / 未判定）|
| `scancode.test.mjs` | 16 | ScanCode 条目、`LicenseRef` 提示、合并目录与检索、英文单语副本剔除 |
| `terms.test.mjs` | 13 | ChooseALicense 词表、`patent-use` 同名反义、条款来源标注 |
| `sort.test.mjs` | 11 | 四种排序键、未判定条目的排位 |

测试用 Node 原生 `node --test` 直接加载 `.ts` 源码，因此源码里的相对导入带显式
`.ts` / `.tsx` 扩展名（配合 `allowImportingTsExtensions`），不需要预先编译。

---

## 版本号与发行

**版本号只在有大改动时才递增。** 小的修复与增补直接覆盖同一个 `v0.1.0` 发行版——
这个项目的受众是"正准备发第一个开源项目的人"，与其让他们比较两个只差几个字
的版本，不如始终给一份最新的。

改动大到**用户需要判断该不该升级**时（例如数据源换了、产物结构变了、
生成结果不再向后兼容），才递增版本号，并在发行说明里写清差异。

覆盖发布时，**标签会跟随到最新提交**，这样发行页的「Source Code」压缩包
与附带的静态站点压缩包内容一致（早期标签停在旧提交上，两者对不上，已修）。

> ⚠️ 强制移动已发布的标签在单人项目里没问题，但它会与协作者的本地标签冲突。
> **一旦这个仓库有了第二个贡献者，就应当改为"每次发布递增版本号"**，不要再移动标签。


---

## 已知限制

- **不是法律意见**。涉及专利、商标、雇佣关系或跨境合规时请咨询专业人士。
- **兼容性提示是经验性判断**，不是判定器。跨许可合并前请核对许可证原文与自家法务意见。
- **生成的文件内容一律使用英文官方措辞**。许可证声明是写给下游使用者和自动化合规工具看的，
  使用非官方译文会削弱可识别性；界面语言只影响解释与提示。
  官方中文/多语言正式文本仅 MulanPSL-2.0、EUPL-1.2 等少数许可具备。
- 长尾条目的**条款布尔字段是正文推断**，不是法律认定；界面已如实标注，做正式判断时请以原文为准。
- 部署到**子路径**时，`public/data/*.json` 的拉取需要调整
  `loadLicenseTexts(basePath)` 的入参（默认按站点根路径处理）。
- `build` 脚本固定使用 `--webpack`。若你的仓库路径含非 ASCII 目录名，
  Turbopack 无法解析 pnpm 的联接布局（报 `Could not find the Next.js package`）。
- 若 `pnpm install` 报 `ERR_PNPM_UNEXPECTED_STORE`，在**本地** `.npmrc` 里固定一个绝对路径即可
  （该文件已被 `.gitignore` 排除，见 `.npmrc.example`）。

---

## 许可证与致谢

本项目自身以 **GPL-3.0-or-later** 发布，作者 **youye-luna**（[github.com/youye-luna](https://github.com/youye-luna)），
见 [`LICENSE`](./LICENSE)。

> 用 `GPL-3.0-or-later` 而不是 `GPL-3.0`：后者是 SPDX 的**废弃**写法，本工具自己就会把它
> 归进「旧名字（已废弃）」。三者正文完全相同，区别只在源文件声明与清单字段里。
>
> 本站的 `LICENSE` 计划由这个工具自己生成，与生成器输出逐字节一致（有测试守着这一点）。
> **当前正文尚未替换**，因此那条测试暂时是红的——见下。

`public/data/` 里的数据来自多个上游，转发时请保留各自的署名要求：

- **SPDX License List** — CC0，许可证正文逐字引用自此处，版权归各原始发布方所有。
- **ScanCode LicenseDB**（[aboutcode.org](https://aboutcode.org/)）— **CC-BY-4.0**，署名要求。
- **OSADL Obligations Checklist**（[osadl.org](https://www.osadl.org/)）— **CC-BY-4.0**，署名要求。
- **ChooseALicense**（[github/choosealicense.com](https://github.com/github/choosealicense.com)）— **CC-BY-3.0**，署名要求。
- **OSI 官方 API** 与 **开放原子《源译识》** 译文 — CC0。

感谢以上项目的维护者把这些数据处理成可机器读取的形式。
