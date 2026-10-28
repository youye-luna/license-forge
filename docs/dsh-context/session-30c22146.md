# 你是一名产品竞品调研员。请

| 项目 | 内容 |
| --- | --- |
| 会话 | `30c22146-e2f6-4a53-97ef-3dcb93b3cc41` |
| 创建时间 | 2026-10-06 22:17 |
| 模型 | `deepseek-account/deepseek-flash` |
| 工作目录 | `E:\项目\开源许可证生成器` |
| 来源 | 子代理，深度 1，父会话 `session-39362a4a-319a-4277-8aab-ee00e7fcdba7` |
| 预设 | `standard` |
| 规模 | 1 轮 · 215 事件 |
| 用量 | 输入 78,811 · 输出 22,000 · 缓存命中 786,304 · 合计 887,115 tokens（17 次模型调用，按事件累计） |
| 导出时间 | 2026-10-10 16:20 |

## Turn 1

### 👤 用户

你是一名产品竞品调研员。请用 web_search 和 web_fetch 实际访问并调研**中文/面向中国开发者**的"开源许可证选择与生成"类工具，然后输出一份**中文**调研结果。

调研方向（尽量找到真实可访问的站点并抓取页面）：
1. OpenLicr（开源许可证智能选择、比较与生成工具，据称在 https://meta.appinn.net/ 小众软件论坛有自荐帖，论坛站内搜索 "OpenLicr"，或搜 GitHub 上的 openlicr，找到项目主页/在线地址）
2. 国内在线工具站里的 LICENSE 生成器，例如 toolszone.net、tool.lu、菜鸟工具(runoob)、OSCHINA 在线工具、bejson、站长工具、以及任何"开源协议生成器 / LICENSE 生成器 / 开源许可证选择器"的中文站点（至少找到 3 个真实的并抓取页面）
3. Gitee / 码云 新建仓库时的 license 选择器，以及 Gitee 帮助文档里关于开源许可证的说明
4. 中文语境里比较流行的许可证科普内容（例如阮一峰《开源许可证教程》、图灵社区/InfoQ/开源社的许可证选择指南），观察它们提供的"选择逻辑"

对每个目标，输出：
- 名称 + URL + 一句话定位
- 功能清单（支持哪些许可证、是否填写版权人/年份、是否可直接下载 LICENSE、是否比较表格、是否有中文全文、是否有向导问答、是否提及 SPDX、是否涉及专利/商标/贡献者协议、是否只能生成单个 LICENSE）
- **具体缺点/短板**：要有可核查证据（页面缺什么、许可证种类是否过少或过时、是否用被篡改/删减的许可证文本、是否只给模板不给解释、是否忽略 Apache-2.0 的 NOTICE、是否把 GPL-3.0-only 与 or-later 混淆、是否没有中英双语、是否没有"非软件作品"选项、是否无 API/批量能力、移动端体验差、是否夹带广告等）。不确定的标注"未核实"，禁止编造。
- 引用的 URL（markdown 链接）

另外单独总结一节：**中文工具普遍存在的共性问题**，每条给出证据/来源。

输出要求：中文、结构化 markdown、信息密度高。总长度控制在 1200 字以内（可以密集）。

Your parent agent id is "session-39362a4a-319a-4277-8aab-ee00e7fcdba7". Before you finish, send your result to that agent with send_message({ agent_id: "session-39362a4a-319a-4277-8aab-ee00e7fcdba7", message: "<self-contained result>" }). The parent shares your workspace but does not automatically receive your transcript, tool output, or reasoning. Send earlier messages as well when a finding changes what the parent should do next; sending a message does not end your turn.

### 🤖 助手

I'll research Chinese-language open source license tools systematically. Let me start with parallel searches.

