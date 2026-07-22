# LLM Wiki

基于 AI Agent 的个人知识库系统。将非结构化素材（论文、笔记、网页摘要、对话记录）自动编译为结构化、可检索、双向链接的 wiki 知识体。

## 核心理念

| 原则 | 说明 |
|------|------|
| **raw 不可变** | 原始素材（`docs/raw/`）只能引用，绝不修改。事实单一来源。 |
| **AI 全权维护 wiki** | 所有词条由 AI 根据 raw 素材自动创建、更新、拆分、合并。 |
| **强制双向内链** | 每个词条通过 `[[概念名]]` 互相链接，零孤立页面。 |
| **溯源必标注** | 每一条结论标注原始素材出处 `[docs/raw/xxx.md:章节]`。 |
| **信息冲突并存** | 多篇文献矛盾时，不擅自取舍，并列标注 `【信息冲突】`。 |

---

## 项目架构

项目分为两层：**框架层**（AI Agent 规范 + Skills）和 **内容层**（wiki 产出物），通过 `.gitignore` 彻底分离。

```
llm-wiki/                        ← 框架仓库
├── README.md
├── agent-spec.md                ← 核心规范：模板、工作流、命名规则
├── .gitignore                   ← 忽略 docs/ 和 blog/（框架不跟踪内容）
├── .agents/skills/              ← 8 个 AI Skill
│   ├── explore/SKILL.md         ← 知识探索对话（默认）
│   ├── ingest/SKILL.md          ← 素材导入编译
│   ├── query/SKILL.md           ← 精准查询
│   ├── lint/SKILL.md            ← 知识库自检修复
│   ├── chat-to-raw/SKILL.md     ← 会话知识归档
│   ├── docs/SKILL.md            ← 内容仓库管理
│   ├── publish/SKILL.md         ← 博客编织发布（wiki->blog）
│   └── blog/SKILL.md            ← 静态站点构建（Astro CLI）
├── blog/                        ← AstroPaper 定制版（git 跟踪，blog init 仅 npm install）
├── docs/                        ← 内容仓库（独立 git，框架不可见）
│   ├── wiki/                    ← AI 维护的结构化词条
│   │   ├── index.md             ← 全局分类索引
│   │   └── operation-log.md     ← 操作日志
│   └── raw/                     ← 原始素材（只读）
│       └── chats/               ← 会话归档
└── blog/                        ← 博客（AstroPaper 克隆 + overlay + publish 产出）
    ├── src/content/posts/        ← 博文 markdown（frontmatter + 正文）
    ├── dist/                    ← astro build 静态 HTML（含 pagefind 搜索索引）
    └── manifest.md               ← 博客同步清单
```

> **为什么分离？** 框架是可复用的 AI Agent 引擎，可以克隆到多处使用。每个克隆实例的 `docs/` 可以关联不同的内容仓库，互不干扰。就像浏览器和网页的关系——浏览器（框架）是同一个，但每个用户看到的网页（内容）各不相同。

---

## 工作流总览

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Explore │────->│chat-to-raw│────->│  Ingest  │
│ 知识探索  │     │ 会话归档  │     │ 素材导入  │
└──────────┘     └──────────┘     └──────────┘
      │                                 │
      │                                 ▼
      │              ┌──────────┐  ┌──────────┐     ┌──────────┐     ┌──────────┐
      └─────────────->│  Query   │  │   Lint   │────>│ Publish  │────>│   Blog   │
       知识缺口反馈    │ 精准查询  │  │ 自检修复  │     │ 博客编织  │     │ 站点构建  │
                      └──────────┘  └──────────┘     └──────────┘     └──────────┘
                                                                       │
                                                                       ▼
                                                                  静态 HTML
                                                                  （可部署）
