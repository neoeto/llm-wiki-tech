## Context

本项目是一个 AI Agent 驱动的个人知识库系统：`docs/raw/`（不可变原始素材）经 `ingest` skill 编译为 `docs/wiki/`（结构化、双向内链的词条知识体）。现有 6 个 skill（explore/ingest/query/lint/chat-to-raw/docs）仅消费或维护 wiki，无对外发布路径。

架构核心约束（来自 `agent-spec.md` 与 `README.md`）：
- **框架/内容分离**：`.agents/skills/` + `agent-spec.md` 是可复用框架仓库；`docs/` 是独立内容仓库，已被 `.gitignore` 忽略。每个框架克隆实例可关联不同内容仓库
- **raw 不可变**：`docs/raw/` 只读，所有结论须溯源
- **wiki 由 AI 全权维护**：7 段模板、`[[概念名]]` 双向内链、`[docs/raw/xxx.md:章节]` 溯源、`【信息冲突】` 并存标记

本次新增"博客发布"能力，为 wiki 知识体增加一条"对外发布出口"。

## Goals / Non-Goals

**Goals:**
- 将 `docs/wiki/` 词条编织为面向公众的技术博客文章（多对1主题编织）
- 转译 wiki 专有约定为博客可读散文（`[[内链]]`、raw 溯源、冲突标记、7 段模板）
- 提供同步骨架：跟踪"博文 ← 源词条"映射，支持手动触发的过期检测与增量重生成
- 用 Astro 将博客 markdown 编译为静态 HTML，可部署到任意静态托管
- 严格遵循既有框架/内容分离：框架内置 Astro 模板，内容在 `blog/`，互不污染
- 两个新 skill（publish/blog）的职责划分镜像现有 ingest/docs（AI 转译 vs CLI 包装）

**Non-Goals:**
- 不支持 raw 直接发布（raw 多为他人素材，wiki 才是用户策展产物）
- 不做全自动聚类生成（采用 AI 提议 + 用户确认的混合模式）
- 不做 ingest 后自动联动重生成（采用 publish 手动触发检测）
- 不在本次扩展 lint 检测博客孤儿/覆盖率（记为后续可扩展项）
- 不绑定特定部署平台（GitHub Pages/Vercel/Netlify 均可，`blog deploy` 推到配置远端）
- 不支持博客评论、搜索后端等动态功能（纯静态）

## Decisions

### D1: 内容来源 = `docs/wiki/`（非 raw）

**选择**：博客从 wiki 派生。
**理由**：raw 多为论文/笔记/他人素材，不宜直接发布；wiki 是用户已策展、已合成的知识沉淀，天然适合作为"自己的博客"内容。新 publish skill 做 `wiki -> blog` 转译，与 ingest 的 `raw -> wiki` 转译对称。
**备选**：raw -> blog（重复 ingest 提取工作，且发布他人材料）/ wiki+raw 混合（溯源边界复杂）。均否决。

### D2: 粒度 = 主题编织（多对1）

**选择**：多个相关 wiki 词条合成一篇叙事博文。
**理由**：单词条机械转译读起来像百科全书而非博客；主题编织能展示综合洞察（用户实际价值增量），产出"真正像博客"的文章。
**代价**：AI 任务难度高、增量同步复杂。通过 D6 的 manifest 机制缓解同步问题；通过 D5 的混合聚类缓解质量风险。
**备选**：1对1+发布标志（最简单但太机械）/ 纯1对1。均因产物质量否决。

### D3: SSG = Astro

**选择**：Astro 作为静态站点生成器。
**理由**：Content Collections 对 markdown frontmatter 有类型校验，与本次 `derivedFrom` frontmatter 强需求契合；MDX 支持未来组件交互；DX 最好。
**代价**：Node 工具链（vs Hugo 单二进制）。可接受，因框架已含 Node 生态（package.json）。
**备选**：Hugo（最快但 Go 模板有学习曲线，frontmatter 校验弱）/ Jekyll（老化）。均否决。

### D4: 两个 skill 分工 = publish（AI 转译）+ blog（CLI 包装）

**选择**：拆成两个 skill。
**理由**：镜像现有 ingest/docs 的分工范式——ingest 是 AI 转译工作，docs 包装 git CLI。publish 是 AI 编织工作，blog 包装 Astro CLI。职责清晰、与现有架构一致。
**备选**：单一 skill 管全部（AI 工作与机械命令混杂，与现有风格不符）。否决。

### D5: 聚类触发 = 混合（AI 提议 + 用户确认）

