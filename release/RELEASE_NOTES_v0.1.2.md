# LicenseForge v0.1.2

按真实条款差异选开源许可证，一次生成整套合规文件。纯静态站点，浏览器里运行，填写的内容不上传。

**GPL-3.0-or-later** · [youye-luna](https://github.com/youye-luna) · [源码](https://github.com/youye-luna/license-forge)

---

## 下载

`license-forge-v0.1.2-static.zip`——解压后上传到静态托管的**根目录**即可，不需要 Node.js 或构建步骤。包内含 `web.config`（IIS 部署用）与 `DEPLOY.md`。`SHA256SUMS.txt` 用于校验下载完整性。

> **不要直接双击 `index.html`**：页面资源与数据都走绝对路径，且数据是用 `fetch()` 拉取的，`file://` 下浏览器会直接拒绝——这是安全策略，不是包坏了。本机预览请在解压目录里起个服务器，例如 `python -m http.server 8080`。
>
> **部署到 IIS** 请一并带上 `web.config`（补 MIME 与默认文档），并把站点建在根路径。
>
> **子路径部署**（如 `example.com/licenses/`）需要从源码重新构建并设置 `basePath`，详见包内 `DEPLOY.md`。

---

## 本次变更（相对 v0.1.1）

- **REUSE 布局补全**：新增 `REUSE.toml`（REUSE 3.2 的文件级许可声明，替代已废弃的 `.reuse/dep5`），`path = "**"` 覆盖整个仓库、`precedence = "closest"` 让文件内已有的声明头优先——不再只是往 `LICENSES/` 里放文件。
- **声明头可批量落地**：头模板里附带 addlicense 的批量写入命令与 `-check` 的 CI 校验命令，已有声明头的文件会自动跳过、可重复执行。只对措辞能完全对应的 MIT / Apache-2.0 / MPL-2.0 给命令（addlicense 的 `bsd` 不区分 2/3-Clause，所以不给）。
- **检索认识口语写法**：`GPLv3`、`gplv3+`、`Apache 2.0`、`MPL2`、`BSD-3`、`cc by 4.0` 会先归一到 `GPL-3.0-only`、`GPL-3.0-or-later`、`Apache-2.0`、`MPL-2.0`、`BSD-3-Clause`、`CC-BY-4.0` 再匹配；`GPL`、`BSD` 这类指向多个版本的裸词刻意不猜。
- **非 SPDX 条目提示更完整**：除"不能写进清单字段""外部工具可能识别不到"之外，新增"GitHub 只比对一小份已知许可证，仓库页不会显示许可证徽章"。
- **可访问性与元信息**：列表支持键盘导航并补齐 aria 标注；新增 favicon 与 Open Graph 图。
- **工程化**：引入 Biome（lint + format）与 GitHub Actions（lint / typecheck / test / data:check / build）；拆分组件并补 Vitest 组件测试；测试增至 **208 项**。
- **数据溯源**：新增 `public/data/MANIFEST.json`（抓取时间、上游版本与哈希，构建可校验）与包内 `NOTICE-DATA.md` 上游署名。

---

## 包含什么

- 收录 **2469 个**许可证：SPDX 官方名录 740 个 + ScanCode 里名录未收录的 1729 个（Anti-996、各类厂商条款等），其中 923 个标注为非开源。
- 一次生成 `LICENSE`、`NOTICE`、源文件声明头、README 段落、包管理器字段与 REUSE 布局（`LICENSES/` + `REUSE.toml`）。
- **非必要不改**：只替换许可证作者留给使用者的位置（740 个里有 27 个），其余逐字保留官方原文。
- 条款结论分三级可信度并在界面标注：精校 34 个 / 上游标注 47 个 / 正文推断其余。
- 流程四步：问卷选许可 → 选择与对比 → 生成产物 → 关于。左侧支持按来源、作品类型、许可类型分类筛选与排序。
- 详情面板逐条列出「这份许可的几条关键规定」，并用大白话解释；关于页对这 9 条另有逐条说明。

数据来自 SPDX、ScanCode、OSADL、ChooseALicense、OSI 与开放原子，全部在构建期抓取一次，运行时**不访问任何外部 API**，可完全离线使用。

---

## 已知限制

- 不是法律意见；兼容性提示是经验性判断，不是判定器。
- 生成的文件内容一律使用英文官方措辞。
- 长尾许可证的条款结论由正文推断，界面已如实标注。
- `LICENSES/` 下的许可证副本按本项目约定不带扩展名，因此 `reuse lint` 仍会就文件名报不合规；`REUSE.toml` 只负责补齐文件级许可信息，不改这一点。
- 静态包只能部署在域名根路径。

---

## 署名

数据来自多个上游，转发时请保留署名：ScanCode、OSADL 为 CC-BY-4.0，ChooseALicense 内容为 CC-BY-3.0，SPDX 与开放原子译文为 CC0。许可证正文版权归各原始发布方所有。

本项目以 GPL-3.0-or-later 发布。
