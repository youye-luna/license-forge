# 第三方数据署名（NOTICE）

LicenseForge 的许可证数据在构建期从多个上游抓取，随发行包一起分发。
其中若干上游要求再分发时署名，本文件即为该署名。详细部署说明见 `DEPLOY.md`。

## 数据来源与许可

| 来源                                                                                                      | 许可             | 本项目如何使用                                                   |
| --------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| [SPDX License List](https://spdx.org/licenses/)（Linux Foundation）                                       | CC0-1.0          | 标识符、许可证与例外正文、官方文件头模板、OSI/FSF 状态，逐字保存 |
| [ScanCode LicenseDB](https://scancode-licensedb.aboutcode.org/)（AboutCode / nexB）                       | **CC-BY-4.0**    | 非 SPDX 许可证的正文与元数据、`category` 分类、归属方、主页      |
| [OSADL Obligations Checklist](https://www.osadl.org/Checklists)（Open Source Automation Development Lab） | **CC-BY-4.0**    | 许可证兼容性矩阵与义务判定                                       |
| [ChooseALicense](https://github.com/github/choosealicense.com)（GitHub, Inc.）                            | **CC-BY-3.0**    | 条款字段的上游标注（专利、商标、改动标注、网络触发）             |
| [OSI 官方 API](https://opensource.org/api/licenses)（Open Source Initiative）                             | 数据本身不附许可 | 许可证的关键词标签与批准日期                                     |
| [开放原子《源译识》](https://gitcode.com/translation/license-translation)                                 | 译文 CC0         | 部分许可证的中英对照审定稿链接                                   |

## 修改说明

- 各来源的数据被**合并**为 `data/` 下的 JSON 快照（例如 SPDX 元数据与 ScanCode 分类按标识符合并）；
- 许可证与例外正文**逐字保存**，未作改写。生成器只在许可证作者预留的位置（版权行、示例段落）填入用户信息；
- 分类、家族、条款字段存在推导：界面会标注每条结论来自「逐条精校」「上游标注」还是「正文推断」。

## 许可证正文的版权

`data/license-texts.json` 与 `data/scancode-texts.json` 中的许可证正文，
版权归各许可证的原始发布方所有，此处为逐字引用。使用或再分发这些正文时，
请同时遵守各许可证自身条款。

## 本项目自身

LicenseForge 的代码以 **GPL-3.0-or-later** 发布，源码见
<https://github.com/youye-luna/license-forge>。
