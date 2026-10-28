# LicenseForge 项目上下文（迁移自 DSH）

> 这份文档不是使用说明，而是**接手这个仓库时需要的上下文**：为什么这么做、哪些规则不能破、
> 哪些坑踩过、现在停在哪一步。
>
> 面向对象：Trae（或任何其他 AI 编码代理）以及后来的维护者。
> 使用说明与功能清单见 [README.md](../../README.md)。
>
> 迁移来源：DSH（DeepSeek Harness）在 `E:\项目\开源许可证生成器` 工作区的 6 个会话，
> 原始导出与逐会话摘要见 [sessions/](./sessions/) 与 [README.md](./README.md) 索引。

---

## 一、项目是什么

**LicenseForge / 许可证锻造台**：纯静态的开源许可证选择与合规产物生成器。

- 收录 **2469 个**许可证 = SPDX 全量 740 个 + ScanCode 独有 1729 个（另有 86 个 `WITH` 例外）。
- 选定后一次生成：`LICENSE` 正文、`NOTICE`、源文件声明头、README 许可段、
  包管理器 `license` 字段、REUSE 布局的 `LICENSES/` 目录。
- 生成物一律使用**英文官方措辞**；中文只出现在界面解释与提示里。
- 纯静态导出，数据随站点分发，**运行时不联网、不上传任何用户填写的内容**。
- 仓库自身以 `GPL-3.0-or-later` 发布（不是废弃写法 `GPL-3.0`），作者 youye-luna。

立项起点是三份竞品调研（见 [sessions/10d5eb17.md](./sessions/10d5eb17.md)、
[sessions/30c22146.md](./sessions/30c22146.md)）：当时**没有任何一个工具**同时做到
「填齐版权元数据 + 自动附带 NOTICE 与 per-file 声明 + 只用现行 SPDX 标识符 + 双许可 + 中英双语 + 可下载」。
这些缺口就是本项目的产品定义，后续任何功能取舍都回到这条线上。

---

## 二、当前状态（2026-10-10 核对）

| 项 | 状态 |
|---|---|
| 分支 / 远端 | `main` → `origin https://github.com/youye-luna/license-forge.git` |
| 工作区 | 干净（除本次迁移新增的 `docs/` 未跟踪） |
| 最新提交 | `f7c0020 docs: 记录版本号约定；补全 README 的测试表` |
| 已发布 | GitHub Release `v0.1.0`，标签 `v0.1.0` 已随最新提交移动，资产 sha256 与本地打包一致 |
| 测试 | 203 项：**202 通过、1 失败**（失败项是 `flow.test.mjs` 里通过 `git ls-files` 读仓库文件的那条） |
| 构建 | `next build --webpack` 成功；`out/` 可静态部署，`dist/` 有已打包 zip |

### 那条失败测试要看清上下文

`tests/flow.test.mjs` 的「仓库里的文本文件不能出现编码损坏」会用 `git ls-files` 取文件清单。
在 **DSH 沙箱**里子进程管道被禁（`spawnSync git EPERM`），测试无法完成——
这是环境限制，不是代码缺陷。用下面任一方式在正常终端复核：

```bash
pnpm run test                                   # 默认多进程隔离
node --test --test-isolation=none tests/*.test.mjs   # 本沙箱下可跑通的写法
```

同理，在受限沙箱里裸跑 `node --test tests/xxx.test.mjs` 会因无法 spawn 子进程直接报 EPERM。

---

## 三、环境与命令

```bash
pnpm install
pnpm run dev          # 开发服务器
pnpm run build        # 静态导出到 out/（固定 --webpack）
pnpm run test         # 203 项测试，基于真实数据快照，不需要网络
pnpm run typecheck
pnpm run data         # 构建期重新抓取数据（需要网络；仓库已有快照，非必须）
pnpm run data:spdx / data:scancode / data:enrich / data:terms / data:refresh
pnpm run audit:headers        # 93 个官方文件头模板的替换残留审计，应为 0
pnpm run audit:placeholders   # 740 个正文里的版权占位符形态审计
pnpm run package              # 由 out/ + release/ 打出发行 zip 到 dist/
node scripts/serve-out.mjs 4173   # 本地预览 out/，开发自检用
```

