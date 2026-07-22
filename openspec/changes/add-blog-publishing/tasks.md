## 1. Astro 模板骨架（blog/）

- [x] 1.1 在框架仓库根创建 `blog/` 目录，初始化最小可用 Astro 项目结构（`astro.config.mjs`、`package.json`、`tsconfig.json`）
- [x] 1.2 在 `blog/package.json` 固定 Astro 主版本范围，配置 markdown 渲染（含代码高亮、表格、ASCII 图表保留）与 remark 插件（`remark-reading-time` 注入阅读时长、`remark-toc` 或布局层生成 TOC）
- [x] 1.3 编写 `blog/src/content/config.ts` 定义 blog collection schema（Zod），字段与博文 frontmatter 对齐：标准字段 `title`/`description`/`pubDatetime`/`tags`/`draft`/`modDatetime`/`author` + 同步骨架字段 `slug`/`derivedFrom`/`lastSynced`
- [x] 1.4 编写博文布局 `blog/src/layouts/BlogPost.astro`：设 `lang="zh-CN"` + `data-pagefind-body`（Pagefind 索引范围）；含 TOC、阅读时长、相关博文（按 tags 查询）、上下篇（按 pubDatetime 排序）；支持 `draft: true` 排除
- [x] 1.5 编写首页 `blog/src/pages/index.astro`：博文列表按 `pubDatetime` 降序，排除 `draft: true`，含搜索入口
- [x] 1.6 配置 Pagefind 搜索集成：`astro.config.mjs` 加 `astro-pagefind` 集成或 postbuild 脚本 `npx pagefind --site dist`；博文 `tags` 标记 `data-pagefind-filter="tag:X"`；预配搜索 UI 组件（`@pagefind/component-ui` 或自定义懒加载组件）
- [x] 1.7 配置 RSS：`blog/src/pages/rss.xml.js` endpoint，`@astrojs/rss` 从 `getCollection('blog')` 生成 feed，过滤 `draft: false`
- [x] 1.8 配置 sitemap：`astro.config.mjs` 加 `@astrojs/sitemap`，`serialize()` 回调将 `modDatetime` 映射为 `lastmod`
- [x] 1.9 编写标签聚合页 `blog/src/pages/tag/[tag].astro`：`getStaticPaths()` 聚合全部博文 `tags`，每页列出含该标签的 `draft: false` 博文
- [x] 1.10 在 `blog/` 内放一篇示例博文（frontmatter 10 字段完整），用于 `blog init` 后即时验证站点可渲染、搜索可用、RSS 生成
- [x] 1.11 配置 `.gitignore` 模板项，确保 `blog/node_modules/` 与 `blog/dist/`（含 `dist/pagefind/`）不进入版本管理

## 2. blog skill（SSG CLI 包装）

- [x] 2.1 创建 `.agents/skills/blog/SKILL.md`，遵循现有 skill 文件格式（frontmatter 含 name/version/description，正文先决条件 + 命令清单 + 规则）
- [x] 2.2 实现 `blog init` 命令规范：从 `blog/` 复制到 `blog/`，运行依赖安装，已存在非空目录时询问确认
- [x] 2.3 实现 `blog serve` 命令规范：启动 `astro dev`，前台运行热重载，未初始化时报错提示
- [x] 2.4 实现 `blog build` 命令规范：`astro build` 出 `dist/`（自动触发 Pagefind 索引生成至 `dist/pagefind/`），构建前清空旧 `dist/`，未初始化时报错；`draft: true` 博文从 HTML/RSS/sitemap/搜索索引中排除
- [x] 2.5 实现 `blog deploy` 命令规范：推送 `dist/` 到配置目标，未配置目标时给出 GitHub Pages/Vercel/Netlify 配置指引，`dist/` 不存在时提示先 build
- [x] 2.6 编写部署目标配置说明（如何配置 `blog/` 内的部署目标文件，平台无关）
- [x] 2.7 补充强制规则与常见错误章节（镜像 ingest/docs 的 SKILL.md 结构）

## 3. publish skill（AI 编织转译）

