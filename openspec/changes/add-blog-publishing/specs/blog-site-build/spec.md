## ADDED Requirements

### Requirement: 博客项目初始化

`blog init` 命令 SHALL 从框架内置 `blog/` 复制 Astro 骨架到 `blog/`，并安装 Node 依赖。初始化后 `blog/` MUST 包含：`astro.config.mjs`、`package.json`、`src/content/config.ts`（content collection schema，与博文 frontmatter 对齐）、`src/layouts/`、`src/pages/`。若 `blog/` 已存在且非空，MUST 询问用户是否覆盖。

#### Scenario: 首次初始化
- **WHEN** 用户执行 `blog init` 且 `blog/` 不存在或为空
- **THEN** 从 `blog/` 复制全部文件到 `blog/`，运行依赖安装，输出成功提示

#### Scenario: 已存在非空目录
- **WHEN** 用户执行 `blog init` 且 `blog/` 已存在且非空
- **THEN** skill 询问用户是否覆盖；用户确认后才执行复制，否则中止

#### Scenario: schema 对齐
- **WHEN** 初始化完成
- **THEN** `src/content/config.ts` 定义的 collection schema 字段与博文 frontmatter 字段一致：标准字段 `title`/`description`/`pubDatetime`/`tags`/`draft`/`modDatetime`/`author` + 同步骨架字段 `slug`/`derivedFrom`/`lastSynced`

### Requirement: 本地预览

`blog serve` 命令 SHALL 启动 Astro 开发服务器（`astro dev`），在本地提供博客站点的实时预览。服务 MUST 在前台运行，支持热重载。用户可通过 Ctrl+C 终止。

#### Scenario: 启动开发服务器
- **WHEN** 用户执行 `blog serve`
- **THEN** 启动 `astro dev`，输出本地访问 URL（默认 http://localhost:4321），服务器在前台运行

#### Scenario: 未初始化
- **WHEN** 用户执行 `blog serve` 但 `blog/` 不存在或无 `astro.config.mjs`
- **THEN** skill 报错并提示先执行 `blog init`

### Requirement: 静态站点构建

`blog build` 命令 SHALL 执行 `astro build`，将 `blog/src/` 下的 markdown（含 frontmatter `draft: false` 的博文）编译为静态 HTML，输出到 `blog/dist/`。frontmatter `draft: true` 的博文 MUST 被排除（不出现在 HTML、RSS、sitemap、搜索索引中）。构建后 SHALL 自动运行 Pagefind 索引生成步骤（经 `astro-pagefind` 集成或 postbuild 脚本），在 `dist/pagefind/` 产出搜索索引。

#### Scenario: 构建成功
- **WHEN** 用户执行 `blog build` 且 `blog/` 已初始化
- **THEN** 运行 `astro build`，静态 HTML 输出到 `blog/dist/`，`draft: true` 博文不出现；随后 Pagefind 在 `dist/pagefind/` 生成搜索索引

#### Scenario: 构建产物已存在
- **WHEN** `blog/dist/` 已有旧构建产物
- **THEN** 构建前清空 `dist/`，再输出新产物，避免残留旧文件与旧搜索索引

#### Scenario: 未初始化
- **WHEN** 用户执行 `blog build` 但 `blog/` 未初始化
- **THEN** skill 报错并提示先执行 `blog init`

### Requirement: 部署

`blog deploy` 命令 SHALL 将 `blog/dist/` 的静态产物推送到用户配置的部署目标。部署目标 MUST 可配置（不绑死平台）。部署前 MUST 确保 `dist/` 存在且为最新构建。

#### Scenario: 推送到配置的远端
- **WHEN** 用户执行 `blog deploy` 且已配置部署目标
- **THEN** skill 将 `dist/` 内容推送到配置目标，输出部署结果

#### Scenario: 未配置部署目标
- **WHEN** 用户执行 `blog deploy` 但未配置部署目标
- **THEN** skill 提示用户先配置部署目标（给出 GitHub Pages/Vercel/Netlify 等选项说明），中止部署

#### Scenario: dist 不存在或过期
- **WHEN** 用户执行 `blog deploy` 但 `dist/` 不存在
- **THEN** skill 提示先执行 `blog build`，中止部署

### Requirement: 依赖管理

blog skill SHALL 管理 Astro 项目的 Node 依赖。`blog init` 时安装依赖；用户可通过约定命令更新依赖。Astro 版本范围在 `blog/package.json` 中固定，避免大版本升级破坏 schema 兼容性。

#### Scenario: 初始化安装依赖
- **WHEN** `blog init` 复制模板完成
- **THEN** 在 `blog/` 运行依赖安装（npm/pnpm），`node_modules/` 创建于 `blog/` 内

#### Scenario: 依赖版本固定
- **WHEN** 检查 `blog/package.json`
- **THEN** Astro 主版本被固定为特定大版本范围，避免破坏性升级

### Requirement: 配置可定制性

`blog init` 从模板复制后，用户可自由修改 `blog/astro.config.mjs`、主题、布局等，不影响框架仓库的 `blog/`。用户的自定义配置 MUST NOT 被 `blog` 命令覆盖（除显式覆盖场景）。