环境约束（都已踩过，不要"顺手修一下"）：

- **`build` 必须用 webpack，不能用 Turbopack。** 仓库路径含非 ASCII 目录名时，
  Turbopack 无法解析 pnpm 的符号链接布局，报 `Could not find the Next.js package`。
- **`.npmrc` 里的 `store-dir` 必须是绝对路径且保持稳定。** pnpm 把链接来源记在 `node_modules` 里，
  store 一挪就报 `ERR_PNPM_UNEXPECTED_STORE`。该文件被 `.gitignore` 排除，样例见 `.npmrc.example`。
- **`.gitattributes` 强制 `* text=auto eol=lf`。** 这不是风格洁癖：`LICENSE` 与生成器输出做过
  逐字节一致性核对，检出时换成 CRLF 这条性质就没了。
- **测试用 Node 原生 `node --test` 直接加载 `.ts`/`.tsx` 源码**，所以源码里的相对导入带显式
  `.ts` / `.tsx` 扩展名（配合 `allowImportingTsExtensions`），不需要预先编译。

---

## 四、硬性规则（改代码前必须遵守）

1. **非必要不改：只替换许可证作者自己留出的位置。**
   判定"有没有可填位置"的方式是**先替换、再看结果**，不是靠推测性正则。
   `SLOT_PATTERNS`（`src/lib/fill.ts`）是一张**受控白名单**，每条都对应一个已核实的真实文本片段。
   正文没留位置的一个字都不加（Apache-2.0、MPL-2.0、Zlib、Unlicense、CC0 等）。
   示例区（GPL 的 "How to Apply These Terms"）、写给读者的说明（FTL 的 `Please replace <year>…`）、
   正文反复引用的定义变量（LPL-1.0 的 `<OWNER>`）一律原样保留。
2. **替换后必须做残留检测，绝不静默输出。** 仍像占位符的 token 要报到界面上；
   脚注编号（如 W3C 的 `[1]`）显式排除，避免误报淹没真风险。
   URL 段（`<https://www.gnu.org/licenses/>`）替换前先保护；`[2019]` 这类具体值不替换。
3. **只用现行 SPDX 标识符。** GPL 家族强制显式选择 `-only` / `-or-later`，
   声明头按选择生成不同措辞，并有测试断言二者必须不同。
   32 个废弃标识符**仍然可以生成**（历史项目有时必须沿用），但必须给出明确警告。
4. **`WITH` 例外三处一致**：表达式、例外正文（`LICENSE.<ID>`）、清单字段。
   86 个例外，REUSE 布局下也会为例外生成可校验副本。
5. **把强制义务做实。** Apache-2.0 的 NOTICE（§4(d)）在界面上关不掉，并提示不要整体覆盖仓库里已有的 NOTICE；
   每个许可证都附一份"生成后仍需你做的事"清单。
6. **讲代价，不只讲好处。** 明确写出 MIT 对专利只字未提（而不是打勾或留空）；
   纠正"GPL 不能商用"与"GPL-3.0 适用于网络服务"（那是 AGPL）这两个流传极广的错误。
7. **生成物一律英文官方措辞。** 界面语言只影响解释与提示。
   具备官方中文/多语言正式文本的只有 MulanPSL-2.0、EUPL-1.2 等少数许可。
8. **条款字段有三级可信度，界面必须如实区分**：精校（本项目逐条核对，32 个，绿）、
   ChooseALicense 上游标注（47 个，绿）、正文关键词推断（其余，橙「由正文推断，非权威认定」）。
   推断值不得显示成权威认定，也不得写成确定值。
9. **版号策略：只在大改动时递增。** 小修复直接覆盖同一个 `v0.1.0` 发行版，
   覆盖时标签跟随最新提交（单人项目做法）。**一旦有了第二个贡献者，就应改为每次发布递增版本号，
   不再移动标签**——这条已经写进 README，不要悄悄违背。
10. **测试是护栏，不是障碍。** 逐字节比对、REUSE 默认值、`-only`/`-or-later` 措辞差异、
    四组同文不同名条目的独立性、404 页与编码损坏检测，都是刻意设置的断言；
    让测试变绿的正确方式是改实现，不是放宽断言。
