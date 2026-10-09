# LicenseForge 静态站点发行版 · 部署说明

> ## ⚠️ 想在本机打开？双击 `启动网站.cmd`
>
> 不要直接双击 `index.html`。它是 Next.js 的静态导出产物，页面里的资源与数据
> 请求都写作**绝对路径**（`/_next/...`、`/data/...`），而数据是运行时用
> **`fetch()`** 拉取的。在 `file://` 协议下：
>
> - CSS 与 JS 加载失败 → 没有样式、没有交互
> - `fetch()` 被浏览器直接**拒绝**（origin 是 `null`，CORS 不允许跨源请求）
>   → 页面停在「正在加载 SPDX 许可证目录…」
>
> **这不是包损坏，是浏览器的安全策略，改路径绕不过去。**
>
> 包里的 `启动网站.cmd` 会起一个本地服务器并自动打开浏览器——**双击它即可**。
> 它会按 Node.js → Python 的顺序找运行时，两个都没有时会给出安装地址。
> 同目录的 `server.mjs` 是它调用的零依赖服务器，**不要删掉**。
>
> 用 `python -m http.server`、`npx serve .` 之类手动起也可以。

这个压缩包是 LicenseForge 的**构建产物**，已经可以直接部署，不需要 Node.js、
不需要后端服务、不需要构建步骤。解压后把里面的文件原样上传即可。

```
启动网站.cmd         Windows 双击启动（本机预览用）
server.mjs           启动网站.cmd 调用的零依赖服务器
index.html           入口
404.html             404 页
_next/               JS 与 CSS
data/                许可证数据（约 20MB，站点运行需要，请一并上传）
DEPLOY.md            本文件
```

---

## ⚠️ 必须部署在域名根路径

包内的资源引用与数据请求都是**绝对路径**（`/_next/...`、`/data/...`），
因此只能部署在**域名的根路径**下：

| 部署方式 | 是否可用 |
|---|---|
| `https://example.com/`（独立域名或子域名） | ✅ 可用 |
| `https://example.com/licenses/`（子路径） | ❌ 不可用，页面的 CSS/JS 与数据都会 404 |

**子路径部署怎么办**：不能直接用这个包，需要从源码重新构建并在 `next.config.ts` 里
设置 `basePath`：

```ts
// next.config.ts
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/licenses',   // 改成你的子路径，不要带结尾斜杠
  turbopack: { root: __dirname },
};
```

```bash
pnpm install
pnpm run build          # 产物仍在 out/
```

源码：https://github.com/youye-luna/license-forge

---

## 部署方式

### 静态托管平台

把包内文件全部上传到站点根目录。常见平台：

- **Cloudflare Pages / Netlify / Vercel**：构建命令留空或填 `true`，输出目录设为 `/`
- **对象存储（OSS / S3 / COS）+ CDN**：开启静态网站托管，把文件传到根目录
- **Nginx**：

  ```nginx
  server {
    listen 80;
    root /var/www/license-forge;   # 解压后的目录
    index index.html;
    location / {
      try_files $uri $uri/ /404.html;
    }
  }
  ```

### GitHub Pages

**只能用自定义域名或 `*.github.io` 根仓库**（例如仓库名就叫 `youye-luna.github.io`）。
普通的项目仓库（`youye-luna.github.io/license-forge/`）属于子路径部署，
请按上面「子路径部署」一节重新构建后再发布。

### 本地预览

**Windows：双击 `启动网站.cmd`。** 它会选运行时、起服务器、自动开浏览器，
端口 8080 被占用时自动往后找。

其它平台（或不想用 .cmd）：

```bash
node server.mjs 8080              # 零依赖，自动开浏览器
python -m http.server 8080        # 有 Python
npx serve .                       # 有 Node
```

命令行工具不必放进这个目录，在解压后的目录里执行即可。

然后打开 http://127.0.0.1:8080/ （或你指定的端口）。

> 再强调一次：**不要**用 `file://` 直接打开 `index.html`，那样只会看到没有样式的页面。

---

## 运行时行为

- **所有生成逻辑都在浏览器里执行**，填写的版权信息、项目名、第三方组件清单
  **不会被发送到任何服务器**，也没有任何埋点或外部请求。
- 许可证数据是构建期抓好的静态文件，随包分发。运行时不访问 SPDX、ScanCode 或任何
  外部 API，因此不受网络与限流影响，也能完全离线使用。
- 首次打开只加载约 1.2MB 的元数据；选定某个许可证后才按需加载对应的正文
  （SPDX 全文 5.3MB 或 ScanCode 独有部分 13MB，两者不会同时加载）。

---

## 数据来源与署名要求

包内 `data/` 下的数据来自以下上游，**转发或再分发时请保留署名**：

| 来源 | 许可 | 署名要求 |
|---|---|---|
| [SPDX License List](https://spdx.org/licenses/) | CC0 | 无强制要求 |
| [ScanCode LicenseDB](https://scancode-licensedb.aboutcode.org/)（[aboutcode.org](https://aboutcode.org/)） | **CC-BY-4.0** | **需署名** |
| [OSADL Obligations Checklist](https://www.osadl.org/Checklists) | **CC-BY-4.0** | **需署名** |
| [ChooseALicense](https://github.com/github/choosealicense.com) | **CC-BY-3.0** | **需署名** |
| [OSI 官方 API](https://opensource.org/api/licenses) | — | — |
| [开放原子《源译识》](https://gitcode.com/translation/license-translation) 译文 | CC0 | 无强制要求 |

`data/license-texts.json` 与 `data/scancode-texts.json` 里的许可证正文，
版权归各许可证的原始发布方所有，此处为逐字引用。

本站点自身的代码以 **MIT** 发布，见源码仓库。

---

## 免责声明

本工具**不提供法律意见**。兼容性提示是经验性判断，不是判定器；
长尾条目的条款字段由正文推断而非法律认定（界面已如实标注来源）。
涉及专利、商标、雇佣关系或跨境合规时，请咨询专业人士。