**选择**：publish 扫描 wiki 提出候选主题聚类，用户确认后才生成。
**理由**：兼顾"AI 帮我发现可写主题"的自动化魔法与作者控制权，避免产出不想要的文章。
**聚类算法**：以 `docs/wiki/index.md` 分类为种子 + 双向内链图（互相链接的词条相关）+ 语义相似度。三类信号加权。
**备选**：全自动（可能产出不认同分组）/ 纯手动指定（失去 AI 发现价值）。均否决。

### D6: 同步模式 = 手动触发检测

**选择**：用户跑 `publish`，skill 比对每篇博文 `lastSynced` 与源 wiki 词条修改时间，列出过期项，问是否重生成。
**理由**：与 ingest 显式触发一致，最简单可靠；不引入 skill 间耦合（publish 不依赖 ingest 时机）。
**事实源**：frontmatter `derivedFrom` 字段。`blog/manifest.md` 是可读索引（镜像 wiki 的 `index.md` 模式），由 publish 原子更新。

### D7: Astro 项目来源 = 框架内置模板

**选择**：`blog init` 从 GitHub 克隆 AstroPaper 主题，再应用 `blog/overlay/` 定制层。
**理由**：AstroPaper 是成熟的生产级主题（暗色模式、Pagefind 搜索、RSS、sitemap、TOC、Tailwind v4 内置），比自建模板成熟得多。overlay 仅含差异文件（sync 字段 + Mermaid + 阅读时长），AstroPaper 上游保持独立可更新。
**代价**：框架仓库体积增加（模板文件，非 node_modules——后者在 `blog/` 内被 gitignore）。
**备选**：`npm create astro` 现场脚手架 + 自动注入 schema（依赖网络、主题需自选、易漂移）。否决。

### D8: 博客产物位置 = 内容仓库内 `blog/`

**选择**：markdown 源（`src/`）、构建产物（`dist/`）、manifest、Astro 配置全部在 `blog/`。
**理由**：与现有"内容都在 docs/、随内容仓库版本管理"模型一致；`docs/` 已 gitignored，框架不感知内容。
**部署**：`dist/` 可由 CI 推到独立部署仓库（如 `username.github.io`）或 Pages 分支。`blog deploy` 仅负责推送，不绑死平台。

### D9: frontmatter 采用 Astro 社区共识字段

**选择**：在同步骨架字段基础上，采纳 Astro 主题生态共识字段。
**理由**：调研 7+ 生产级 Astro 主题（AstroPaper/Astro Cactus/Devosfera/antfustyle 等）与官方 docs，`title`/`description`/`pubDatetime`/`tags`/`draft`/`modDatetime`/`author` 是近乎通用字段；非标准字段会导致 RSS 过滤、sitemap、主题渲染异常。
**关键变更**：原 `status: published|draft` **改为标准 `draft: boolean`**。理由：(1) Astro 工具链（`@astrojs/rss` 过滤、sitemap、主题 draft 排除）均预期 `draft`；(2) `draft: false` 等价 `published`，语义无损；(3) 未来若需更多状态可再扩展，当前 YAGNI。
**自定义保留**：`derivedFrom`、`lastSynced` 是本项目同步机制专属（slug 由文件名决定，不写入 frontmatter），Astro 工具不感知但无害（schema 中声明即可）。
**备选**：保留 `status` 枚举（与生态不兼容，需在各工具处加映射层）。否决。

### D10: 搜索 = Pagefind Extended（CJK 内建分词）

**选择**：经 `astro-pagefind` 集成，构建后扫描 HTML 生成分块索引，客户端懒加载查询。
**理由**：(1) 纯静态无后端，符合本项目约束；(2) **Extended 版内建中文/日文分词**（`npx pagefind` 默认下载 extended），`lang="zh-CN"` 自动启用，无需额外配置；(3) 分块懒加载，首屏 0 JS，搜索时按需加载 ~30KB + 索引分块；(4) Starlight（Astro 官方文档框架）内置用 Pagefind，生态最强背书；(5) 构建时索引与 content collections 流程天然配对。
**集成方式**：`astro.config` 加 `pagefind()` 集成；博文布局 `<article data-pagefind-body lang="zh-CN">`；tags 用 `data-pagefind-filter="tag:X"` 标记为过滤维度；搜索 UI 用 `@pagefind/component-ui`（Pagefind 1.5+ 原生自定义元素 `<pagefind-modal>`）。
**已知限制**：CJK 为词典分词非子串匹配（搜"段简"匹配不到"一段简单"）。技术博客搜索术语/标题/技术名词场景下可接受；生造词或混合术语可能召回不理想，可通过 `data-pagefind-weight` 加权缓解。
**备选**：Fuse.js（字符级 brute-force，>500 篇变慢，无分词）/ FlexSearch（需自建 JSON 索引 + 自写 UI，工作量大）/ Algolia DocSearch（需 SaaS 账号，非静态）。均否决。