11. **不得编造，不确定就标"未核实"。** 数据源与调研类产出一律基于实抓结果；
    "看着有但拿不到"必须与"真能接入"分开写。没有中文出处时写"本站未收录该许可的中文文本"，
    **禁止**断言"该许可没有中文版本"（有用例守着）。
12. **项目自身许可标识用 `GPL-3.0-or-later`**，不要写成废弃的 `GPL-3.0`。
13. **对外写操作必须先得到明确指令**（原先由用户立规）：不得 `git push`、不得
    `gh release create/edit/upload/delete`。本地改动、测试、构建、打包照常，但发布前必须先问一句。
14. **绝不用 PowerShell 读改写源码文件**，一律用 `edit` 工具或 node 脚本。
    `Get-Content | Set-Content` 往返会同时加 BOM（SWC 认不出 `'use client'`，客户端组件掉出 manifest）
    并按 GBK 误解码 UTF-8 —— 这个坑已复发两次，`package.json` 的 `description` 被写坏并**提交进过仓库**。
15. **不自造法律声明。** 官方文件头模板（93 个）优先于自写声明；没有官方模板的给 SPDX / REUSE
    两行式，不自己编一段"看起来像法律声明"的文字。
16. **术语必须说人话。** 界面文案走大白话，专业术语要么配白话解释、要么收进可展开区，
    不允许出现未解释的 `SBOM`、`官方文件头` 这类行话。
17. **不确定的判定原样保留。** OSADL 给的 `Unknown` / `Check dependency` 不改写成确定值。
18. **商标默认写"不授权"而不写"没提到"。** ChooseALicense 的 `trademark-use` 语义是"明确声明不授予商标权"，
    没有这句的实质上也不授权。**背书（endorse）与促销（promote）必须分开判定**，
    只认"名字 + endorse/promote 同现"的句式；Apache-2.0 有商标条款但不禁止背书（有测试守着）。
19. **分类标签全站统一**：宽松型 / 公共领域型 / 著作权型（文件级·整个项目·含网络使用）/ 内容与数据型 /
    非开源型 / 未能判定 —— 下拉与详情面板共用同一份 `FAMILY_LABEL`。
20. **不合并上游"同键不同文"的条目**（用户明令）：`linum`、`ms-refl`、`ralf-corsepius`、
    fuchsia/fuschia 等 ScanCode 内部同文不同名条目保持分开登记；
    反过来像 `-en` 这种英文单语副本属于真重复，必须剔除（2469 = 2476 − 7 个 `-en`）。
21. **`LICENSES/` 下的文件名不带扩展名**（用户决定，**偏离 REUSE 3.0**）：
    界面文案里必须写明这会让 `reuse lint` 报不合规。
22. **改动后必须跑完三部曲**：`pnpm test` + `pnpm run typecheck` + `pnpm run build`（`--webpack`）；
    打包后下载复验 SHA256 必须本地 = 远端。
23. **README 的测试表必须列全 `test` 脚本涉及的每个测试文件**（有防漂移测试守着）。
24. **不要动 `src/lib/ordering.ts` 的文件名。** 叫 `sort.ts` 时 `next build --webpack` 会失败，
    报错却指向未被修改的 `Generator.tsx`（`Could not find the module … in the React Client Manifest`）；
    机制未查明，已用测试把文件名钉死。

---

## 五、工程约定

- **分层**：`src/lib/` 放纯逻辑（可被 `node --test` 直接加载，不依赖 DOM），
  `src/components/` 放界面；`scripts/` 全是构建期数据抓取与审计脚本。
- **数据构建期抓取、运行时零请求**。所有上游数据落成 `public/data/*.json` 快照随仓库分发，
  任何人可重跑抓取脚本核对。首屏只取目录（约 1.2MB 元数据），
  选定 SPDX 许可证才拉 5.3MB 全文、选定 ScanCode 独有条目才拉 13MB 全文。
- **`src/lib/spec.ts` 是统一规格层**：桥接"精校的 32 个"与"长尾推断"两层，并决定文件头策略。
- **源文件声明头优先用官方模板**：93 个许可证自带 `standardLicenseHeader`，存在就一定优先用；
  没有的给 SPDX / REUSE 推荐的两行式写法，不自己编一段"看起来像法律声明"的文字。