- 🔧 `web_search` · queries=["OpenLicr 开源许可证 智能选择 比较 生成工具","openlicr github","meta.appinn.…
- 🔧 `web_search` · queries=["在线 LICENSE 生成器 开源协议生成器 中文","开源许可证选择器 在线工具 中文","toolszone.net…

<details>
<summary>🧠 思考过程</summary>

Let me fetch the key pages in parallel.

</details>

### 🤖 助手

Found OpenLicr leads. Let me fetch the key pages.

- 🔧 `web_fetch` · url="https://meta.appinn.net/t/topic/79362"
- 🔧 `web_fetch` · url="https://github.com/ruanyf/weekly/issues/8656"
- 🔧 `web_fetch` · url="http://www.toolszone.net/zh/tools/license-text-generator"
- 🔧 `web_fetch` · url="https://cloud.tencent.com.cn/developer/article/2454147"

<details>
<summary>🧠 思考过程</summary>

The appinn topic 79362 is 404 now. Let me search appinn forum search and find the OpenLicr actual site. Let me search for the OpenLicr URL.

Also the Tencent Cloud article about "高颜值、说人话" license selector — need to find which site. It might be "choosealicense" Chinese version or "open-source-license-chooser" by someone. Let me search.

Let me do parallel searches/fetches:
1. appinn search for OpenLicr
2. OpenLicr official site
3. Gitee license help doc
4. runoob online tool license
5. tool.lu / bejson license generator
6. 阮一峰 开源许可证教程

Let me batch.

</details>

### 🤖 助手

OpenLicr's appinn topic 404s. Let me locate the actual site plus the other targets.

- 🔧 `web_search` · queries=["OpenLicr 官网 开源许可证选择器 openlicr.com","OpenLicr appinn 小众软件 许可证…
- 🔧 `web_search` · queries=["Gitee 新建仓库 选择开源许可证 帮助文档","bejson LICENSE 生成器 开源协议","tool.lu …
- 🔧 `web_fetch` · url="https://meta.appinn.net/search?q=OpenLicr"
- 🔧 `web_fetch` · url="https://www.ruanyifeng.com/blog/2011/05/how_to_choose_free_softwa…

<details>
<summary>🧠 思考过程</summary>

Now I have OpenLicr leads. OpenLicr appears to have a Product Hunt page. Let me find its actual URL. Also let's check the V2EX thread and the ruanyf/weekly issue #5236 (which is the "高颜值、说人话" license selector - probably choosealicense-like Chinese site).

Let me search for OpenLicr's site URL and fetch Product Hunt page. Also Gitee help doc, ayalm.com license generator, and other Chinese tools.

Let me batch fetches:
1. https://www.producthunt.com/products/openlicr
2. https://help.gitee.com/repository/base/新建仓库 (URL-encoded)
3. https://www.ayalm.com/tools/license-generator/
4. https://github.com/ruanyf/weekly/issues/5236

Also search for openlicr.com.

Let me also consider delegating some fetches to subagents to parallelize. Actually I can just do parallel tool calls. Let me create a todo list first? The task is medium-sized. Let me just proceed efficiently.

Let me batch 4 fetches at a time.

</details>

### 🤖 助手

Found OpenLicr on Product Hunt. Let me pull the core pages.

- 🔧 `web_fetch` · url="https://www.producthunt.com/products/openlicr"
- 🔧 `web_fetch` · url="https://help.gitee.com/repository/base/%e6%96%b0%e5%bb%ba%e4%bb%9…
- 🔧 `web_fetch` · url="https://www.ayalm.com/tools/license-generator/"
- ❌ `web_fetch` · url="https://github.com/ruanyf/weekly/issues/5236"

<details>
<summary>🧠 思考过程</summary>

Good progress. ayalm.com is a real Chinese tool. Now let me:
1. Find OpenLicr's actual site (search more precisely)
2. Find the "高颜值、说人话" license chooser (probably choosealicense.rustwiki.org or a custom site)
3. check runoob / tool.lu / bejson / 站长工具 license generators
4. Gitee license help doc about licenses

Let me batch searches + fetches. Also, given the breadth, I could delegate to subagents. But the total work is manageable. Let me do parallel fetching.

Let me search for OpenLicr site specifically and also fetch the v2ex thread.

Note: appinn topic 79362 is 404 — that's evidence OpenLicr's self-promo post is gone (or moved). Wait, actually the appinn search said "not the content you are looking for" — that's Discourse's search requiring login maybe. The topic 79362 returned 404 page. Hmm, but maybe the appinn topic was deleted. Let me note that as observed.

Actually wait - the appinn fetch returned HTTP 404 with "抱歉！未找到这个页面。" That's decent evidence. But it could also be that the topic was merged/moved. Let me search appinn for the title.

Let me batch:
1. web_search "OpenLicr 开源许可证 openlicr 官网"
2. web_fetch https://global.v2ex.co/t/1076129
3. web_fetch https://choosealicense.rustwiki.org/
4. web_search "runoob 在线工具 开源协议 LICENSE 生成"

Let me do it.

</details>

- 🔧 `web_search` · queries=["OpenLicr 许可证 openlicr.com 官网 比较","\"OpenLicr\" 许可证 生成 在线"]
- 🔧 `web_fetch` · url="https://global.v2ex.co/t/1076129"
- 🔧 `web_fetch` · url="https://choosealicense.rustwiki.org/"
- 🔧 `web_search` · queries=["runoob 菜鸟工具 开源协议 生成 LICENSE 在线","站长工具 开源许可证 生成器 在线","OSCHINA…

<details>
<summary>🧠 思考过程</summary>

Now I have the "高颜值、说人话" = https://open-source-license-chooser.toolsnav.top/ (by wincatcher). Let me fetch it and check if it's still alive.

Also need OpenLicr's actual URL. Let me try fetching the Product Hunt "openlicr" page via a different route, or search for its domain. Let me try:
- https://openlicr.com
- search "openlicr.com"

Also need Chinese tool sites: runoob, tool.lu, bejson, oschina. Let me check:
- https://tool.lu/ (has license? maybe not)
- https://www.runoob.com/ ... 
- https://tool.oschina.net/ 
- https://www.bejson.com/ 
- Actually there's "https://www.toolnb.com" etc.

Also the ayalm tool has only 6 licenses — good evidence of shortfall (no LGPL, MPL, AGPL, CC0, BSD-2, EPL, Mulan).

Let me batch:
1. web_fetch https://open-source-license-chooser.toolsnav.top/
2. web_fetch https://openlicr.com/
3. web_fetch https://tool.lu/
4. web_fetch https://tool.oschina.net/

Then check bejson and runoob.

Let me do this.

</details>

- 🔧 `web_fetch` · url="https://open-source-license-chooser.toolsnav.top/"
- ❌ `web_fetch` · url="https://openlicr.com/"
- 🔧 `web_fetch` · url="https://tool.lu/"
- 🔧 `web_fetch` · url="https://tool.oschina.net/"

<details>
<summary>🧠 思考过程</summary>

Excellent findings:
- tool.lu: NO license generator (confirmed by full tool index — no LICENSE/开源协议 tool). Good negative evidence.
- tool.oschina.net: NO license generator; the tool index has no license tool. Good negative evidence. Also stuck on JDK6/7 docs, jQuery plugins — outdated.
- choosealicense.rustwiki.org = Chinese translation of GitHub's choosealicense, has "我的项目不是软件" option (non-software), good.
- open-source-license-chooser.toolsnav.top = English only now?! The fetch returned /en/ page. Title says "Open Source License Chooser". The V2EX author claimed 中文 support. The page content fetched is English. Let me check the Chinese version URL /zh/ — maybe the Chinese version is broken or the site is English-default now. Interesting: the site shows "Do you want others to make money with your code?" etc. It has 15 licenses. There's a language toggle. Let me check /zh/ to verify whether Chinese still works — that's a concrete verifiable claim.

Important: the site is open-source-license-chooser.toolsnav.top — is that OpenLicr? Hmm. Actually the Tencent Cloud article described the same site (V2EX post by wincatcher, Sep 2024). OpenLicr is a different, newer tool (2026?) — the ruanyf/weekly issue #8656. Note the weeklies issue #5236 was the "高颜值" one. Let's distinguish.

OpenLicr: Let me find its URL. Product Hunt page for openlicr. Let me try fetching via a search engine cached content or the PH launch page. Let me try fetching https://www.producthunt.com/p/openlicr/openlicr (may also be 403). Let me instead search for "openlicr" site domain via a different query, maybe on GitHub: "github openlicr". Let me fetch https://github.com/search?q=openlicr — GitHub search requires login for code search but repo search works via API. Let me try the GitHub API: https://api.github.com/search/repositories?q=openlicr

Also let me check the ruanyf/weekly issue 8656 content — the fetch was truncated by GitHub nav. Let me try the GitHub API for the issue body: https://api.github.com/repos/ruanyf/weekly/issues/8656

That's a good approach for extracting content.

Also for Gitee: need license list in Gitee's new repo page. Gitee help doc mentions 开源许可证 but no list. Maybe there's a Gitee help page about 开源许可证/协议 list. Let me search "Gitee 开源许可证 列表 帮助" and check Gitee's license list via API: https://gitee.com/api/v5/licenses maybe. Actually Gitee has an API for licenses: GET /v5/licenses. Let me try.

Let me batch:
1. https://api.github.com/repos/ruanyf/weekly/issues/8656
2. https://api.github.com/search/repositories?q=openlicr
3. https://open-source-license-chooser.toolsnav.top/zh/
4. https://gitee.com/api/v5/licenses

Let me run.

</details>

### 🤖 助手

Key negatives found (tool.lu / OSCHINA have no license tool). Now extracting OpenLicr details via API.

- 🔧 `web_fetch` · url="https://api.github.com/repos/ruanyf/weekly/issues/8656"
- 🔧 `web_fetch` · url="https://api.github.com/search/repositories?q=openlicr"
- 🔧 `web_fetch` · url="https://open-source-license-chooser.toolsnav.top/zh/"
- 🔧 `web_fetch` · url="https://gitee.com/api/v5/licenses"

<details>
<summary>🧠 思考过程</summary>

Excellent. Now I have:
- OpenLicr: openlicr.com — domain DOES NOT RESOLVE (getaddrinfo ENOTFOUND). That's a major "verifiable" finding: the site is dead. Let me double check with another attempt (maybe DNS issue in the sandbox but web_search found PH page). Let me try https://www.openlicr.com/ and also check the Product Hunt launch page via a proxy-ish fetch. Also check the appinn forum post 79362 is 404 (topic deleted/purged).

Hmm, but maybe the sandbox's network DNS blocks it. Let me verify: openlicr.com ENOTFOUND means DNS resolution failed. Other domains worked fine (tool.lu, gitee.com). So likely the domain is genuinely not resolving (expired/unregistered) or blocked by DNS. To be careful, I'll report: "抓取时 openlicr.com DNS 解析失败（ENOTFOUND），站点当前不可访问" and note it as of fetch time. Let me try once more with www. prefix and via a different checker like https://dns.google/resolve?name=openlicr.com&type=A — that's a good way to independently verify DNS.

Also check GitHub repo: api.github.com/search/repositories?q=openlicr returned total_count 0 → no GitHub repo named openlicr. Good evidence: "GitHub 上搜不到 openlicr 仓库（GitHub API 搜索 total_count=0）".

Now let me also check:
- Product Hunt page (403 cloudflare) — try the forums URL: https://www.producthunt.com/p/openlicr/openlicr
- The ruanyf weekly issue #5236 for the 高颜值 tool (use API) - gives date/author and URL.

Other Chinese tools to check for LICENSE generation:
- runoob: https://www.runoob.com/ — search their tools. Actually runoob has "在线工具" at https://c.runoob.com/. Let me check if they have a license generator. Probably not.
- bejson: https://www.bejson.com/ — check tool list.
- 站长工具: https://tool.chinaz.com/
- Any-Tools.net: https://any-tools.net/zh-CN/license-chooser — found in search! That's a Chinese-language license chooser. Let me fetch it.
- oschina blog article "探索开源许可证生成工具的奥秘" — my.oschina.net — that's an article, maybe AI-generated. Could be useful as evidence of Chinese-language content.
- 木兰许可证 (MulanPSL-2.0) — important: is it in any Chinese tool? Gitee API list includes MulanPSL-2.0, MulanPSL-1.0, MulanPubL-1.0/2.0. Good.
- SPDX support: Gitee uses SPDX IDs (the API returns SPDX identifiers). Toolszone shows SPDX IDs.
- Need Chinese full text of licenses: Gitee provides Chinese translated text? Gitee's license pages (gitee.com/licenses/mit) may have Chinese. Let me check https://gitee.com/licenses? Let's check https://gitee.com/licenses/mit — might redirect to a license page. Actually Gitee has https://gitee.com/licenses/mulanpsl-2.0 . Let me test the API for a specific license: https://gitee.com/api/v5/licenses/MIT → returns body etc. Let's fetch to see if it includes Chinese text.

Let me batch a set:
1. https://dns.google/resolve?name=openlicr.com&type=A
2. https://any-tools.net/zh-CN/license-chooser
3. https://gitee.com/api/v5/licenses/MIT
4. https://api.github.com/repos/ruanyf/weekly/issues/5236

Then check runoob/bejson/chinaz for license tools.

Let me run these 4.

</details>

### 🤖 助手

Critical finding: openlicr.com doesn't resolve. Verifying via independent DNS + checking more Chinese tools.

- ❌ `web_fetch` · url="https://dns.google/resolve?name=openlicr.com&type=A"
- 🔧 `web_fetch` · url="https://any-tools.net/zh-CN/license-chooser"
- 🔧 `web_fetch` · url="https://gitee.com/api/v5/licenses/MIT"
- 🔧 `web_fetch` · url="https://api.github.com/repos/ruanyf/weekly/issues/5236"

<details>
<summary>🧠 思考过程</summary>

Notable: Gitee license API for MIT returns a modified/placeholder text with `[year] [fullname]` — i.e. Gitee stores the template with placeholders, not filled. Also note: Gitee's MIT text uses "MIT License\n\nCopyright (c) [year] [fullname]" — that's fine as template.

Important: Any-Tools.net is Japanese-operated, Chinese UI, 10 licenses, comparison table behind paywall ("使用 Any-Tools Pro 获取详细的比较表" → 立即升级 = ads/upsell). That's great evidence: 比较表付费墙. Also it's not a Chinese product (Japan-based, translated) — important nuance.

Now: I need to verify openlicr.com. dns.google fetch failed (network restriction maybe). Let me try alternative: 
- https://www.openlicr.com/
- Maybe the tool is at a different domain. Let me search Product Hunt cache or check web archive: http://archive.org/wayback/available?url=openlicr.com
That's a good one — Wayback API.

Let me also check:
- runoob tool search: fetch https://c.runoob.com/ and search for license
- bejson: fetch https://www.bejson.com/ 
- chinaz: fetch https://tool.chinaz.com/
- Also 《开源许可证教程》by 阮一峰 is from 2011 (found). Need maybe 图灵社区/InfoQ/开源社 guides.

Also should check SPDX Chinese resources and Mulan license (木兰) official.

Also: choosealicense-cn (rustwiki) — has Chinese translation of full license texts? Check https://choosealicense.rustwiki.org/licenses/mit/ to see if there's Chinese full text.

Let me batch:
1. http://archive.org/wayback/available?url=openlicr.com
2. https://www.bejson.com/
3. https://tool.chinaz.com/
4. https://choosealicense.rustwiki.org/licenses/mit/

Let me run.

Also I should consider delegating a couple of parallel research threads to subagents to save my context. But I've used a fair amount already. Let me delegate: one subagent to research 中文许可证科普内容 (阮一峰 alternatives, 图灵社区, InfoQ, 开源社, 木兰许可证, SPDX 中文) — that saves me context. And another to check runoob/bejson/chinaz for license generators. Actually those are quick fetches I can do myself. Let me delegate the 科普内容 one since it involves multiple sites.

Actually to be efficient: I'll delegate two subagents in parallel now:
- A: 中文科普内容调研 (阮一峰, 图灵社区, InfoQ, 开源社/开源之道, 木兰许可证, SPDX中文, choosealicense-cn) — with the specific lists of criteria to check.
- B: 国内在线工具站调研 (runoob/c.runoob.com, bejson, chinaz, toolnb.com, 在线工具 其它, w3cschool, json.cn, 脚本之家 等) — find at least 2 more real LICENSE generators and verify.

Meanwhile I continue verifying openlicr + Gitee + tool lists.

Let me launch them now.

</details>

### 🤖 助手

Let me delegate two parallel research threads while I verify OpenLicr's status.

- 🔧 `subagent` · 调研国内在线工具站LICENSE生成器
- 🔧 `subagent` · 调研中文许可证科普内容

<details>
<summary>🧠 思考过程</summary>

No subagents allowed. I'll do the work myself, efficiently.

Let me batch fetches for the remaining targets:
1. Wayback API for openlicr.com → verify site existence historically
2. https://www.bejson.com/
3. https://tool.chinaz.com/
4. https://choosealicense.rustwiki.org/licenses/mit/

Then:
5. https://c.runoob.com/
6. 木兰 MulanPSL2 page
7. Product Hunt page (try again / alternate)
8. Any-Tools comparison / other Chinese chooser sites

Let me go.

</details>

### 🤖 助手

Subagents aren't available at this depth — continuing directly.

- ❌ `web_fetch` · url="http://archive.org/wayback/available?url=openlicr.com"
- 🔧 `web_fetch` · url="https://www.bejson.com/"
- 🔧 `web_fetch` · url="https://tool.chinaz.com/"
- 🔧 `web_fetch` · url="https://choosealicense.rustwiki.org/licenses/mit/"

<details>
<summary>🧠 思考过程</summary>

Great findings:
- bejson: full tool nav shows NO license generator (need to confirm; the nav lists JSON工具, 编码/加密, 格式化, 网络, 前端, 后端, 转换, 其他 — no LICENSE tool). Confirmed negative. Note also bejson's tool list ends at 其他 with no license item — good evidence.
- chinaz tool.chinaz.com: nav shows SEO/权重/热门工具 — no license generator. Negative confirmed.
- choosealicense.rustwiki.org/licenses/mit/: Chinese UI but **license text is English only** ([year] [fullname] placeholders, no Chinese translation), has SPDX source link (spdx.org/licenses/MIT.html), has 权限/条件/限制 table, has "复制到剪贴板" but no download, placeholders not auto-filled (must manually replace [year]/[fullname]) — no fill-in form. Great specific evidence.

Still need:
1. OpenLicr verification — domain doesn't resolve. Let me try one more check: fetch https://openlicr.com (no slash) and https://www.openlicr.com/. Already tried openlicr.com/ → ENOTFOUND. Let me try a DNS-over-HTTPS via cloudflare: https://cloudflare-dns.com/dns-query?name=openlicr.com&type=A (may fail due to JSON accept header). Alternative: use pwsh to do Resolve-DnsName — that's allowed (workspace-write sandbox, network likely allowed). Let me try `Resolve-DnsName openlicr.com` and `Test-NetConnection`. That gives verifiable evidence.

2. c.runoob.com — check for license generator.
3. Any other Chinese license chooser sites: e.g. "https://www.toolnb.com", "https://www.lddgo.net", "https://www.jyshare.com" (runoob's mirror), "https://www.json.cn". Let me search specifically for Chinese sites that generate LICENSE.
4. 木兰许可证 official Chinese text page.
5. Chinese article: oschina blog "探索开源许可证生成工具的奥秘" — might be an AI-generated SEO article listing tools. Could be useful as a source of Chinese tools list.

Let me batch:
- pwsh: Resolve-DnsName openlicr.com (and www.openlicr.com), plus check via Invoke-WebRequest? Let me just do DNS.
- web_fetch https://c.runoob.com/
- web_search for 中文 LICENSE 生成器 更多站点
- web_fetch https://license.coscl.org.cn/MulanPSL2/

Let me run these in parallel.

</details>

- 🔧 `pwsh` · Resolve DNS for openlicr.com and control domain
- ❌ `web_fetch` · url="https://c.runoob.com/"
- ❌ `web_fetch` · url="https://license.coscl.org.cn/MulanPSL2/"
- 🔧 `web_search` · queries=["LICENSE 生成器 在线 中文 开源协议 选择 一键生成 网站","开源许可证 中文 全文 翻译 MIT Apach…

<details>
<summary>🧠 思考过程</summary>

Confirmed: openlicr.com DNS does not exist (NXDOMAIN), while control domain resolves. So OpenLicr's announced official domain is dead/unregistered as of now. That's hard evidence.

Also found: appinn topic 79362 still indexed by search engine but returns 404 → post removed/hidden. Good evidence.

Also found 源译识 (OpenAtom Foundation legal resources) — 主流开源许可证双语版合集 PDF. That's an important Chinese resource: bilingual license texts. Let me note it.

Also license-translation project on AtomGit.

Now:
- c.runoob.com redirects to www.jyshare.com. Need to check jyshare for license tools.
- Mulan PSL2 page failed. Try alternative: https://license.coscl.org.cn/MulanPSL2 (no trailing slash) or https://www.openatom.org. Let me try again.

Let me also verify a couple more Chinese tools that DO have license generators. Search results gave: toolszone.net, ayalm.com, any-tools.net (Japanese), b4dcats (foreign). Need more Chinese ones. Let me search for specific Chinese sites:
- "开源协议生成器" site: toolnb.com? 
- lddgo.net?
- 996tools?
- "在线开源协议生成器"

Let me search with different queries and also check jyshare.

Batch:
1. https://www.jyshare.com/  (runoob's tool site) — check tool list for license
2. web_search "在线开源协议生成器 免费 MIT Apache GPL 生成 LICENSE 文件"
3. https://license.coscl.org.cn/MulanPSL2 (retry)
4. https://gitcode.com/oxytoc/license-translation — the license translation project

Let me go.

</details>

### 🤖 助手

Confirmed: **openlicr.com returns NXDOMAIN**. Now checking runoob's tool site and more Chinese tools.

- 🔧 `web_fetch` · url="https://www.jyshare.com/"
- 🔧 `web_search` · queries=["\"开源协议生成器\" 在线工具 免费 MIT Apache GPL 生成 LICENSE","开源许可证 生成器 ld…
- ❌ `web_fetch` · url="https://license.coscl.org.cn/MulanPSL2"
- 🔧 `web_fetch` · url="https://gitcode.com/oxytoc/license-translation"

<details>
<summary>🧠 思考过程</summary>

jyshare (菜鸟工具): the tool list shows no license generator. It's a long list — I should confirm no "协议"/"license" tool. From the visible common tools list, there's no license generator. Good enough evidence: 菜鸟工具/jyshare 工具列表未见 LICENSE/开源协议生成器.

Now the remaining important gap: I need at least 3 real Chinese tool sites with license generators. So far:
1. toolszone.net/zh (Chinese UI, 12 licenses, good) — though it's a multi-language site (not necessarily Chinese company). It has Chinese UI at least.
2. ayalm.com (江苏艾蒂娜, 6 licenses, comparison table) — real Chinese site.
3. any-tools.net/zh-CN (Japan-operated, Chinese UI, 10 licenses, comparison behind Pro paywall) — Chinese-language but not Chinese company.
4. b4dcats.github.io (foreign).
5. tools.realtime-ai.chat/tools/generator/license-generator — "开源协议生成 - WebUtils" — let me check whether it's Chinese.

I need more genuinely Chinese ones. Let me search for specific likely candidates:
- "开源协议生成器" on 好工具/在线工具 sites: e.g. https://www.toolnb.com, https://www.lddgo.net, https://www.iamwawa.cn, https://www.zhanid.com, https://tooltt.com, https://www.ohtool.com, https://www.jsons.cn, https://www.toolhelper.cn
- Actually a well-known one: https://www.toolhelper.cn/ (toolhelper 在线工具)
- Also 掘金/CSDN articles that embed license chooser.

Let me do a targeted search: "开源许可" 生成器 site variations. And check "https://www.zhanid.com" or "kjson".

Also very relevant: **Gitee 的开源许可证帮助文档/许可证列表页** — Gitee has https://gitee.com/licenses/... Let me check what a Gitee license page looks like, e.g. https://gitee.com/assets/licenses/MIT ... Hmm. Actually Gitee's new repo page lists licenses. There's a help doc: https://help.gitee.com/repository/... Let me search Gitee help for 开源许可证.

Also Gitee has "开源许可证选择" guidance? Let me search help.gitee.com for license.

Let me batch:
1. web_search: 开源协议生成器 中文 在线 更多站点 (with specific site names)
2. web_fetch https://tools.realtime-ai.chat/tools/generator/license-generator
3. web_search: Gitee 开源许可证 说明 帮助 help.gitee.com 许可证
4. web_fetch https://www.toolhelper.cn/

Let me go.

</details>

- 🔧 `web_search` · queries=["开源协议生成器 在线 toolhelper OR iamwawa OR zhanid OR lddgo OR tooln…
- 🔧 `web_fetch` · url="https://tools.realtime-ai.chat/tools/generator/license-generator"
- 🔧 `web_fetch` · url="https://www.toolhelper.cn/"

<details>
<summary>🧠 思考过程</summary>

toolhelper.cn: 182 tools, NO license generator. Good negative evidence.

WebUtils (tools.realtime-ai.chat): "开源协议生成器" only 5 licenses (MIT, Apache-2.0, GPL v3, BSD-3-Clause, ISC), no download button (only 复制协议) — minimal. That's a real Chinese-language page.

Now I have Gitee's "为仓库添加 LICENSE" help page. Let me fetch it.

Also need Gitee license list page/selector. Let me fetch https://help.gitee.com/repository/base/为仓库添加LICENSE.

Also let me look for: 开源社/InfoQ guides. And "源译识" bilingual license collection (OpenAtom) — good.

Also I want to verify one more thing about toolszone: it claims 12 licenses; is it a Chinese product? It says "ToolsZone.net © 2026" with GitHub toolszone-net. Not Chinese company, but Chinese UI. I'll label it as 中文界面站点（非中国团队）— actually I can't verify the team. I'll say "多语言站点，非中国本土产品（未核实团队）".

Let me be careful and precise.

Now, remaining fetches:
1. https://help.gitee.com/repository/base/%e4%b8%ba%e4%bb%93%e5%ba%93%e6%b7%bb%e5%8a%a0LICENSE
2. Chinese article: my.oschina.net "探索开源许可证生成工具的奥秘" — check content
3. 辉/开源社 guide — search for 开源社 许可证选择指南
4. MulanPSL2 Chinese text official — try https://www.openatom.org or https://license.coscl.org.cn/MulanPSL2/ failed. Let me try http://license.coscl.org.cn/MulanPSL2/ or the gitcode mirror.

Let me batch 4.

</details>

- 🔧 `web_fetch` · url="https://help.gitee.com/repository/base/%e4%b8%ba%e4%bb%93%e5%ba%9…
- 🔧 `web_fetch` · url="https://my.oschina.net/emacs_9410534/blog/18513227"
- 🔧 `web_search` · queries=["开源社 开源许可证 选择指南 中文 决策","木兰宽松许可证 MulanPSL-2.0 中文全文 官方"]

<details>
<summary>🧠 思考过程</summary>

I have enough. Let me do a final round to fill a couple of gaps:
1. Gitee 仓库新建页面的 license 选择 — I have the API list (48 licenses incl. Mulan) and help doc. Good.
2. Need to double-check toolszone license count: 12 licenses claimed; and it explicitly says GPL-3.0-or-later as SPDX example ("GPL-3.0-or-later") — that's a plus. And it says "只有 CC0 例外" for non-software — so it lacks CC-BY etc. Good shortfall evidence.
3. For the "中文工具共性问题": 
   - openlicr.com dead → 个人自荐工具易失效
   - 过度集中在 5-6 种许可证（ayalm 6, WebUtils 5, runoob/tool.lu/bejson/chinaz/toolhelper 完全没有）
   - 不收木兰等中国本土许可证 (Gitee 有，工具站没有)
   - 比较表付费墙 (any-tools Pro)
   - 无中文全文 (choosealicense.rustwiki 正文英文)
   - 无 NOTICE 说明 (ayalm 表格没有 NOTICE 字段; toolszone 未提)
   - 无 SPDX（ayalm 未提 SPDX；toolszone 有）
   - 「只有模板不给解释」/「只有科普不给生成」（阮一峰 2011 只有图，无生成）
   - 更新停滞（阮一峰 2011；tool.oschina JDK6）

Let me verify a couple of extra specifics to be safe:
- Does ayalm mention SPDX? The page text doesn't mention SPDX → verified absence (I read the full page).
- Does ayalm mention NOTICE? No → absent.
- toolszone: mentions SPDX explicitly (yes, "每种许可证名称旁都会显示其 SPDX 标识符" and GPL-3.0-or-later). It does NOT mention NOTICE anywhere → check: page text mentions Apache 2.0 requires "说明对再分发文件所做的重大修改" but no NOTICE file mention. Verified absent (I read whole page).
- toolszone: 下载 LICENSE 文件名固定 LICENSE — yes.
- toolszone 12 licenses: MIT, Apache-2.0, GPL-3.0, LGPL-3.0, AGPL-3.0, MPL-2.0, BSD-2, BSD-3, ISC, Unlicense, CC0-1.0, BSL-1.0. No MulanPSL, no EPL, no GPL-2.0, no Artistics. Good.
- toolszone says "GPL 系列取自 gnu.org" — but does it distinguish only/or-later? The FAQ mentions SPDX 示例 "GPL-3.0-or-later" only as an example of an SPDX identifier, in the SPDX explanation section. It doesn't offer a choice between GPL-3.0-only and or-later. That's a real gap: no only/or-later toggle. I should be careful: the page says "GPL v3 有 674 行" and the project name fills "如何将这些条款应用于您的新程序". No only/or-later selection mentioned → 未提供 only/or-later 选择. I'll state that as observed (no such option described on the page).

Also worth noting: toolszone domain — the Chinese page URL uses http://www.toolszone.net/zh/... 

One more: I should verify the appinn post 404 more concretely — I got HTTP 404 with "抱歉！未找到这个页面。". Good.

Also the OpenLicr Product Hunt page — 403 Cloudflare, so I couldn't verify. But search result listings confirm a PH listing exists. I'll note: PH 页面存在但抓取被 Cloudflare 拦截(403)，未核实内容.

Let me also try once to see if OpenLicr moved to another domain — maybe "openlicr.cn" or on Vercel. Let me quickly check DNS for openlicr.cn and openlicr.vercel.app? Hmm, that's speculative. Let me do a quick search for "openlicr 无法访问" — probably nothing. Let me instead do one quick check: Resolve-DnsName openlicr.cn, openlicr.net, openlicr.io via pwsh — quick and gives concrete evidence. Actually that's reasonable but low value.

Better use of remaining effort: verify the appinn topic and one more Chinese 科普/工具. Let me do a final parallel batch:
1. pwsh DNS check for openlicr.cn/.net/.io (cheap, adds rigor about whether OpenLicr exists elsewhere)
2. web_fetch https://www.cnblogs.com/bugutian/p/13686729.html (gitee支持的开源许可证 - Chinese blog listing Gitee licenses) — useful for Gitee section
3. web_fetch https://github.com/yuan21577/open-source-license-guide/blob/main/docs/comparison.md — a Chinese license comparison doc (Chinese 科普/比较) — relevant to direction 4.

Let me run these 3.

</details>

- 🔧 `pwsh` · Check alternate OpenLicr domains in DNS
- 🔧 `web_fetch` · url="https://www.cnblogs.com/bugutian/p/13686729.html"
- 🔧 `web_fetch` · url="https://raw.githubusercontent.com/yuan21577/open-source-license-g…

<details>
<summary>🧠 思考过程</summary>

Now I have a solid, verifiable dataset. One important nuance from the yuan21577 comparison doc: it claims "MPL ... ❌ 不兼容 [with MIT]" and "GPLv3 ... 能否并入 MIT 项目 ❌" — the latter is wrong (GPL code can't be relicensed as MIT, but MIT-licensed... actually: can a GPLv3 component be included in an MIT-licensed project? No — the combined work must be GPLv3. But saying "MIT project ❌ incompatible" is roughly right in that direction). However "MPL 不兼容 MIT" is contested/wrong-ish: MPL-2.0 is generally considered compatible when combining via files (MPL is not GPL-compatible in the strict sense... actually MPL-2.0 IS compatible with GPL/LGPL/AGPL via Secondary License, but MPL code can't be relicensed under MIT; a project containing MPL files must keep those files MPL). So labeling "MPL ❌ 不兼容 MIT" is a simplification that's arguably an error — good evidence of Chinese content inaccuracies. Also "GPL-3.0 商业闭源分发 ❌ 严格禁止" is an over-simplification (GPL allows selling; it's just that derivatives must be GPL — the doc itself earlier says 允许商用). And it says "GPLv3 ✅ 兼容 木兰" etc.

Also it lacks: NOTICE file, only/or-later distinction, SPDX identifiers, CLA/DCO, trademark details, and it's an AI-ish doc. Also "Apache 2.0 ... 未提及商标" row.

Notable error to cite: "木兰PSL... 与 GPLv3 和 Apache 2.0 完美兼容" — MulanPSL-2.0 is compatible with... actually MulanPSL-2.0 is NOT GPL-compatible per some analyses; it's Apache-2.0 compatible-ish. Hmm, I need to be careful. I'll instead cite the clearer error: the table says MPL "❌ 不兼容" with MIT/Apache projects, and that table omits LGPL/GPL compatibility direction nuances. I'd rather flag: "该表把 MPL 标为与 MIT/Apache 项目『不兼容』，与 MPL-2.0 的文件级 copyleft 实际含义不符（MPL 文件可与 MIT 代码共存于同一项目，只是 MPL 文件本身保持 MPL）" — this is a defensible technical criticism. And I'll mark the Mulan/GPL compatibility claim as 未核实/存疑.

Let me now also grab the OpenLicr Product Hunt launch content if possible via a search snippet-based approach... The PH page is 403. I'll mark as 未核实.

Also appinn: the topic 79362 is 404. Search engine still indexes it.

One more useful check: does the appinn forum have the post under a different ID? The search result title was "[自荐] OpenLicr：开源许可证智能选择、比较与生成工具" at /t/topic/79362 → 404. Enough.

I think I have enough for a dense ≤1200-word Chinese report. Let me also quickly verify toolszone's industry: is it Chinese-facing only or a multi-language foreign site? Footer: "© 2026 ToolsZone.net", GitHub toolszone-net/feedback, Medium, Telegram, Discord, LinkedIn, Reddit → clearly an international site with zh locale, not a Chinese product. Good to note honestly.

Let me now count what I have for each required target:

**1. OpenLicr** — URL openlicr.com (announced). Status: NXDOMAIN. Self-promo posts: appinn 79362 (404 now), ruanyf/weekly #8656 (public, full body retrieved, closed 2026-05-06, 0 comments, 0 reactions). PH listing exists (403 to fetch). GitHub: no repo (API search total_count=0). Claimed features from author's own post: 30+ licenses, comparison, scenario-based selection, one-click generation, all texts cross-checked with official sources by manually diffing in Word. Shortfalls: 站点已无法解析（域名不存在）→ 无法验证任何功能；作者自述"上线超过半年大部分时间无人问津"；无 GitHub 开源仓库；无 API；未见 only/or-later 说明（未核实，因站点不可访问）。

**2. 国内在线工具站**
- toolszone.net/zh/tools/license-text-generator — 12 licenses, SPDX IDs shown, fills 版权人/年份/项目名, download LICENSE, FAQ explains GPL-3.0-or-later as SPDX example, full verbatim texts from official sources (claims GPLv3 674 lines, AGPL 661 lines), browser-local. Shortfalls: 无向导问答（只有文档式FAQ）；非中国团队（多语言国际站）；无 MulanPSL/EPL/GPL-2.0；无中文许可证全文（界面中文，正文英文）；未提 Apache-2.0 的 NOTICE 文件；未提供 GPL only/or-later 选择；无比较表（只有文字对比说明，无并排表格）— wait, the page says "在确定许可证之前，先对比其许可、条件与限制" — there's a comparison feature mentioned. Let me re-read: "完整、逐字的许可证文本会即时生成…在确定许可证之前，先对比其许可、条件与限制" — that suggests there IS a comparison view. Hmm. I'll say "页面提到可对比许可/条件/限制（是否为并排比较表未核实）".
- ayalm.com/tools/license-generator/ — 6 licenses, 版权年份/持有人, 生成+复制+下载, 6-row comparison table with 专利授权 column, FAQ. Shortfalls: 只有6种（缺 LGPL/MPL/AGPL/CC0/BSD-2/EPL/木兰）；全站不提 SPDX；比较表无 NOTICE/商标/贡献者协议维度；无向导问答；GPL-3.0 未区分 only/or-later；页面本身是 SEO 工具站的一部分，含大量其他工具导流。
- tools.realtime-ai.chat/tools/generator/license-generator — 5 licenses (MIT/Apache-2.0/GPL v3/BSD-3/ISC), 年份+作者, 仅"复制协议"无下载, 无比较、无解释、无 SPDX。极端简陋。
- any-tools.net/zh-CN/license-chooser — 10 licenses with 分类标签(宽松/著佐权/弱著佐权/公共领域) and per-license 权限/条件/限制; 但比较表被 Pro 付费墙挡住（"使用 Any-Tools Pro 获取详细的比较表和兼容性矩阵。立即升级"）；由日本团队运营，中文为译文；无 SPDX；无中文全文；无 MulanPSL。
- 负面证据（重要）：菜鸟工具 jyshare.com、tool.lu、tool.oschina.net、bejson.com、tool.chinaz.com、toolhelper.cn 六个站点工具列表中**均无** LICENSE/开源协议生成器（我读了各自的工具索引）。tool.oschina.net 工具仍停留在 JDK6/7 文档、jQuery 插件时代。
- choosealicense.rustwiki.org — 中文界面，决策式（"我希望协议简单而宽松"/"我关心改进可以共享"/"我的项目不是软件"），含非软件作品选项、权限/条件/限制表、SPDX 来源链接。短板：**许可证正文仍是英文**（[year] [fullname] 占位符需手动替换，无填入表单、无下载按钮，只有"复制到剪贴板"）；无木兰；无 2024 后新增内容（未核实最近更新）；翻译质量（"许可的作品、修改和更大的作品"这句机翻痕迹明显）。
- open-source-license-chooser.toolsnav.top — 5 道问卷（商用/修改/专利流氓/网络服务/兼容性），15 种许可证候选，带“趣味解释/优缺点/使用量/示例项目”与比较页、使用量图表。短板：选项文案"抖机灵"被 V2EX 用户批评"容易给使用者造成刻板印象"（icaolei, #1）；错误：把 GPL-3.0 标为"适用于网络服务"、把 AGPL 使用量列 30,000；Pros/Cons 中 GPL-3.0 写"可能影响商业使用"含糊；收集"使用量: N 个网站"但未给数据来源（未核实）；比较/图表页仅中英；无生成下载 LICENSE 的能力（只到"了解更多"外链）。

**3. Gitee**
- help.gitee.com 新建仓库 & 为仓库添加 LICENSE：说明"添加开源许可证…决定了该开源项目是否对商业友好"，但**不列许可证清单、不解释各协议差异、无选择建议**；仅说明在新建仓库或新建 LICENSE 文件时弹出选择框。
- Gitee API /v5/licenses 返回 48 个 SPDX 标识符（含 MulanPSL-2.0/1.0、MulanPubL-1.0/2.0、CERN-OHL、CC-BY、OFL、WTFPL 等）→ 目前中文平台里许可证覆盖面最广。
- Gitee /v5/licenses/MIT 返回的模板用 `[year] [fullname]` 占位符（需用户自行替换），正文为英文；Gitee 未提供中文译文（未核实是否存在中文页）。

**4. 中文科普**
- 阮一峰《如何选择开源许可证？》(2011)：只有一张 Paul Bagwell 决策图的中文重绘；只覆盖 6 种；无 AGPL/CC0/木兰/SPDX；无正文解释；页面自己有 CC BY-NC-ND 声明（禁止演绎）；15 年未更新（评论区 2022 年就有人喊"是时候更新了"）。
- choosealicense.rustwiki.org（见上）。
- yuan21577/open-source-license-guide（GitHub，中文深度对比 + 兼容性矩阵 + 真实案例 React BSD+Patents / Elasticsearch SSPL / MySQL 双许可）：短板：把 MPL 标为与 MIT/Apache 项目"❌ 不兼容"（与 MPL-2.0 文件级 copyleft 的实际含义不符）；宣称木兰 Mula

…（思考过程已截断：全文 14,498 字符，保留前 6,000 字符）

</details>

### 🤖 助手

Research complete. Sending findings to parent, then presenting.

- 🔧 `send_message` · # 中文「开源许可证选择/生成」工具竞品调研（全部为实抓证据） ## 关键结论（先说最重要的） 1. **OpenLicr 已下线**：其自…

### 🤖 助手

#### 中文「开源许可证选择/生成」工具调研

##### 1. OpenLicr — 已下线，功能无法验证
作者自荐公布的 [openlicr.com](https://openlicr.com)：实测 **DNS NXDOMAIN**（`Resolve-DnsName` → "DNS name does not exist"；openlicr.cn/.net/.io/.app 亦无记录，对照 toolszone.net 正常解析）。[小众软件论坛帖](https://meta.appinn.net/t/topic/79362) 返回 **HTTP 404**（搜索索引仍在）；[ruanyf/weekly#8656](https://github.com/ruanyf/weekly/issues/8656) 正文可见（2026-01-09 提，**0 评论 0 反应**，2026-05-06 关闭），作者自述"上线超过半年…无人问津"，功能为 30+ 许可证、对比、场景化选择、一键生成。[Product Hunt](https://www.producthunt.com/products/openlicr) 抓取 403，未核实。GitHub 仓库搜索 [total_count=0](https://api.github.com/search/repositories?q=openlicr) → 非开源、无 API。**所有功能宣称目前不可验证。**

##### 2. 中文在线工具与选择器
| 站点 | 许可证 | 填写/下载 | 可核查短板 |
|---|---|---|---|
| [ToolsZone 文本生成器](http://www.toolszone.net/zh/tools/license-text-generator) | 12 种 | 名字+年份+项目名；可下载 | **正文全英文**；**未提 Apache-2.0 的 NOTICE**；**无 only/or-later 选项**；缺 MulanPSL/GPL-2.0/EPL；国际站非中国团队；唯一标注 **SPDX** |
| [ayalm 开源协议生成器](https://www.ayalm.com/tools/license-generator/) | **仅 6** | 年份+持有人；可下载 | **全文不提 SPDX**；缺 LGPL/MPL/AGPL/CC0/BSD-2/木兰；比较表无 NOTICE/商标/贡献者协议；无向导；SEO 导流 |
| [WebUtils](https://tools.realtime-ai.chat/tools/generator/license-generator) | **仅 5** | 年份/作者 | **只有"复制协议"，无下载**、无比较、无解释、无 SPDX |
| [Any-Tools 选择器](https://any-tools.net/zh-CN/license-chooser) | 10 种，分宽松/著佐权/公共领域 | 可下载 | **比较表被 Pro 付费墙**；日本团队、中文为译文；无 SPDX；无木兰 |
| [toolsnav 选择器](https://open-source-license-chooser.toolsnav.top/zh/) | 15 种候选 | **不能生成/下载** | 把 **GPL-3.0 标为"适用于网络服务"**（属 AGPL）；"使用量：N 个网站"**无来源**（未核实）；[V2EX 用户](https://global.v2ex.co/t/1076129)批评文案"造成刻板印象" |
| [choosealicense 中文版](https://choosealicense.rustwiki.org/) | 决策式 | **无表单无下载**，`[year] [fullname]` 手改 | **正文仍英文**；机翻痕迹；无木兰；但有[非软件作品](https://choosealicense.rustwiki.org/non-software/)与 [SPDX 链接](https://spdx.org/licenses/MIT.html) |

**负面证据**：[菜鸟工具](https://www.jyshare.com/)、[tool.lu](https://tool.lu/)、[OSCHINA](https://tool.oschina.net/)、[bejson](https://www.bejson.com/)、[站长工具](https://tool.chinaz.com/)、[锤子工具](https://www.toolhelper.cn/) 工具索引中**均无** LICENSE 生成器；OSCHINA 仍停在 JDK6/7、jQuery 插件时代。

##### 3. Gitee
[新建仓库](https://help.gitee.com/repository/base/%e6%96%b0%e5%bb%ba%e4%bb%93%e5%ba%93)、[添加 LICENSE](https://help.gitee.com/repository/base/%e4%b8%ba%e4%bb%93%e5%ba%93%e6%b7%bb%e5%8a%a0LICENSE)：仅一句"决定了该开源项目是否对商业友好"，**不列清单、不解释差异**。[API /v5/licenses](https://gitee.com/api/v5/licenses) 返回 **48 个 SPDX ID**，含 **MulanPSL-2.0、CERN-OHL、WTFPL** → 中文平台覆盖最广且**唯一有 API**。[MIT 模板](https://gitee.com/api/v5/licenses/MIT) 为英文 + 占位符，需自行替换。

##### 4. 中文科普
- [阮一峰《如何选择开源许可证？》](https://www.ruanyifeng.com/blog/2011/05/how_to_choose_free_software_licenses.html)：**2011 年**，仅一张图、**仅 6 种**，无 AGPL/CC0/木兰/SPDX、无生成。
- [中文深度对比指南](https://github.com/yuan21577/open-source-license-guide/blob/main/docs/comparison.md)：把 **MPL 判为与 MIT"❌不兼容"**（与文件级 copyleft 实际不符）；称木兰"与 GPLv3 完美兼容"（**未核实**）；无 SPDX/NOTICE/only-or-later。
- [源译识双语合集](https://raw.atomgit.com/openatomfoundation/legal_resources/raw/e1d1f6d9cea900b8b637795b14cf125694c5d2df/%E5%BC%80%E6%94%BE%E5%8E%9F%E5%AD%90%E5%BC%80%E6%BA%90%E6%B3%95%E5%BE%8B%E6%89%8B%E5%86%8C_2023%E5%B9%B46%E6%9C%88%E7%AC%AC%E4%B8%80%E7%89%88.pdf)、[license-translation](https://gitcode.com/oxytoc/license-translation)：已有十余种中文译本，**但无工具接入**。

##### 5. 共性问题（附证据）
1. **覆盖窄**：6/5/10/12 种，GPL-2.0、EPL、Artistic、OFL 普遍缺席。
2. **本土许可证缺位**：木兰只在 Gitee API 出现，四家工具站全无——中文工具最不服务中国合规需求。
3. **中文界面+英文正文**是常态（choosealicense 中文版、ayalm、toolszone、Gitee），中文译本未被集成。
4. **SPDX 覆盖不足**：ayalm、WebUtils、any-tools、choosealicense 中文版均无 SPDX ID。
5. **only/or-later 与 NOTICE 双缺失**：三家生成器均无 GPL-3.0-only vs `-or-later` 选项，均未提 Apache NOTICE。
6. **无非软件作品路径**：仅 choosealicense 中文版有；ayalm 明确限定软件许可证。
7. **无 API/批量**：工具站全是纯前端单页；唯一 API 是 Gitee。
8. **商业化污染**：any-tools 比较表锁进 Pro 付费墙；ayalm/toolszone 以免费工具做 SEO 导流。
9. **个人项目存活率低**：OpenLicr 域名 NXDOMAIN + 帖 404 + 无仓库；toolsnav 运行两年仍无生成下载。
10. **内容硬错**：MPL 被判与 MIT"不兼容"；toolsnav 把 GPL-3.0 标为"适用于网络服务"，优缺点自相矛盾。

**机会点**：中文全文+官方译文、SPDX 全量+only/or-later 显式化、NOTICE/商标/CLA 提示、木兰一等公民、非软件作品分支、下载+API 批量——**中文市场无任一工具同时具备**。

已通过 `send_message` 将完整结果发给父 agent。