#### Scenario: 用户自定义配置不被覆盖
- **WHEN** 用户修改了 `blog/astro.config.mjs` 后执行 `blog serve` 或 `blog build`
- **THEN** skill 使用用户的自定义配置，不回退到模板默认值

#### Scenario: 框架模板不被内容修改污染
- **WHEN** 用户在 `blog/` 内修改配置或主题
- **THEN** 框架仓库的 `blog/` 保持不变（因 `docs/` 已 gitignored 且模板在框架仓库独立路径）

### Requirement: Pagefind 静态搜索索引

`blog/` SHALL 预配 Pagefind 搜索集成（经 `astro-pagefind` 或 postbuild 脚本）。`blog build` 执行后 MUST 在 `dist/pagefind/` 生成搜索索引，索引内容来自博文 HTML（`data-pagefind-body` 标记区域）。索引 MUST 排除 `draft: true` 博文。

#### Scenario: 搜索索引生成
- **WHEN** `blog build` 完成静态 HTML 输出
- **THEN** Pagefind 扫描 `dist/` 的 `data-pagefind-body` 区域，在 `dist/pagefind/` 生成分块索引（`pagefind.js` + 索引分片），`draft: true` 博文不被索引

#### Scenario: 索引懒加载
- **WHEN** 用户在浏览器中打开搜索 UI
- **THEN** `pagefind.js`（~30KB）按需 `import()` 加载，搜索查询时仅加载匹配的索引分块，首屏不加载搜索 JS

### Requirement: 中文搜索支持

Pagefind SHALL 使用 Extended 版（`npx pagefind` 默认下载 extended），对 `lang="zh-CN"` 的博文 HTML 启用内建中文分词。博文布局 MUST 设置 `lang="zh-CN"` 与 `data-pagefind-body` 属性。

#### Scenario: 中文分词搜索
- **WHEN** 用户搜索中文术语（如"状态管理"）
- **THEN** Pagefind 按词典分词后匹配博文内容，返回包含该术语的结果

#### Scenario: 标签过滤维度
- **WHEN** 博文布局将 `tags` 标记为 `data-pagefind-filter="tag:X"`
- **THEN** 搜索 UI 支持按标签过滤搜索结果

### Requirement: 搜索 UI

`blog/` SHALL 预配搜索 UI 组件，含搜索入口与结果展示。搜索 UI MUST 在用户交互时懒加载 Pagefind，不阻塞首屏。

#### Scenario: 搜索入口可用
- **WHEN** 站点构建完成并部署
- **THEN** 站点含搜索入口（如导航栏搜索按钮或搜索框），点击/聚焦后触发 Pagefind 加载

#### Scenario: 搜索结果展示
- **WHEN** 用户输入查询词
- **THEN** UI 展示匹配博文（标题、摘要 excerpt、URL），支持防抖查询

### Requirement: RSS feed

`blog/` SHALL 预配 RSS endpoint（`/rss.xml`），经 `@astrojs/rss` 从 `blog` content collection 生成 feed。feed MUST 仅含 `draft: false` 的博文，每条映射 `title`/`description`/`pubDatetime`/`link`。

#### Scenario: RSS 生成
- **WHEN** `blog build` 执行
- **THEN** 生成 `/rss.xml`，含全部 `draft: false` 博文的 RSS item，`draft: true` 博文不出现

### Requirement: Sitemap

`blog/` SHALL 预配 `@astrojs/sitemap` 集成。构建后生成 `sitemap-index.xml`。博文的 `modDatetime`（若存在）SHALL 映射为 sitemap 的 `lastmod`。

#### Scenario: sitemap 生成
- **WHEN** `blog build` 执行
- **THEN** 生成 `sitemap-index.xml`，含全部已发布博文 URL；有 `modDatetime` 的博文含 `lastmod`，`draft: true` 博文不出现

### Requirement: 标签聚合页

`blog/` SHALL 预配标签聚合页（`/tag/[tag]/`），经 `getStaticPaths()` 聚合全部博文 `tags` 值。每个标签页列出含该标签的全部 `draft: false` 博文。

#### Scenario: 标签页生成
- **WHEN** `blog build` 执行且博文含 `tags: [agent, harness]`
- **THEN** 生成 `/tag/agent/` 与 `/tag/harness/` 页面，各列出含该标签的已发布博文

### Requirement: 布局派生元素

`blog/` 的博文布局 SHALL 在构建时派生以下元素（不依赖 frontmatter 额外字段）：
- **目录 TOC**：从 markdown 标题自动生成
- **阅读时长**：经 `remark-reading-time` 插件构建时计算并注入
- **相关博文**：从 `getCollection('blog')` 按 `tags` 重叠数查询，取前 N 篇
- **上下篇导航**：从按 `pubDatetime` 排序的集合取相邻项

#### Scenario: TOC 自动生成
- **WHEN** 博文含多个标题层级
- **THEN** 博文页展示自动生成的目录，链接到各标题锚点

#### Scenario: 阅读时长展示
- **WHEN** 博文构建
- **THEN** 博文页展示阅读时长估算（经 remark 插件计算），无需 frontmatter 手填

#### Scenario: 相关博文按标签
- **WHEN** 博文 A 含 `tags: [agent]`，且存在其他含 `agent` 标签的已发布博文
- **THEN** 博文 A 页面展示相关博文列表（排除 A 自身，按共同标签数排序）