- **打包的四条硬要求**（见 `scripts/package.mjs` 头注释）：ZIP 内路径必须用正斜杠
  （Windows `Compress-Archive` 会写反斜杠，解压后路径错乱）；不打包启动脚本与 `node_modules`；
  `web.config` **只能用 IIS 默认就有的配置节**，一个不存在的属性就能让整站 500（仓库里有测试守着）。
- **界面流程是一条线，不做模式切换**：问卷 → 选择与对比 → 生成产物 → 关于。
  「跳过问卷」只换一个默认值（REUSE 默认开启），不换一套逻辑（有测试守着）。
- **`src/lib/ui.ts` 承载界面文案与步骤定义**，中英双语，改文案看这里。

---

## 六、数据加工的坑（重跑抓取脚本前必读）

1. **不要把局部排除当成整体拒绝。** MPL-2.0 正文里有 "no patent license is granted by a Contributor: (a)…"，
   但它同时明文授予专利许可；早期用 `no patent` 匹配把 MPL 判成"明确不授权"。
   BSD-3-Clause-Clear 的全大写句里同时出现 `PATENT` 与 `GRANTED`，判定顺序反了就会把明确拒绝判成明确授权。
2. **不要把"分类相同"当成"条款相同"。** AGPL 与 GPL 在 ScanCode 里同属 copyleft 大类，
   但只有 AGPL 有网络触发义务 —— **网络触发必须看正文**。
3. **ChooseALicense 的 `patent-use` 同名反义**：在 permissions 里是"明确授予专利权"，
   在 limitations 里是"明确**不**授予"。合并时不分命名空间，Apache-2.0 与 BSD-3-Clause-Clear 会被判成同一类。
4. **ScanCode 的分类不覆盖独有条目。** enrichment 只覆盖 SPDX 列表内的 740 个；
   家族判定必须先查 enrichment，查不到再退回条目自带的 `category`，否则 1729 个长尾会全默认成 permissive。
5. **上游字段坑**：
   - SPDX 详情分两条路径且字段名不同：许可证走 `json/details/<ID>.json` 的 `licenseText`，
     例外走 `json/exceptions/<ID>.json` 的 `licenseExceptionText`。
   - ScanCode 该站 404 时返回的是 **9KB 的 HTML 错误页**，必须按内容嗅探挡住；
     它的 `standard_notice` 字段实测恒为 `null`，不能当文件头来源；
     非 SPDX 条目的正文按索引里的 `license` 字段给的 URL 取，**不要自己拼 key**。
   - OSADL 的 `matrix.json` 顶层混着 `timeformat` / `timestamp` / `disclaimer` 等元数据键，必须剔除；
     `sourcedisclosure.json` 的内部键名是 `disclosure`，与文件名不一致。
   - OSI API 覆盖不完整（只有 126 条，连 AGPL/GPL 系列都没有，而 SPDX 标为 OSI-approved 的有 154 个）：
     **OSI 认证状态一律以 SPDX 为准**，该 API 只用于补充它独有的 `keywords`。
     `api.opensource.org` 的 `approved` 字段不是 OSI 认证（126 条里仅 7 条 true），禁止用它覆盖 `isOsiApproved`。
     另：ClearlyDefined 已判定不可用，不得作为许可证元数据源。
   - ScanCode LicenseDB 的索引端点是 `index.json`（2733 条），`licenses.json` 是 404。
   - 开放原子项目的 `git/trees?recursive=1` **只返回顶层**，不递归展开子目录；
     文件名有拼写错误（`BDS-3-clause`），因此构建期做**显式映射**而不是靠字符串猜。
     只记录**链接**不抓取译文正文：译本的法律效力需读者自行判断。

---

## 七、数据来源与覆盖（含实测结论）

