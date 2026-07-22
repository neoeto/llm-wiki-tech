---
name: blog
version: 1.0.0
description: "Wrap Astro CLI lifecycle for the LLM wiki blog site — init, serve, build, deploy. Use when user says 'blog init', 'blog serve', 'blog build', 'blog deploy', '博客构建', '部署博客', '构建站点', '预览博客', '初始化博客', or any Astro SSG operation on the blog/ site."
---

# Blog（博客站点构建）

**严格遵循项目根目录 `agent-spec.md` 全部规则。**

包装 Astro 静态站点生成器的完整生命周期，将 `blog/src/` 下的博文 markdown（含完整 frontmatter）编译为可部署的静态 HTML。`blog` 是 CLI 包装 skill（镜像 `docs` 包装 git CLI），负责机械的构建/预览/部署命令；博文内容的 AI 编织由 `publish` skill 负责。

## 前置信息

- **框架/内容分离**：`blog/` 是框架仓库内置的 Astro 预配骨架；`blog/` 是内容仓库内的博客实例，被 `.gitignore` 忽略
- **blog/ 已纳入 git 管理**：定制后的 AstroPaper 模板直接在 `blog/` 目录中，由 git 跟踪。`blog init` 仅需安装依赖（源码已在仓库中），无需从 GitHub 克隆
- **博文来源**：博文（`blog/src/content/posts/*.md`）由 `publish` skill 生成，含 10 字段 frontmatter
- **构建产物**：`astro build` 输出到 `blog/dist/`（含 `dist/pagefind/` 搜索索引），`dist/` 与 `node_modules/` 应被 .gitignore
- **部署目标可配置**：不绑死特定平台，通过 `blog/` 内的配置文件指定部署目标

## 核心流程

```
用户发起 blog 操作
       │
       ▼
┌─────────────────────────────────────────────────┐
│ Step 0: 检查 blog/ 是否已通过 blog init 初始化 │
│ - 是否存在 astro.config.mjs？                     │
│ - node_modules/ 是否已安装？                       │
│ - 若未初始化 → 仅允许 init 操作                    │
│ - 若已初始化 → 所有操作可用                        │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│ Step 1: 识别用户意图，路由到对应命令               │
│ - init → 初始化博客项目                           │
│ - serve → 启动开发服务器                          │
│ - build → 构建静态站点                            │
│ - deploy → 推送到部署目标                         │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│ Step 2: 在 blog/ 目录内执行操作              │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│ Step 3: 输出结果摘要                             │
└─────────────────────────────────────────────────┘
```

## 状态检查

在任何操作前，先判断 `blog/` 的初始化状态：

```bash
# 检查是否已初始化
test -f blog/astro.config.mjs && echo "initialized" || echo "not initialized"

# 检查依赖是否已安装
test -d blog/node_modules && echo "deps installed" || echo "deps missing"
```

| 状态 | 允许的操作 | 拒绝的操作 |
|------|-----------|-----------|
| 未初始化（无 `astro.config.mjs`） | `init` | `serve`、`build`、`deploy` |
| 已初始化但无 `node_modules/` | `init`（依赖安装阶段） | `serve`、`build`、`deploy` |
| 已初始化且依赖就绪 | 全部 | — |

## 命令清单

### 1. init — 初始化博客项目

**触发词**：「初始化博客」「blog init」「创建博客」「新建博客站点」「setup blog」

**功能**：在 `blog/` 目录安装 Node 依赖。源码（AstroPaper 定制版）已在 git 仓库中跟踪，无需克隆。

**操作步骤**：

1. **检查目标目录**：
   ```bash
   ls blog/ 2>/dev/null
   ```
   - 若不存在 → 直接进入复制步骤
   - 若存在且非空 → 询问用户是否覆盖：
   ```
   ⚠️ blog/ 已存在且非空。
   当前内容：
     - astro.config.mjs
     - src/content/posts/xxx.md（N 篇博文）
     - manifest.md
   
   覆盖将丢失以上内容。是否覆盖？
   ① 覆盖（将删除现有 blog/ 全部内容）
   ② 取消操作
   ```
   - 用户选择覆盖后执行 `rm -rf blog/`，再进入复制

2. **安装依赖**：
   ```bash
   cd blog && npm install
   ```
   blog/ 目录已含完整 AstroPaper 定制版源码（由 git 跟踪），包括：
   - `content.config.ts`：含 `derivedFrom` + `lastSynced` 同步字段
   - `astro.config.ts`：含 Mermaid + 阅读时长 remark 插件
   - `Layout.astro`：含 Mermaid 懒加载客户端脚本
   - `remark-mermaid-pre.mjs` + `remark-reading-time.mjs`：自定义 remark 插件
   - 已清除 AstroPaper 示例文章、Mingalaba 模块、Featured 模块、About 导航、社交图标
   - 标题已改为 "Neo's Blog"
