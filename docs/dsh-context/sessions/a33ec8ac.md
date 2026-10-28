# 会话摘要 · a33ec8ac

- 原始导出：[session-a33ec8ac.md](../session-a33ec8ac.md)
- 时间：2026-10-06 23:04（创建）/ 2026-10-10 16:20（导出）
- 主题：为开源许可证工具调研可程序化接入的许可证兼容性数据、适用对象标签与中文官方译本，并实测验证每个来源。

## 用户诉求

1. 以"数据源调研员"身份为开源许可证工具补齐**兼容性**与**适用场景**数据，并获取**中文官方译本**，要求用 web_search / web_fetch 实际访问验证后输出中文调研结果。
2. 调研 EU Joinup / Interoperable Europe Licensing Assistant 的兼容性检查器：背后数据是否可下载或有 API、兼容性检查器页面实测能拿到什么、是否有 JSON/CSV 导出或 GitHub 仓库。
3. 调研 GNU 官方兼容性清单（license-compatibility.html 与 license-list.html）能否结构化解析、共有多少条兼容性判定。
4. 搜索是否存在其他公开的许可证兼容性矩阵数据集（license-compatibility、oss-license-compatibility、TLDRLegal、FOSSA/Snyk 公开数据等）。
5. 调研"适用于软件/内容/硬件/字体/数据"的权威标签依据：Creative Commons 关于"不要用于软件"的官方说明、CERN OHL 对硬件的适用范围、SIL OFL 对字体的适用范围，以及是否存在统一的"许可证适用对象"数据集。
6. 调研中文官方/权威译本：开放原子开源基金会的《开源法律手册》与"源译识"双语许可合集（找到实际可下载的 PDF/仓库地址并列出所含许可证 ID）、license-translation 项目的许可证范围/格式/可否程序化提取、木兰许可证官方中英文本、EUPL 多语言正式文本（是否含中文）、CC 官方中文译本及其法律地位说明。
7. 输出要求：每项给出名称、**亲自 fetch 成功的实测可用 URL**、内容格式、覆盖范围、许可授权情况、可用性评估（能否程序化接入）、缺点；最后一节给出"可以实际接入的方案"，区分真正能拿到的数据与"看着有但拿不到"的；禁止编造，不确定的标注"未核实"，总长 1500 字以内，用 markdown 链接标注来源。

## 关键产出

本次会话为纯调研任务，**未改动或新增任何仓库文件**；成果是一份调研报告，通过 `send_message` 发送给父会话 `session-39362a4a`，另在会话末尾做了简短口头小结。

调研结论与可用数据源清单（按报告章节）：

- **兼容性数据**
  - **OSADL 是最佳可下载数据集（最大发现）**：`https://www.osadl.org/fileadmin/checklists/matrix.json` 实测 HTTP 200，约 118 个许可证、约 14000 条兼容性判定，CC-BY-4.0 授权；另有 CSV、解释版 JSON、copyleft 表（`copyleft.json`）以及带时间戳的增量更新机制。已确认 [`osadl-matrix`] 类 PyPI 包无官方 API，仅作参考。
  - **EU JLA（Interoperable Europe Licensing Assistant）**：兼容性检查器为纯 JS 渲染，**无 API、无导出、无 GitHub 仓库**；平台为 Drupal，支持节点级 RDF 元数据导出（`?_format=jsonld`，实测仅元数据、不含判定）；各许可证页面 URL 可预测（如 `/licence/apache-license-version-20`），覆盖 53 个许可证，带 Can / Must / Cannot / Compatible / Law / Support 五类分类维度，并有 "For software" 与 "For data and metadata" 标签；另有独立的 EUPL 兼容 OSI 许可证矩阵页（`/page/eupl-compatible-open-source-licences`）。
  - **GNU**：`gnu.org` 在本环境**完全无法 fetch**（多次重试全部失败），`license-compatibility.html` 内容**未核实**；仅通过 GWDG 镜像 `http://ftp1.gwdg.de/pub/gnu/www/savannah-checkouts/gnu/www/licenses/license-list.html` 取得 2007 年版 license-list，约 90 条判定，按 GPL 兼容 / GPL 不兼容自由软件 / 非自由 / 文档 / 字体等类别组织。
  - **其他来源**：TLDRLegal / FOSSA / Snyk 公开数据集**未找到**；libraries.io 的 `license-compatibility` gem 已过时且为 Ruby 实现，可用性低。