### D11: 布局派生元素（不进 frontmatter）

**选择**：TOC、阅读时长、相关博文、上下篇导航均由 `blog/` 布局层在构建时派生，publish skill 不产出这些字段。
**理由**：这些是渲染关注点，非内容作者关注点；放进 frontmatter 会与正文不同步（正文改了字数，frontmatter 阅读时长过期）。Astro 生态标准做法是构建时计算。
**实现**：
- **TOC**：remark 插件（`remark-toc`/`remark-flexible-toc`）或布局从 `Astro.props.headings` 渲染
- **阅读时长**：`remark-reading-time` 插件，构建时注入 `readingTime` 到 frontmatter（自动，publish 不写）
- **相关博文**：布局从 `getCollection('blog')` 按 `tags` 重叠数查询，取前 3-6 篇
- **上下篇**：布局从按 `pubDatetime` 排序的集合中取相邻项
- **OG 图**：可选，Satori 端点根据 `title`+`description` 自动生成，无 frontmatter

### D12: 站点级元素

**选择**：`blog/` 内置 RSS、sitemap、标签聚合页、搜索 UI、首页。
**理由**：这些是完整博客站点的标配，模板预配后 `blog init` 即开箱可用。
**实现**：
- **RSS**：`/rss.xml` endpoint，`@astrojs/rss` + `getCollection('blog')` 过滤 `draft: false`，映射为 feed items
- **Sitemap**：`@astrojs/sitemap` 集成，`serialize()` 回调将 `modDatetime` 映射为 `lastmod`
- **标签聚合页**：`/tag/[tag]/` 动态路由，`getStaticPaths()` 聚合全部博文 `tags`
- **搜索 UI**：`@pagefind/component-ui` 的 `<pagefind-modal>`，或自定义搜索组件（懒加载 `/pagefind/pagefind.js`）
- **首页**：博文列表（按 `pubDatetime` 降序，排除 `draft: true`），含搜索入口

## 数据模型

### 博文 frontmatter（Astro content collection schema）

```yaml
---
# --- Astro 社区共识字段 ---
title: "生产级 Agent 的驭手工程"        # 必填, ≤60 字符
description: "Harness 是 LLM 的控制面..." # 必填, ≤160 字符, SEO+列表预览摘要
pubDatetime: 2026-07-17                      # 必填, ISO 日期
tags: [agent, harness, context-engineering] # default []
draft: false                             # default false; true = 构建排除
modDatetime: 2026-07-17                  # optional, 内容更新信号 -> sitemap lastmod
author: "Neo"                            # default 全局 SITE.author

# --- 本项目同步骨架字段（自定义, Astro 工具不感知） ---
slug: production-agent-harness           # 英文 slug, URL 友好, AI 提议可改
derivedFrom:                           # 事实源: 源 wiki 词条
  - "[[Harness Engineering]]"
  - "[[上下文窗口管理]]"
lastSynced: 2026-07-17                  # 上次生成日期, 过期检测基准
---
```

> **schema 注意**：`z` 从 `astro:content` 重导出，无需单独装 zod；`z.coerce.date()` 处理 YAML 日期字符串；自定义字段在 schema 中正常声明即可，不影响 Astro 工具链。

### `blog/manifest.md`（可读索引，非事实源）

```markdown
# Blog 同步清单
| 博文 | 源 wiki 词条 | 上次生成 | 状态 |
|------|-------------|---------|------|
| production-agent-harness.md | [[Harness Engineering]] [[上下文窗口管理]] | 2026-07-17 | published |
```
> manifest.md 是 frontmatter `derivedFrom` + `lastSynced` 的可读投影，由 publish 原子更新。**frontmatter 是事实源**，manifest 漂移可由重新生成修复。

## wiki -> blog 转译规则

| wiki 元素 | 博客处理 | 理由 |
|---|---|---|
| `[[概念名]]` 内链 | 源词条已发布 -> 真实博文链接；未发布 -> 散文化提及 | 死链破坏阅读 |
| `[docs/raw/xxx:章节]` 溯源 | 丢弃 | 泄露内部文件结构 |
| `【信息冲突】` 标记 | 在叙事中化解为"业界仍有争议"叙述，或保留为讨论 | 内部策展噪音 |
| 7 段刚性模板 | 重排为叙事弧（钩子 -> 问题 -> 探索 -> 综合 -> 回顾） | 百科 ≠ 博客 |
| `operation-log.md` / `index.md` | 排除 | 非文章 |
| ASCII 图表 | **保留** | 技术博客出彩元素 |
| 代码块 / 表格 | 保留 | 技术内容载体 |