3. **原步骤**（已合并到步骤 2）：
   ```bash
   cp -r blog/ blog/
   ```

3. **安装依赖**：
   ```bash
   cd blog/ && npm install
   # 或如果用户偏好 pnpm
   cd blog/ && pnpm install
   ```
   优先检测用户环境中可用的包管理器（`which pnpm`、`which npm`）。若 `pnpm` 可用优先使用。

4. **验证 schema 对齐**：
   检查 `blog/src/content/config.ts` 中的 collection schema 字段是否与博文 frontmatter 规范一致：
   - 标准字段：`title`、`description`、`pubDatetime`、`tags`、`draft`、`modDatetime`、`author`
   - 同步骨架字段：`slug`、`derivedFrom`、`lastSynced`
   
   若 schema 与规范不一致，报告差异并提示可能需要更新框架仓库的 `blog/`。

5. **输出初始化摘要**：
   ```
   ✓ blog/ 已初始化
     模板来源：blog/
     已安装依赖：N 个包
     Astro 版本：x.y.z
   
   下一步：
     - 生成博文 → publish（AI 编织 wiki 词条为博文）
     - 本地预览 → blog serve
     - 构建站点 → blog build
     - 部署上线 → blog deploy（需先配置部署目标）
   ```

### 2. serve — 本地预览

**触发词**：「预览博客」「blog serve」「启动博客」「本地查看博客」

**功能**：启动 Astro 开发服务器（`astro dev`），提供本地实时预览。服务在前台运行，支持热重载（修改博文即刷新页面）。用户可按 `Ctrl+C` 终止。

**前置条件**：
- `blog/` 已初始化（存在 `astro.config.mjs`）
- `node_modules/` 已安装

**操作步骤**：

1. **检查初始化状态**（参照状态检查表）。若未初始化：
   ```
   ✗ blog/ 尚未初始化。
   
   请先执行 blog init 初始化博客项目。
   ```

2. **启动开发服务器**：
   ```bash
   cd blog/ && npx astro dev
   ```
   或若全局安装了 astro：`cd blog/ && astro dev`

3. **输出访问信息**：
   ```
   ✓ Astro 开发服务器已启动
     本地地址：http://localhost:4321
     热重载：已启用
   
   按 Ctrl+C 停止服务器。
   ```

> 反例自检：未检查初始化状态就直接执行 `astro dev` → 必然报错。

### 3. build — 构建静态站点

**触发词**：「构建博客」「blog build」「编译博客」「生成站点」

**功能**：执行 `astro build`，将 `blog/src/` 下所有 `draft: false` 的博文编译为静态 HTML，输出到 `blog/dist/`。构建完成后自动运行 Pagefind 生成搜索索引至 `dist/pagefind/`。

**前置条件**：
- `blog/` 已初始化
- `node_modules/` 已安装

**操作步骤**：

1. **检查初始化状态**（参照状态检查表）。若未初始化：
   ```
   ✗ blog/ 尚未初始化。
   
   请先执行 blog init 初始化博客项目。
   ```

2. **清空旧构建产物**：
   ```bash
   rm -rf blog/dist/
   ```
   避免上一次构建的残留文件（已被删除的博文、旧搜索索引等）污染新站点。

3. **执行构建**：
   ```bash
   cd blog/ && npx astro build
   ```
   Astro 构建流程：
   - 读取 content collection（`src/content/posts/*.md`）
   - 按 schema 校验 frontmatter
   - `draft: true` 博文自动排除（不出现在 HTML、RSS、sitemap 中）
   - `@astrojs/rss` 从 `getCollection('blog')` 过滤 `draft: false`，生成 `/rss.xml`
   - `@astrojs/sitemap` 生成 `/sitemap-index.xml`，含 `modDatetime`→`lastmod` 映射
   - 标签聚合页 `/tag/[tag]/` 从全部已发布博文 `tags` 生成
   - TOC、阅读时长、相关博文、上下篇导航由布局层构建时自动派生

4. **验证 Pagefind 索引生成**：
   确认 `blog/dist/pagefind/` 目录存在且包含 `pagefind.js` 与索引分片文件。若缺失，手动执行：
   ```bash
   cd blog/ && npx pagefind --site dist
   ```

