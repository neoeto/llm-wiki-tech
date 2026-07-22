## Why

当前 wiki 知识体（`docs/wiki/`）只能内部消费（explore/query/lint），缺乏对外发布路径。用户希望把已策展、已合成的知识沉淀为公开技术博客，让"个人知识库"产出可发布的"个人技术文章"。raw 多为他人论文/笔记，不宜直接发布；wiki 是用户自己合成的理解，天然适合作为博客内容来源。

## What Changes

- **新增 `publish` skill**：类比 ingest 的"提取+重构"，将 wiki 词条主题编织为博客叙事文章（多对1），转译 wiki 专有约定（`[[内链]]`、raw 溯源、信息冲突标记、7 段模板）为面向公众的博客散文
- **新增 `blog` skill**：类比 docs 包装 git，包装 Astro CLI（`blog init` / `blog serve` / `blog build` / `blog deploy`），将博客 markdown 编译为静态 HTML
- **新增 `blog/`**：框架内置预配 Astro 骨架，含与博客 frontmatter 对齐的 content collection schema，`blog init` 从此复制
- **新增 `blog/` 目录**：内容仓库内承载博客 markdown（`src/`）、构建产物（`dist/`）、同步清单（`manifest.md`）、Astro 配置
- **新增同步机制**：基于 frontmatter `derivedFrom` + `manifest.md` 跟踪"博文 ← 源 wiki 词条"映射，支持手动触发的过期检测与增量重生成
- **扩展 frontmatter 至 Astro 社区共识**：在同步骨架字段（`slug`/`derivedFrom`/`lastSynced`）基础上，采纳标准字段 `title`/`description`/`pubDatetime`/`tags`/`draft`/`modDatetime`/`author`；原 `status: published|draft` 改为标准 `draft: boolean`，与 Astro 工具链（RSS 过滤、sitemap）兼容
- **新增文章搜索功能**：基于 Pagefind Extended（内建中文分词），经 `astro-pagefind` 集成在构建后生成静态搜索索引，客户端懒加载查询；模板含搜索 UI 组件
- **新增站点级元素**：RSS feed（`@astrojs/rss`）、sitemap（`@astrojs/sitemap`）、标签聚合页（`/tag/[tag]/`）、目录 TOC、阅读时长、相关博文、上下篇导航（均为布局层派生，不进 frontmatter）
- **更新 `agent-spec.md`**：新增 §3.5 publish 工作流、§3.6 blog 构建工作流
- **更新 `README.md`**：工作流总览图与 skill 清单纳入 publish/blog

## Capabilities

### New Capabilities
- `wiki-publishing`: AI 将 `docs/wiki/` 词条主题编织为博客 markdown 的转译行为，含聚类提议、用户确认、叙事重写、wiki 约定转译、frontmatter 生成（含 SEO/摘要/同步骨架字段）、同步清单维护、过期检测与增量重生成
- `blog-site-build`: 包装 Astro CLI 管理 `blog/` 静态站点的生命周期（init/serve/build/deploy），含框架内置模板复制、依赖管理、构建产物输出；含 Pagefind 静态搜索索引（CJK 分词）、RSS feed、sitemap、标签聚合页、TOC/阅读时长/相关博文/上下篇等布局派生元素

### Modified Capabilities
<!-- 无既有 specs，本次全部为新建 -->

## Impact

- **框架仓库新增**：`.agents/skills/publish/SKILL.md`、`.agents/skills/blog/SKILL.md`、`blog/`（Astro 骨架目录）
- **框架仓库修改**：`agent-spec.md`（增两大工作流章节）、`README.md`（工作流图 + skill 清单 + 架构图）
- **内容仓库新增**：`blog/`（`src/`、`dist/`、`manifest.md`、`astro.config.mjs`、`package.json`、`node_modules/`）。因 `docs/` 已 gitignored，全部内容随内容仓库版本管理，框架不感知
- **新增依赖**：Astro + Pagefind + `@astrojs/rss` + `@astrojs/sitemap`（Node 工具链）。仅 `blog/` 内，不污染框架仓库
- **既有 skill 不受影响**：explore/ingest/query/lint/chat-to-raw/docs 行为不变；publish 是 wiki 的新消费方，与 query 并列
- **向后兼容**：纯新增功能，无 BREAKING 变更；既有 wiki 内容无需迁移即可被 publish 消费
- **风险**：主题编织为高难度 AI 任务，叙事质量依赖 publish skill 的 prompt 工程；manifest 与 frontmatter 双写须原子更新以防漂移；框架仓库因内置 Astro 模板体积增加（模板文件，非 node_modules）；Pagefind 中文为词典分词非子串匹配，个别生造词/混合术语可能召回不理想