```

> **发布出口**：`Publish` 将 wiki 词条主题编织为博客 markdown，`Blog` 经 Astro 编译为静态 HTML（含 Pagefind 中文搜索、RSS、sitemap），可部署到 GitHub Pages / Vercel / Netlify。

| 工作流 | 触发方式 | 功能 |
|--------|---------|------|
| **Explore** | 默认，所有对话 | 与 AI 讨论 LLM/AI 知识，结合 wiki 和 AI 自身知识 |
| **Ingest** | `ingest` | 将 `docs/raw/` 下的新素材编译为 wiki 词条 |
| **Query** | `query` 或 `查询` | 仅基于 wiki 词条精准回答，不读 raw，不编造 |
| **Lint** | `lint` 或 `体检` | 全量扫描：孤立页面、重复词条、超长拆分、失效内链 |
| **Chat-to-Raw** | `保存` 或 `记录` | 将当前会话知识提取为 raw 素材，可选直接 Ingest |
| **Docs** | `docs push` 等 | 管理 `docs/` 的 git 仓库（推送、拉取、关联远程） |
| **Publish** | `publish` 或 `发布` | 将 wiki 词条主题编织为博客 markdown（多对1叙事），转译 wiki 约定，维护同步清单 |
| **Blog** | `blog init/serve/build/deploy` | 包装 Astro CLI：构建静态站点（含 Pagefind 中文搜索、RSS、sitemap），部署到静态托管 |

---

## 快速开始

### 1. 克隆框架

```bash
git clone <framework-repo-url> my-wiki
cd my-wiki
```

### 2. 设置内容仓库

```bash
# 方案 A：新建内容仓库
git init docs
cd docs && git add -A && git commit -m "init: wiki content"

# 方案 B：克隆已有内容
git clone <your-content-repo-url> docs/
```

### 3. 开始使用

直接用自然语言与 AI 对话——Explore 是默认模式，会结合 wiki 已有内容和 AI 知识与你讨论。

放一篇论文 PDF 到 `docs/raw/`，然后说 `ingest`，AI 会自动将其编译为结构化 wiki 词条。

---

## 多仓库部署

同一套框架，多处部署，各自独立的内容仓库：

```bash
# 场景 1：个人知识库
git clone <framework-repo> personal-wiki
cd personal-wiki && git clone git@github.com:me/my-notes.git docs/

# 场景 2：团队技术文档
git clone <framework-repo> team-wiki
cd team-wiki && git clone git@github.com:team/tech-docs.git docs/

# 场景 3：项目专属 wiki
git clone <framework-repo> project-wiki
cd project-wiki && git init docs
```

三个实例使用同一套框架，但 `docs/` 关联不同仓库，内容完全隔离。

---

## 内容仓库管理

使用 `docs` skill 管理内容仓库：

```
docs init         # 初始化 docs/ 为 git 仓库
docs clone <url>  # 克隆已有内容仓库
docs remote       # 查看/设置远程仓库地址
docs pull         # 拉取远程最新内容
docs push         # 推送本地修改
docs status       # 查看工作区状态
docs log          # 查看提交历史
```

---

## 词条模板

所有 wiki 词条必须包含以下 7 个板块：

```markdown
# {{词条名称}}

## 1. 基础定义
一句话精准定义。

## 2. 核心原理 / 核心内容
分层拆解核心逻辑、架构、流程。

## 3. 关键特性 & 优缺点
### 优势
### 局限

## 4. 适用场景
落地、学习、工程使用场景。

## 5. 对比关联
与相似概念横向对比，[[内链]]。

## 6. 原始资料溯源
- [docs/raw/xxx.pdf]：原文页码/段落
- [docs/raw/xxx.md]：章节

## 7. 相关词条
[[关联概念1]] [[关联概念2]]
```

---

## 文件命名

- **wiki 词条**：`概念全称.md`，如 `Transformer.md`、`LLM RAG.md`
- **raw 素材**：`年份-来源-标题.md`，如 `2025-karpathy-llm-wiki-gist.md`
- **会话归档**：`YYYY-MM-DD-chat-主题.md`，如 `2026-07-03-chat-rag-architecture.md`

---

## 常见问题

**Q: 框架更新了怎么办？**  
框架仓库和内容仓库是独立的。`git pull` 框架仓库即可升级 Skills 和规范，内容仓库不受影响。

**Q: 可以多人协作吗？**  
可以。将 `docs/` 关联到共享的远程仓库，团队成员各自克隆框架 + 拉取共享内容。

**Q: wiki 词条会被 AI 乱改吗？**  
所有修改记录在 `docs/wiki/operation-log.md`，可通过 `docs log` 查看 git 历史，随时回滚。