5. **输出构建摘要**：

   ```
   ✓ 博客站点构建完成
     输出目录：blog/dist/
     已发布博文：N 篇（draft: true 已排除）
     搜索索引：dist/pagefind/（N 个分块）
     RSS：/rss.xml
     Sitemap：/sitemap-index.xml
     标签聚合页：N 个
   
   总页面数：N
   构建耗时：X.Xs
   
   下一步：
     - 本地预览构建产物 → npx astro preview（在 blog/ 内执行）
     - 部署上线 → blog deploy
   ```

> 反例自检：不清空 `dist/` 就构建 → 残留旧博文 HTML 与过期搜索索引，导致站点出现已删除内容或死链。

### 4. deploy — 部署到线上

**触发词**：「部署博客」「blog deploy」「发布站点」「上线博客」

**功能**：将 `blog/dist/` 的静态产物推送到用户配置的部署目标。

**前置条件**：
- `blog/dist/` 存在（已构建）
- 已配置部署目标

**操作步骤**：

1. **检查 dist/ 是否存在**：
   ```bash
   test -d blog/dist/ && echo "ready" || echo "not built"
   ```
   若不存在：
   ```
   ✗ blog/dist/ 不存在。
   
   请先执行 blog build 构建站点。
   ```

2. **检查部署目标是否已配置**：
   查找部署配置文件（根据平台不同）：
   ```bash
   # GitHub Pages
   test -f blog/.github/workflows/deploy.yml  # 或类似 CI 配置

   # Vercel
   test -f blog/vercel.json

   # Netlify
   test -f blog/netlify.toml
   ```
   
   若均未配置：
   ```
   ✗ 尚未配置部署目标。
   
   当前支持的部署方式：
   
   ① GitHub Pages
      - 创建 blog/.github/workflows/deploy.yml
      - 配置 GitHub Actions 在 push 时自动构建并部署到 gh-pages 分支
      - 适合：已有 GitHub 账号，免费托管
   
   ② Vercel
      - 在 blog/ 创建 vercel.json，配置 outputDirectory 为 "dist"
      - 运行 vercel --prod 或连接 Git 仓库自动部署
      - 适合：个人项目，免费额度充裕
   
   ③ Netlify
      - 在 blog/ 创建 netlify.toml，配置 publish 为 "dist"
      - 运行 netlify deploy --prod --dir=dist
      - 适合：团队协作，支持分支预览
   
   请选择部署平台，我会生成对应的配置文件。
   ```

3. **按平台执行部署**：

   **GitHub Pages 模式**：
   ```bash
   # 方案 A：gh-pages 分支（推荐）
   cd blog/ && npx gh-pages -d dist -m "deploy: $(date +%Y-%m-%d)"
   
   # 方案 B：GitHub Actions（CI 自动化）
   # 生成 .github/workflows/deploy.yml 后，git push 触发 CI
   ```

   **Vercel 模式**：
   ```bash
   cd blog/ && npx vercel --prod
   ```

   **Netlify 模式**：
   ```bash
   cd blog/ && npx netlify deploy --prod --dir=dist
   ```

4. **输出部署结果**：
   ```
   ✓ 博客站点已部署
     部署目标：GitHub Pages / Vercel / Netlify
     站点地址：https://xxx.example.com
     部署时间：YYYY-MM-DD HH:MM
   ```

## 部署目标配置说明

部署配置在 `blog/` 内，由用户按需创建。框架仓库 `blog/` 不预设部署配置（平台无关）。

### GitHub Pages（gh-pages 分支）

在 `blog/` 安装 `gh-pages` 并配置部署脚本：

```bash
cd blog/ && npm install --save-dev gh-pages
```

在 `blog/package.json` 添加：
```json
{
  "scripts": {
    "deploy": "gh-pages -d dist -m \"deploy: $(date +%Y-%m-%d)\""
  }
}
```

`blog deploy` 将执行此脚本。也可通过 GitHub Actions 实现 push 自动部署（生成 `.github/workflows/deploy.yml`）。

### Vercel

在 `blog/` 创建 `vercel.json`：
```json
{
  "buildCommand": "astro build",
  "outputDirectory": "dist",
  "framework": "astro"
}
```

首次部署运行 `npx vercel` 并绑定项目；后续 `blog deploy` 执行 `vercel --prod`。

### Netlify

在 `blog/` 创建 `netlify.toml`：
```toml
[build]
  command = "astro build"
  publish = "dist"
```

首次部署运行 `npx netlify deploy` 并授权；后续 `blog deploy` 执行 `netlify deploy --prod --dir=dist`。

## 完整交互示例

### 示例 1：首次使用博客