| 来源 | 提供什么 | 覆盖 | 许可 |
|---|---|---|---|
| SPDX License List | 标识符、全量正文、93 个官方文件头、OSI/FSF 状态 | 740 + 86 例外 | CC0 |
| ScanCode LicenseDB | 权威 `category`、归属方、主页，及 SPDX 未收录的正文 | 分类 726/740；独有 1729 | CC-BY-4.0 |
| OSADL Obligations Checklist | 兼容性矩阵、copyleft 判定、源码披露义务 | 115 许可 / 13225 条判定 | CC-BY-4.0 |
| ChooseALicense | 条款字段上游标注 | 47 主流许可 | CC-BY-3.0 |
| OSI 官方 API | `keywords`（superseded 等）、批准日期 | 123/740 | — |
| 开放原子《源译识》 | 中文审定稿链接 | 15 | 译文 CC0 |

实测得到的接入结论（[sessions/a33ec8ac.md](./sessions/a33ec8ac.md)、[sessions/9c0c4fe6.md](./sessions/9c0c4fe6.md)）：

- **OSADL 是最佳可下载兼容性数据集**（`matrix.json` 实测 200，约 118 许可证 / 约 14000 条判定，CC-BY-4.0），
  另有 `copyleft.json`、`sourcedisclosure.json`（内部键 `disclosure`）。
- **EU JLA 的兼容性判定无法程序化获取**（纯 JS 渲染、无 API、无导出、无仓库；
  `?_format=jsonld` 只有元数据）。可用的只是它自身的 "For software" / "For data and metadata" 标签。
- **GNU 侧**：本环境 `gnu.org` 完全无法 fetch，`license-compatibility.html` 内容**至今未核实**；
  只能取 GWDG 镜像的 2007 年版 license-list（约 90 条判定，时效性存疑）。
- **中文译本**：源译识已迁至 AtomGit，经 GitCode API 获取（10 个审定稿：MIT、BSD-3-Clause、Apache-2.0、
  GPL-2.0/3.0、LGPL-2.1/3.0、AGPL-3.0、EPL-2.0、MPL-2.0，译文 CC0）；
  木兰 PSL-2.0 官网 `license.coscl.org.cn` 已挂，正文改用 SPDX 仓库文本，
  其第 6 条「以中文版为准」需在工具中突出；EUPL-1.2 有 23 种语言但**不含中文**；
  CC BY 4.0 官方中文译本等同英文原文，不是本地化 port。
- **条款布尔字段没有任何单一来源**：必须组合 LicenseDB + SPDX + ChooseALicense + OSADL + Blue Oak，
  精确数据只覆盖 47–225 个许可证（6%–30%），其余一律 `confidence: inferred`。
- 仍**未被工具采用**的候选项（调研结论已确认可用，落地与否未确认）：
  OSADL 的 `explanation` 字段为每一对兼容性附了法律理由，可直接当 UI 提示文案；
  Blue Oak 的 `list.json`（225 条、五档评级）；GNU 清单 HTML 里的文档/其他作品/字体三个适用范围章节
  （全网唯一权威的"适用范围"来源，但需自写解析器，gnu.org 本机不可达，只能走镜像）。
- 中文侧唯一有 API 的平台是 Gitee（`/v5/licenses` 返回 48 个 SPDX ID，含 MulanPSL）；
  其余中文工具站（菜鸟工具、tool.lu、OSCHINA、bejson、站长工具、toolhelper）**均无 LICENSE 生成器**。
- 未找到 TLDRLegal / FOSSA / Snyk 的公开兼容性数据集。

---

## 八、未决事项与已知遗留

**代码/文档层面**

1. `README.md` 第 40 行仍写「123 项测试」，与实际的 203 项不一致（第 317 行的表格是准的）。
2. `README.md` 结尾仍写「本站 `LICENSE` 正文尚未替换，那条测试暂时是红的」——正文其实已经替换，
   这条说明已过时。
3. `LICENSE` 与生成器输出是否仍逐字节一致，需要在正常终端跑一次完整测试确认（本沙箱有 1 项被环境挡住）。
4. 部署到子路径时，`public/data/*.json` 的拉取需调整 `loadLicenseTexts(basePath)` 的入参（默认按站点根路径）。

**数据层面**