- **适用对象（软件/内容/硬件/字体/数据）标签**
  - CC 官方在 FAQ（`#can-i-apply-a-creative-commons-license-to-software`）明确说明不推荐将 CC 许可用于软件，并指向 FSF/OSI；CC 另有中文 FAQ 覆盖国际译本议题。
  - SIL OFL：官方正文 `https://openfontlicense.org/open-font-license-official-text/` 对字体适用范围说明充分，并明确只有英文原文具有权威性。
  - CERN OHL：官网（`https://cern-ohl.web.cern.ch/licences`）可访问但文档页内容稀疏，硬件适用范围判定**部分未核实**。
  - 结论：不存在跨来源统一的"许可证适用对象"数据集；最具体的现成选项是 JLA 的 "For software" / "For data and metadata" 分类标签（可跨 53 个许可证抓取）。
- **中文译本**
  - **开放原子 / "源译识"**：仓库已从 GitHub、Gitee 迁移至 AtomGit，可通过 GitCode API 程序化访问（`https://api.gitcode.com/api/v5/repos/translation/license-translation/git/trees/master?recursive=1`）；确认 **10 个审定稿**：MIT、BSD-3-Clause、Apache-2.0、GPL-2.0、GPL-3.0、LGPL-2.1、LGPL-3.0、AGPL-3.0、EPL-2.0、MPL-2.0（后两者含 FAQ），另有双语合集 PDF；译文授权为 CC0（合集另涉 CC-BY-4.0）。《开源法律手册》PDF 存在于 AtomGit 上，但**未能实际下载验证内容**。
  - **license-translation 项目**：GitHub（OpenAtomFoundation/legal-license-translation）与 GitCode 镜像（oxytoc、xueyangjie）均存在，格式为评审稿/审定稿文本，配合上述 API 可程序化提取。
  - **木兰 PSL-2.0**：`http://license.coscl.org.cn/MulanPSL2` 无法访问（coscl 站点挂掉）；中英全文改从 SPDX 仓库取得（`https://raw.githubusercontent.com/spdx/license-list-data/main/text/MulanPSL2-2.0.txt`），并提示其第 6 条"以中文版为准"这一特性值得在工具中突出。
  - **EUPL-1.2**：提供 23 种欧盟官方语言（PDF 与结构化文本），**不含中文**。
  - **CC BY 4.0**：中文官方译本 `https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans` 确认可用，属 4.0 官方语言译本（等同英文原文而非本地化 port）；其法律效力未在所查页面明确说明，标注为待核实。

## 结论与遗留

- **结论**：真正的可下载兼容性数据集是 OSADL（matrix.json / CSV / copyleft.json，约 118 许可证、约 14000 条判定，CC-BY-4.0），而非 EU Compatibility Checker；JLA 的兼容性判定无法程序化获取，但其自身的"适用对象"分类标签可用；中文译本方面开源原子源译识（经 GitCode API，10 个审定稿，CC0）与 CC BY 4.0 官方中文译本可直接接入，木兰 PSL-2.0 中英全文可经 SPDX 取得。
- **明确的决定**：报告中专设"可以实际接入的方案"一节，区分真实可得数据与"看着有但拿不到"的来源；对无法核实的内容一律标注"未核实"而非推测。
- **遗留 / 待确认**：
  - `gnu.org` 在本环境不可 fetch，`license-compatibility.html` 内容仍未核实；GNU 判定数据只能依赖 2007 年版 license-list 镜像，时效性存疑。
  - 开放原子《开源法律手册》PDF 未实际下载验证，其许可证覆盖面未知。
  - CERN OHL 硬件适用范围官方说明未完整核实。
  - CC 官方中文译本的法律效力/地位未获官方明示。
  - 未找到 TLDRLegal / FOSSA / Snyk 的公开兼容性数据集。
  - 调研结果是否已被父会话落地到工具数据中，本次会话内无信息。