```
用户：blog init

助手：
✓ blog/ 已初始化
   模板来源：blog/
   已安装依赖：142 个包
   Astro 版本：5.x

下一步：
  - 生成博文 → publish（AI 编织 wiki 词条为博文）
  - 本地预览 → blog serve
  - 构建站点 → blog build
  - 部署上线 → blog deploy（需先配置部署目标）

---

用户：blog serve

助手：
✓ Astro 开发服务器已启动
   本地地址：http://localhost:4321
   热重载：已启用

按 Ctrl+C 停止服务器。

---

用户：blog build

助手：
✓ 博客站点构建完成
   输出目录：blog/dist/
   已发布博文：3 篇（1 篇 draft 已排除）
   搜索索引：dist/pagefind/（24 个分块）
   RSS：/rss.xml
   Sitemap：/sitemap-index.xml
   标签聚合页：5 个

总页面数：12
构建耗时：2.3s

下一步：
  - 本地预览构建产物 → npx astro preview（在 blog/ 内执行）
  - 部署上线 → blog deploy
```

### 示例 2：部署到 GitHub Pages

```
用户：blog deploy

助手：
✗ 尚未配置部署目标。

当前支持的部署方式：
① GitHub Pages — 免费，适合已有 GitHub 账号
② Vercel — 免费额度充裕，个人项目友好
③ Netlify — 支持分支预览，适合团队

请选择部署平台。

---

用户：①

助手：
正在配置 GitHub Pages 部署...

在 blog/ 安装 gh-pages...
✓ 已安装 gh-pages

在 package.json 添加 deploy 脚本...
✓ 已配置

正在部署 dist/ 到 gh-pages 分支...

✓ 博客站点已部署
   站点地址：https://username.github.io/repo-name/
   部署时间：2026-07-17 15:30
```

## 强制规则（Violation = 不合格输出）

| 规则 | 说明 |
|------|------|
| **源码 git 跟踪** | `blog/` 目录由 git 跟踪（AstroPaper 定制版）。`blog init` 仅安装依赖，不修改源码 |
| **dist 清空再构建** | 构建前 MUST 执行 `rm -rf blog/dist/`，避免残留旧博文 HTML、过期搜索索引 |
| **draft 排除全链路** | `draft: true` 博文 MUST NOT 出现在 HTML 页面、RSS feed、sitemap、搜索索引（Pagefind）中。此排除由 Astro 构建流程自动执行 |
| **初始化前置** | `serve`、`build`、`deploy` MUST 检查初始化状态；未初始化 → 报错并引导 `blog init` |
| **依赖完整性** | 构建/预览前 MUST 确认 `node_modules/` 存在；缺失时自动执行 `npm install` |
| **用户配置不受影响** | `blog init` 仅 `npm install`，不修改任何源文件；用户的自定义配置保持不变 |
| **部署目标可配置** | 不硬编码部署平台。`blog deploy` 读取用户配置，未配置时提供各平台指引 |
| **产物位置固定** | 构建输出固定在 `blog/dist/`；搜索索引固定在 `dist/pagefind/` |

## 常见错误处理

### 1. 未初始化就 serve/build

```
✗ blog/ 尚未初始化。

请先执行 blog init 初始化博客项目。
```
→ 用户需先运行 `blog init`。不允许跳过初始化直接操作。

### 2. deploy 未配置目标

```
✗ 尚未配置部署目标。

当前支持的部署方式：GitHub Pages / Vercel / Netlify
请选择平台，我会生成对应的配置文件。
```
→ 输出三平台选项，用户选择后生成配置并继续。

### 3. dist 不存在就 deploy

```
✗ blog/dist/ 不存在。

请先执行 blog build 构建站点。
```
→ 不允许跳过构建直接部署。提示用户构建后再部署。

### 4. node_modules 缺失

```
⚠️ node_modules/ 不存在，正在安装依赖...
```
→ 自动在 `blog/` 内执行 `npm install`，无需用户干预。

### 5. 构建报错（frontmatter 校验失败）

```
✗ 构建失败：Astro content collection schema 校验错误

src/content/posts/xxx.md: title 字段缺失
src/content/posts/yyy.md: pubDatetime 格式错误（应为 ISO 日期 YYYY-MM-DD）

请修复以上博文的 frontmatter 后重试 blog build。
```
→ 常见于手动编辑博文时 frontmatter 格式错误。列出具体文件与字段，引导用户修复。

### 6. Pagefind 索引未生成

```
⚠️ dist/pagefind/ 不存在，Pagefind 索引可能未生成。
正在补充执行 npx pagefind --site dist...
```
→ 自动补救。若仍然失败，检查 `astro-pagefind` 集成是否在 `astro.config.mjs` 中正确配置。

### 7. 端口 4321 被占用（serve 失败）