5. `gnu.org` 不可达导致 GNU 兼容性清单未核实，只能依赖 2007 年版镜像。
6. 开放原子《开源法律手册》PDF、CERN OHL 硬件适用范围、CC 中文译本法律效力均「未核实」。
7. 调研结论（JLA 适用对象标签、源译识 10 个审定稿、OSADL 增量更新）是否已全部落地进工具数据，
   没有在会话里逐项确认。

**产品层面**

8. 木兰公共许可证 MulanPubL v2 不在 SPDX 列表内，标识符只能是
   `LicenseRef-scancode-mulanpubl-2.0`，不能写进 `package.json` 的 `license` 字段（界面有警告级提示）。
9. 53 个被判定为非开源的条目在选用时给 error 级提示 —— 这是刻意的产品选择，不要改成静默过滤。
10. MulanPubL 的**官方中文正文**未入库：官方站点构建期返回 502，站内只有 ScanCode 的纯英文副本，
    界面给官方地址但没抓正文（曾提议从镜像抓取并逐字校验，用户未答复）。
11. `LICENSES/` 文件名无扩展名 → `reuse lint` 会报不合规（已作为规则登记，但仍属已知偏离）。

**部署与环境层面**

12. **IIS 部署问题未闭环**：用户反馈的"无样式 / 500 / 没有此项目语言"始终没给出 F12 状态码与站点绑定信息，
    无法复现。已交付的判据只有两条：**站点必须建在根路径**（子路径下 `/_next/...` 全 404，`web.config` 修不了），
    以及**补 `.json`/`.mjs`/`.txt` 的 MIME 映射**。
13. **打包产物不能双击运行**：`file://` 下 origin 为 `null`，浏览器直接拒绝 `fetch()`，
    **把资源改成相对路径也解决不了**；因用户要求启动脚本已从包内移除，只能命令行起服务器或部署到托管。
14. **子路径部署不支持**，需改 `basePath` 重新构建；GitHub Pages 未部署。
15. 本机 `github.com:443` 直连不通，git 需配**只对 github.com 生效**的代理（曾用 `http://127.0.0.1:7897`）。
16. `.cmd` 脚本里不能出现非 ASCII 字节：cmd.exe 按控制台代码页解析批处理，中文会误解码甚至中断解析。
17. `web.config` 里写 `rewrite` 会因缺 URL Rewrite 模块报 **500.21**，
    `requestFiltering` 属性写法报 **500.0** —— 比不写更糟（有测试断言，断言前先剥离 XML 注释）。

**曾提出但未实施的方向**（不要当成已定需求）：CLI / GitHub Action、用 OSADL 矩阵扫真实 `package.json`
的依赖树兼容性检查、打标签自动构建 + 发布 Release + 部署 Pages 的 Actions 工作流、`npm run release` 一键发布脚本。

---

## 九、会话索引

| 会话 | 主题 | 摘要 |
|---|---|---|
| `10d5eb17` | 国际同类工具竞品调研（choosealicense / SPDX / JLA / CC / 第三方生成器）+ 行业共性问题 TOP 10 | [摘要](./sessions/10d5eb17.md) |
| `30c22146` | 中文/面向中国开发者的同类工具调研（OpenLicr 已下线、Gitee API 是唯一有 API 的中文平台） | [摘要](./sessions/30c22146.md) |
| `9c0c4fe6` | 结构化条款数据源实测调研（无单一源提供条款布尔字段） | [摘要](./sessions/9c0c4fe6.md) |
| `a33ec8ac` | 兼容性 / 适用对象 / 中文译本数据源调研与逐个 URL 实测 | [摘要](./sessions/a33ec8ac.md) |
| `39362a4a` | **主会话**：从竞品分析到完整实现、测试、打包、发布与验证 | [摘要](./sessions/39362a4a.md) |
| `d8d33995` | 把 DSH 工作区上下文迁移进 Trae CN 同一工作区（即本次迁移） | [摘要](./sessions/d8d33995.md) |

每份摘要都配了同目录上一层的**完整会话导出**（`../session-<id>.md`，readable 模式，
含用户消息、助手回复与工具调用），需要核对原始语境时直接查那里。

---

*本文件由 DSH 会话迁移生成，最后核对于 2026-10-10。若与代码实际行为冲突，以代码与测试为准，并请顺手更正本文档。*