- [x] 3.1 创建 `.agents/skills/publish/SKILL.md`，frontmatter description 含触发词（publish/发布/博客/编织博文）并标注"触发后默认 wiki 来源"
- [x] 3.2 编写先决条件章节：MUST 先读 `agent-spec.md`、`docs/wiki/` 全部词条、`blog/manifest.md`（若存在）、`blog/src/` 已有博文
- [x] 3.3 编写 Phase 1 主题聚类：扫描 wiki 词条，综合 index.md 分类 + 双向内链图 + 语义相似度三类信号，输出候选聚类（含拟定标题、成员、理由、英文 slug）
- [x] 3.4 编写 Phase 2 用户确认门控：MUST 等待用户选择确认的聚类，不自主生成；标注"更新现有博文"vs"新建"
- [x] 3.5 编写 Phase 3 叙事编织：按叙事弧（钩子->问题->探索->综合->回顾）重写，附转译规则表（[[内链]]->链接/散文、raw 溯源丢弃、冲突化解、7 段模板重排、ASCII 图表保留）
- [x] 3.6 编写 frontmatter 生成规范：10 字段完整（标准 `title`/`description`/`pubDatetime`/`tags`/`draft`/`modDatetime`/`author` + 同步骨架 `slug`/`derivedFrom`/`lastSynced`）；`description` 由编织钩子段时顺手生成（≤160 字符，SEO+摘要）；`draft` 默认 `false`；英文 slug 由 AI 提议用户可改
- [x] 3.7 编写 Phase 4 同步清单维护：先写博文 frontmatter 再原子更新 `blog/manifest.md`，附 manifest 表格格式
- [x] 3.8 编写过期检测流程：比对 `lastSynced` 与源 wiki 词条 mtime，列出过期博文，只读不自动重生成
- [x] 3.9 编写增量重生成流程：用户确认后逐篇重编织，更新 frontmatter `lastSynced` 与 manifest；源词条已删除时询问处理
- [x] 3.10 编写强制规则章节（raw 不可发布、frontmatter 为事实源 manifest 为投影、双写原子性、英文 slug、draft 不发布）与常见错误章节

## 4. 规范与文档更新

- [x] 4.1 在 `agent-spec.md` 新增 §3.5 publish 工作流：输入 wiki 词条、聚类、确认、编织、frontmatter、manifest、过期检测与重生成
- [x] 4.2 在 `agent-spec.md` 新增 §3.6 blog 构建工作流：init/serve/build/deploy 命令、模板来源、部署目标配置
- [x] 4.3 更新 `README.md` 工作流总览图：在 ingest->wiki 后增加 wiki->publish->blog->HTML 的发布出口路径
- [x] 4.4 更新 `README.md` skill 清单表格，增加 publish 与 blog 两行（触发方式 + 功能）
- [x] 4.5 更新 `README.md` 项目架构图，增加 `blog/` 与 `blog/` 目录说明

## 5. 端到端样例验证

- [x] 5.1 执行 `blog init`，确认 `blog/` 创建、依赖安装、示例站点可 `blog serve` 渲染
- [x] 5.2 对现有 wiki 词条（如 [[Harness Engineering]] + [[上下文窗口管理]]）执行 publish，验证聚类提议 -> 确认 -> 编织 -> 生成博文 + frontmatter + manifest 完整
- [x] 5.3 执行 `blog build`，确认 `draft: false` 博文出现在 `dist/`，`draft: true` 被排除；确认 `dist/pagefind/` 搜索索引生成
- [x] 5.4 验证搜索功能：站点搜索 UI 可用，中文术语搜索（如"状态管理"）返回正确结果，标签过滤生效
- [x] 5.5 验证 RSS（`/rss.xml` 含已发布博文、排除 draft）与 sitemap（`sitemap-index.xml` 含 `modDatetime`->`lastmod`、排除 draft）
- [x] 5.6 验证标签聚合页（`/tag/[tag]/`）正确生成，TOC/阅读时长/相关博文/上下篇在博文页正确渲染
- [x] 5.7 修改 wiki 源词条后执行 publish 过期检测，确认能识别过期博文并提示重生成
- [x] 5.8 验证 manifest 与 frontmatter 一致性（derivedFrom、lastSynced 双写无漂移）
- [x] 5.9 验证 `blog/` 不被 `blog/` 内的修改污染（框架/内容分离）

## 6. 收尾

- [x] 6.1 全量 `lsp_diagnostics` 检查新增/修改文件无错误
- [x] 6.2 校验所有 SKILL.md frontmatter 与现有 skill 格式一致
- [x] 6.3 在 `docs/wiki/operation-log.md` 追加本次框架新增记录（若适用，遵循 ingest 日志格式）