```
✗ 端口 4321 已被占用。

可指定其他端口：
  cd blog/ && npx astro dev --port 3000
```
→ 给出端口切换指引，不自动切换（避免与用户其他服务冲突）。

## 与其他 Skill 的联动

```
publish 生成/更新博文（blog/src/content/posts/*.md）
       │
       ▼
  用户想本地预览
       │
       ▼
  blog serve（本 skill）→ 启动 Astro 开发服务器
       
---

  blog build（本 skill）→ 编译静态 HTML + Pagefind 索引
       │
       ▼
  blog deploy（本 skill）→ 推送到配置的部署目标
       │
       ▼
  外部读者可通过 URL 访问博客站点
```

```
框架仓库 blog/ 更新（如 Astro 升级、新增集成）
       │
       ▼
  用户在新克隆的框架实例中 blog init → 获得最新模板
  （已有 blog/ 的用户需手动合并模板变更）
```

## 目录结构约定

```
项目根目录/
├── blog/                # 框架资产（被框架仓库跟踪）
│   ├── astro.config.mjs          # 预配：pagefind + rss + sitemap
│   ├── package.json              # 固定 Astro 主版本范围
│   ├── tsconfig.json
│   ├── src/
│   │   ├── content/
│   │   │   └── config.ts         # collection schema（10 字段）
│   │   ├── layouts/
│   │   │   └── BlogPost.astro    # 博文布局（TOC/阅读时长/相关/上下篇）
│   │   └── pages/
│   │       ├── index.astro       # 首页（博文列表 + 搜索入口）
│   │       ├── rss.xml.js        # RSS endpoint
│   │       └── tag/[tag].astro   # 标签聚合页
│   └── .gitignore.template       # 排除 node_modules/ 与 dist/
│
├── .agents/skills/
│   ├── publish/SKILL.md          # AI 编织转译（wiki → 博文 markdown）
│   └── blog/SKILL.md             # CLI 包装（Astro 构建/预览/部署）
│
└── docs/                         # 内容仓库（被框架忽略）
    └── blog/                     # 博客实例
        ├── astro.config.mjs      # 从模板复制，可自定义
        ├── package.json
        ├── node_modules/         # gitignored
        ├── src/
        │   └── content/blog/
        │       └── *.md          # 博文（由 publish 生成）
        ├── dist/                 # astro build 产物（gitignored）
        │   └── pagefind/         # Pagefind 搜索索引
        └── manifest.md           # 同步清单（由 publish 维护）
```

## 同步清单 (manifest.md)

manifest.md 是博客同步清单，由 `publish` skill 维护，记录每篇博文与源 wiki 词条的映射关系。blog skill 负责在缺失时初始化，以及在构建后校验一致性。

### 格式

```markdown
# Blog 同步清单

| 博文 | 源 wiki 词条 | 上次生成 | draft |
|------|-------------|---------|-------|
| production-agent-harness-context.md | [[Harness Engineering]] [[上下文窗口管理]] | 2026-07-17 | false |
```

**字段说明**：

| 字段 | 说明 |
|------|------|
| 博文 | `blog/src/content/posts/` 下的文件名（即 URL slug） |
| 源 wiki 词条 | 以 `[[词条名]]` 格式列出，多个用空格分隔 |
| 上次生成 | `YYYY-MM-DD` 格式，与博文 frontmatter `lastSynced` 同步 |
| draft | 博文 frontmatter `draft` 值（`true` = 草稿，不出现在构建中） |

> **事实源原则**：博文 frontmatter 中的 `derivedFrom` 和 `lastSynced` 是唯一事实源；manifest.md 是可读投影。若漂移，以 frontmatter 为准，可运行 `publish` skill 来修复。

### 初始化（manifest.md 缺失时）

当 `blog/` 目录存在但 `manifest.md` 缺失时（如首次 blog init、手动删除等），blog skill 应自动创建：

```bash
cat > blog/manifest.md << 'EOF'
# Blog 同步清单

| 博文 | 源 wiki 词条 | 上次生成 | draft |
|------|-------------|---------|-------|
EOF
```

创建后输出提示：
```
📄 已在 blog/manifest.md 创建同步清单（空）。
   执行 publish 生成博文时会自动填充。
```

### 校验（blog build 后）

`blog build` 完成后，可选执行校验：

```bash
# 检查 manifest.md 中有记录的博文是否都存在
for post in $(awk -F'|' 'NR>4 {gsub(/ /,"",$2); print $2}' blog/manifest.md); do
  [ -f "blog/src/content/posts/$post" ] || echo "⚠️ manifest 引用已删除的博文: $post"
done
```