## 目录结构

```
llm-wiki/  (框架仓库)
├── .agents/skills/
│   ├── explore/ ingest/ query/ lint/ chat-to-raw/ docs/
│   ├── publish/SKILL.md        ◄── NEW
│   └── blog/SKILL.md           ◄── NEW
├── blog/              ◄── NEW: 预配 Astro 骨架
│   ├── astro.config.mjs        (pagefind + rss + sitemap 集成)
│   ├── package.json
│   ├── src/content/config.ts   (collection schema, 含同步字段)
│   ├── src/layouts/BlogPost.astro  (data-pagefind-body + TOC + readingTime + related)
│   └── src/pages/
│       ├── index.astro         (首页博文列表)
│       ├── rss.xml.js          (RSS endpoint)
│       └── tag/[tag].astro     (标签聚合页)
├── agent-spec.md               ◄── 修改: 增 §3.5 §3.6
└── docs/  (内容仓库, gitignored)
    ├── raw/  wiki/
    └── blog/                   ◄── NEW
        ├── src/*.md            (博文, frontmatter + 正文)
        ├── dist/               (astro build 产物)
        │   └── pagefind/       (Pagefind 搜索索引, 构建时生成)
        ├── manifest.md         (同步清单)
        ├── astro.config.mjs    (从模板复制, 可自定义)
        └── package.json
```

## Risks / Trade-offs

- **[主题编织质量依赖 prompt 工程]** -> 第一版先做 1 篇样例验证 prompt，固化叙事模板后再泛化。publish SKILL.md 须含详细叙事弧指引与正反例
- **[manifest 与 frontmatter 双写漂移]** -> frontmatter 为唯一事实源，manifest 是投影。publish 必须**原子更新**两者（先写博文 frontmatter，再更新 manifest）。lint 未来可校验一致性
- **[框架仓库体积增加]** -> 内置模板仅含配置文件与少量布局，不含 node_modules（在 `blog/` 内）。体积增量可控
- **[Astro 版本升级破坏 schema]** -> `blog/` 固定 Astro 版本范围；`blog init` 后用户可选择升级
- **[多对1增量重生成成本]** -> 单词条更新可能触发整篇博文重生成（叙事连贯性要求）。publish 须明确告知用户影响范围，让其确认
- **[英文 slug 与中文 wiki 概念名映射]** -> publish 生成博文时由 AI 提议英文 slug，用户可修改。映射记录在 frontmatter 与 manifest
- **[Pagefind CJK 分词非子串匹配]** -> 技术博客搜索术语/标题场景下词典分词可接受；生造词或中英混合术语可能召回不理想，通过 `data-pagefind-weight` 给关键词加权缓解。若未来需子串搜索可切 FlexSearch + 自建索引（工作量大）
- **[frontmatter 字段膨胀]** -> 同步骨架字段（slug/derivedFrom/lastSynced）与 Astro 标准字段共存。schema 中统一声明，publish 必须产出全部字段。Astro 工具仅感知标准字段，自定义字段无害

### D13: 两遍聚类优化（Phase 0 代码预处理 + Phase 1 轻量 LLM 聚类）

**选择**：publish skill 先用 bash 代码提取结构化 index card（标题+基础定义摘要+内链+分类），再由 LLM 基于此轻量数据聚类。全文仅在 Phase 3 对用户确认的聚类成员（2-5 篇）读取。
**理由**：原方案"读全部 wiki 全文再聚类"在 50+ 条词条时撞墙（~65K tokens 输入，超 128K 窗口）。代码预处理零 token，index card 每条 ~50 tokens vs 全文 ~1300 tokens，节省 96%。语义相似度仍由 LLM 在轻量 index card 上计算（标题+摘要足够判断主题相关性），全文细节不影响聚类质量。
**代价**：bash 命令需处理跨行 YAML frontmatter（derivedFrom 值在多行）和 macOS 兼容性（grep -o 非 -P）。已在 SKILL.md 中验证命令可跑通。
**备选**：embedding 向量预聚类（需引入额外工具链，当前项目无 Node 脚本基础设施）/ 纯代码聚类无 LLM（无法判断语义相似度，聚类质量差）。均否决。
