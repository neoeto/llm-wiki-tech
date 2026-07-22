---
name: publish
version: 1.0.0
description: "AI transforms wiki entries into narrative blog markdown through thematic weaving. Use when user says 'publish', '发布', '博客', '编织博文', '生成博文', '写博客', '发布文章', or wants to generate blog posts from wiki knowledge. Also triggers on detecting that docs/wiki/ has new/updated entries not yet reflected in blog/. NOTE: 触发后默认以 docs/wiki/ 为内容来源（非 docs/raw/）。"
---

# Publish（wiki → 博客发布）

**严格遵循项目根目录 `agent-spec.md` 全部规则。**

将 `docs/wiki/` 下已策展的结构化词条，通过主题聚类与叙事编织，转化为面向公众的技术博客文章（`blog/src/content/posts/*.md`）。这是从 wiki 知识体到对外发布内容的出口，与 `ingest`（raw → wiki）形成对称。

**核心区别**：`ingest` 是做"提取 + 模板化"；`publish` 是做"聚类 + 编织 + 叙事化"——前者追求覆盖与溯源，后者追求洞察与可读。

## 先决条件

**CRITICAL - 开始前 MUST 先完成以下准备：**

1. **读取 `agent-spec.md`** - 核心原则、工作流规则、框架/内容分离约束
2. **读取 `docs/wiki/index.md`** - 全局分类目录，了解现有分类框架（聚类种子信号）
3. **读取 `blog/manifest.md`**（若存在） - 同步清单，了解已有博文与源词条的映射关系
4. **执行 Phase 0 代码预处理** - 用 bash 命令提取全部 wiki 词条的轻量 index card（标题、基础定义、内链、分类），**无需逐篇读取全文**。详见 Phase 0
5. **扫描已有博文 frontmatter** - 仅读取 `blog/src/content/posts/*.md` 的 frontmatter（`derivedFrom`、`lastSynced`、`draft`），不读正文，用于判断哪些词条已被覆盖

> **Token 优化原则**：先决条件阶段不读取 wiki 全文。全文仅在 Phase 3 对用户确认的聚类（2-5 篇词条）才读取。Phase 0 用代码提取结构化 index card（每条 ~50 tokens），Phase 1 基于此轻量数据聚类。

## 核心流程

```
用户调用 publish
       │
       ▼
┌─────────────────────────────────────────────────┐
│ Phase 0: 代码预处理（零 LLM Token）             │
│ - bash 提取 index card（标题+摘要+内链+分类）  │
│ - 构建 [[内链]] 邻接矩阵 + 覆盖状态            │
│ - 输出 N×50 tokens 结构化表格                    │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│ Phase 1: 主题聚类（基于 index card）            │
│ - 综合 index.md 分类 + 内链图 + 语义相似度     │
│ - 输出候选聚类（主题标题、成员词条、合成理由、        │
│   英文 slug），标注"新建"vs"更新已有博文"           │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│ Phase 2: 用户确认门控                             │
│ - MUST 等待用户选择确认的聚类                     │
│ - MUST NOT 自主生成未经确认的博文                  │
│ - 用户可确认子集、拒绝全部、修改 slug              │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│ Phase 3: 叙事编织                                 │
│ - 对已确认的聚类，将多篇词条编织为叙事博文          │
│ - 叙事弧：钩子 → 问题 → 探索 → 综合 → 回顾          │
│ - 按转译规则表处理 wiki 专有约定                   │
│ - 生成完整 9 字段 frontmatter                    │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│ Phase 4: 同步清单维护                             │
│ - 先写博文文件（含 frontmatter）                   │
│ - 再原子更新 blog/manifest.md                │
│ - 输出变更汇总清单                                │
└─────────────────────────────────────────────────┘
```

---
## Phase 0 - 代码预处理（零 LLM Token）

**核心目标**：用 bash 命令提取全部 wiki 词条的结构化 index card，供 Phase 1 聚类使用。**不调用 LLM、不消耗 token**。

### 0.1 提取 Index Card

执行以下 bash 命令，为每篇 wiki 词条生成一行结构化摘要：

```bash
for f in docs/wiki/*.md; do
  name=$(basename "$f" .md)
  [[ "$name" == "index" || "$name" == "operation-log" ]] && continue
  title=$(head -1 "$f" | sed 's/^# //')
  # 提取「## 1. 基础定义」段落的文本（到下一个 ## 为止）
  summary=$(awk '/^## 1\./{p=1;next} /^## /{p=0} p' "$f" | tr '\n' ' ' | sed 's/  */ /g' | cut -c1-200)
  # 提取全部 [[内链]]
  links=$(grep -o '\[\[[^]]*\]\]' "$f" | sort -u | tr '\n' ' ')
  echo "| $name | $title | $summary | $links |"
done
```

输出格式（markdown 表格，每条词条一行）：

```
| 文件名 | 标题 | 基础定义摘要(≤200字) | 内链列表 |
|--------|------|----------------------|---------|
| Harness Engineering | Harness Engineering | AI Agent 驭手工程：控制面+运行时基础设施... | [[上下文窗口管理]] [[Agent 框架对比]] |
| 上下文窗口管理 | 上下文窗口管理 | Harness 核心模块，决策每次推理时窗口放什么... | [[Harness Engineering]] |
```

### 0.2 提取已有博文覆盖（增量模式）

执行以下 bash 命令，找出哪些 wiki 词条已被博文覆盖：

```bash
# 从已有博文提取 derivedFrom 引用的词条（跨行 YAML 值，-o 提取 [[...]] 模式）
grep -rho '\[\[[^]]*\]\]' blog/src/content/posts/*.md 2>/dev/null | sort -u
```

将输出与 Phase 0.1 的词条列表比对：
- **已覆盖**：出现在 derivedFrom 中的词条 -> 标记为「可能需更新」
- **未覆盖**：未出现在任何 derivedFrom 中的词条 -> 标记为「新主题候选」

### 0.3 解析内链邻接矩阵

从 Phase 0.1 的内链列构建双向内链图：
- A 引用 B 且 B 引用 A = **强关联**（聚类优先信号）
- A 引用 B 但 B 不引用 A = **单向关联**（弱信号）
- 无内链的词条 = 孤立节点（仅按 index.md 分类 + 语义聚类）

### 0.4 输出产物

Phase 0 的输出是一张**结构化表格 + 邻接矩阵 + 覆盖状态**，总计约 N×50 tokens（N=词条数）。此数据直接喂给 Phase 1 的 LLM 聚类，**无需读取任何 wiki 全文**。

> **Token 对比**：50 条词条时，Phase 0 输出 ~2.5K tokens（仅 index card），vs 旧方案 ~65K tokens（全文）。节省 96%。

---

## Phase 1 — 主题聚类

### 操作规范

1. **基于 Phase 0 index card 聚类** - 不读取 wiki 全文，仅使用 Phase 0 提取的结构化表格（文件名、标题、基础定义摘要、内链列表）+ 邻接矩阵 + 覆盖状态
2. **综合三类聚类信号**，加权计算主题相关性：

| 信号 | 权重 | 说明 |
|------|------|------|
| **index.md 分类归属** | 高 | 同一分类下的词条自带主题关联——如「# 模型架构」下的 `Transformer.md`、`MoE.md`、`Sparse Attention.md` |
| **`[[概念名]]` 双向内链图** | 高 | 互相链接的词条在概念上紧密相关（A 引用 B，B 也引用 A = 强关联） |
| **语义相似度** | 中 | 基于标题与内容向量/关键词，发现分类体系未捕捉到的横切主题——如 `上下文窗口管理` 与 `Harness Engineering` 虽在不同分类下，但内容高度相关 |

3. **聚类粒度约束**：
   - 每个候选聚类含 **2~5 个** wiki 词条（少于 2 个难以编织叙事弧；多于 5 个叙事发散、增量维护成本高）
   - 同一词条**可出现在多个候选聚类中**（一个概念可以参与多篇不同角度的博文），但最终用户需确认去重
   - 若某个词条仅与自身相关（无合适聚类伙伴），仍可提议为单词条聚类（须重写为叙事弧，不可照搬模板）

4. **标注聚类类型**：

   比对每个候选聚类的成员词条与已有博文 `derivedFrom` 字段：
   - 若所有成员词条均未被任何博文覆盖 → 标记「**新建**」
   - 若部分/全部成员词条已被某博文 `derivedFrom` 引用 → 标记「**更新现有博文**：`xxx.md`（新增 Y 个源词条 / 全部源词条已覆盖但可能过时）」
   - 若扫描后所有词条均已被博文覆盖且无新增 → 报告"无可写新主题"，转入过期检测流程

### 输出产物

以结构化清单输出候选聚类：

```markdown
## 候选博文聚类

### 候选 1【新建】
- **标题**：生产级 Agent 的驭手工程
- **英文 slug**：production-agent-harness（可修改）
- **成员词条**：
  - [[Harness Engineering]] — 核心框架与设计理念
  - [[上下文窗口管理]] — 具体技术维度
  - [[Agent 编排模式]] — 工程实践视角
- **合成理由**：这三个词条从框架设计、核心技术、工程实践三个维度覆盖"如何驾驭 Agent 行为"——内链图上 [[Harness Engineering]] ↔ [[上下文窗口管理]] 强双向关联，[[Agent 编排模式]] 补充落地视角。

### 候选 2【更新现有博文】
- **博文**：`blog/src/content/posts/transformer-evolution.md`
- **成员词条（新增）**：[[Sparse Attention]]（原博文 `derivedFrom` 仅含 [[Transformer]]）
- **合成理由**：Sparse Attention 是 Transformer 架构的重要演进方向，与已有博文主题高度互补。

### 候选 3【新建】
- **标题**：RAG 检索增强生成实战
- **英文 slug**：rag-retrieval-augmented-generation（可修改）
- **成员词条**：
  - [[LLM RAG]]
  - [[向量数据库选型]]
  - [[Embedding 模型对比]]
- **合成理由**：从基础概念到基础设施到模型选择的三层覆盖，index.md 中同属「# 检索增强生成」分类。
```

---

## Phase 2 — 用户确认门控

### 操作规范

1. **MUST 暂停执行**，等待用户对候选聚类做出选择
2. **MUST NOT 自主决定**生成任何博文——这是强制门控，不可逾越
3. **提供清晰的操作选项**：

   ```
   请选择要生成的聚类（可多选）：
   ① 候选 1「生产级 Agent 的驭手工程」【新建】
   ② 候选 2「transformer-evolution.md」【更新】
   ③ 候选 3「RAG 检索增强生成实战」【新建】
   ④ 全部生成
   ⑤ 都不生成（结束本次执行）
   ⑥ 修改某候选的 slug 后再确认
   
   输入编号选择，例如：①③
   ```

4. **支持修改**：用户可在确认时修改候选的英文 slug、标题措辞
5. **处理拒绝**：若用户拒绝全部聚类（选⑤），不生成任何文件，干净结束本次执行

### 输出产物

用户的选择清单（明确哪些聚类将被生成，哪些被丢弃）。

---

## Phase 3 — 叙事编织

### 3.1 叙事弧结构

**此时才读取 wiki 全文**：对确认聚类中的 2-5 篇成员词条，逐篇读取完整内容用于叙事编织。Phase 0-1 未读全文，此处按需读取。

对每个确认的聚类，将成员词条的知识编织为**一篇连贯叙事博文**。博文 MUST 遵循以下叙事弧：

```
┌──────────────────────────────────────────────────┐
│ 钩子（Hook）                                       │
│ 用一个具体问题、场景或共鸣痛点开场——让读者产生         │
│ "这说的就是我！"的感觉。技术博客钩子可以是：            │
│ 「你花 3 小时调 prompt，不如花 30 分钟搭 harness。」    │
│ 「每个做 RAG 的人，最后都会自己写一个 chunker。」       │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 问题（Problem）                                    │
│ 展开钩子背后的技术问题——是什么让这个事这么难？         │
│ 缺乏哪些基础设施？现有方案为什么不够？                 │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 探索（Exploration）                                │
│ 逐层展开各 wiki 词条的核心见解——这是博文的主体。       │
│ 不是分节罗列词条，而是用自然叙事串联：                 │
│ 「首先我们需要解决 X…」→ 引入词条 A 的见解             │
│ 「但光有 X 还不够，因为 Y…」→ 过渡到词条 B            │
│ 跨词条的综合观点是这里的价值增量                      │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 综合（Synthesis）                                  │
│ 将探索阶段的分散见解收束为一个整体图景——              │
│ 「回头看这 N 个维度，它们共同指向一个核心原则…」       │
│ 这是读者带走的关键洞察                               │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 回顾（Review）                                     │
│ 简短总结 + 展望/开放问题/实践建议                     │
│ 给读者一个自然的收尾和可能的下一步行动                 │
└──────────────────────────────────────────────────┘
```

**关键原则**：
- **MUST NOT** 机械拼接或照搬 wiki 7 段模板（百科 ≠ 博客）
- **MUST NOT** 分节罗列各词条——叙事必须是连贯的
- **SHOULD** 展示跨词条的综合洞察（这是 AI 价值的核心）
- **单词条聚类**也必须重写为叙事弧，不可照搬 7 段模板
- **第一人称 / 第二人称**自然使用，保持博客的对话感

### 3.2 wiki → 博客转译规则

博文正文生成时，遇到以下 wiki 专有元素 MUST 按规则转译：

| wiki 元素 | 博客处理 | 理由 |
|-----------|---------|------|
| `[[概念名]]` 内链 | 源词条已发布为博文 → 转为该博文的相对链接（如 `/blog/production-agent-harness/`）；未发布 → 转为自然散文提及（如"关于 Harness Engineering，我们曾在另一篇文章中讨论过…"） | 死链破坏阅读体验；散文提及保留知识关联 |
| `[docs/raw/xxx:章节]` 溯源 | **丢弃**——不出现任何 raw 文件路径、章节名、页码 | 泄露内部文件结构；公开发布不适宜 |
| `【信息冲突】` 标记 | 在叙事中化解为"业界对此仍有争议"叙述，或保留为开放式讨论（如"关于 X，有两种主流观点…"）；**不暴露** `【信息冲突】` 这个内部标记符号 | 内部策展噪音；读者不需要看到标注元信息 |
| 7 段刚性模板 | **重排**为叙事弧（钩子→问题→探索→综合→回顾） | 百科词条结构不适合博客阅读 |
| `operation-log.md` / `index.md` | **排除**——绝不作为博文来源 | 非文章内容，是系统元文件 |
| ASCII 图表 | **优先转为 Mermaid**（` ```mermaid ` 代码块），无法用 Mermaid 表达时保留原 ASCII | Mermaid 构建时自动渲染为 SVG，比 ASCII 更清晰；无法转换则保留原文 |
| 代码块 / 表格 | **保留** | 技术内容载体，直接复用 |
| 内链到被排除页 | 转为散文提及或删除 | 避免生成指向 `operation-log`、`index` 的死链 |

### 3.3 内链转译细则

**场景 A：源词条已有对应的已发布博文**
```
wiki 原文：「详细设计见 [[Harness Engineering]]」
博文转译：「详细设计见《生产级 Agent 的驭手工程》」（含相对链接 `/blog/production-agent-harness/`）
```
通过查询 manifest.md 或已有博文的 `derivedFrom` 字段确定映射关系。

**场景 B：源词条无对应博文**
```
wiki 原文：「其核心思想借鉴了 [[上下文窗口管理]]」
博文转译：「其核心思想借鉴了上下文窗口管理的理念——即在有限注意力预算下，选择性保留关键信息。」
```
自然融入叙述，不留下 `[[ ]]` 语法残痕。

**场景 C：源词条是被排除页（index.md、operation-log.md）**
直接删除该内链引用，不做转译。

### 3.4 信息冲突化解

```
wiki 原文：
> 【信息冲突】
> docs/raw/A.md 第3节指出：Transformer 的 O(n²) 复杂度可通过稀疏注意缓解到 O(n√n)
> docs/raw/B.md 第5节指出：实际工程中稀疏注意的常数因子可能抵消理论优势

博文转译：
「关于稀疏注意力的效率，业界存在一个有趣的争论：
理论上它能将复杂度从 O(n²) 降到 O(n√n)，但工程实践者指出
常数因子可能抵消理论优势——这意味着选型时不能只看大 O。」
```

---

## Phase 4 — 同步清单维护

### 4.1 博文 frontmatter 生成

每篇博文 MUST 含完整 9 字段 frontmatter。生成规范如下：

#### Astro 社区共识字段（与 Astro 工具链兼容）

| 字段 | 要求 | 生成规则 |
|------|------|---------|
| `title` | 必填，≤60 字符 | 使用 Phase 2 用户确认的标题；确保在 60 字符内 |
| `description` | 必填，≤160 字符 | **由 AI 在编织钩子段时顺手生成**——提取博文核心洞察，精炼为一句话。用于 SEO 元描述与列表页摘要。MUST NOT 照搬首段原文。MUST NOT 留空 |
| `pubDatetime` | 必填，ISO 日期（`YYYY-MM-DD`） | 生成当日日期。若用户指定发布日期，使用指定日期 |
| `tags` | 数组，default `[]` | 从源词条的 index.md 分类名 + 词条内高频术语中提取。建议 3~6 个。使用英文小写（如 `agent`、`rag`、`transformer`）。技术博客标签应精确 |
| `draft` | boolean，default `false` | 默认 `false`（生成即发布）。用户可在后续手动改为 `true` 延迟发布 |
| `modDatetime` | optional，ISO 日期 | 新建博文时不填（与 `pubDatetime` 相同）；重生成时填当前日期 |
| `author` | optional，default 全局 `SITE.author` | 不填时由 Astro 站点配置的全局默认作者填充。若用户指定过，填入指定值 |

#### 本项目同步骨架字段（自定义，Astro 工具不感知）

| 字段 | 要求 | 生成规则 |
|------|------|---------|
| _(无 slug 字段)_ | 文件名即 slug | AstroPaper 约定：文件名 = URL slug。Phase 1 提议英文 slug 作为**文件名**，不写入 frontmatter |
| `derivedFrom` | 源 wiki 词条名列表 | 列出该博文引用的全部 wiki 词条名（`[[概念名]]` 格式）。**这是同步的事实源**——过期检测依此比对 |
| `lastSynced` | ISO 日期 | 生成当日日期。**过期检测基准**——比对此日期与源词条修改时间判断是否过期 |

**frontmatter 示例**：

```yaml
---
title: "生产级 Agent 的驭手工程"
description: "Harness 是 LLM 应用的控制面——它将 prompt、上下文窗口、工具调用统一编排，让 Agent 从'能跑'到'可控'。本文从框架设计、上下文管理、编排模式三个维度拆解。"
pubDatetime: 2026-07-17
tags: [agent, harness, context-engineering, orchestration]
draft: false
author: "Neo"
slug: production-agent-harness
derivedFrom:
  - "[[Harness Engineering]]"
  - "[[上下文窗口管理]]"
  - "[[Agent 编排模式]]"
lastSynced: 2026-07-17
---
```

### 4.2 写入博文文件

**双写原子性**：先写博文文件，再更新 manifest.md。这个顺序保证 frontmatter 总是先于 manifest 落盘。

1. **文件命名**：使用确认的英文 slug + `.md` 后缀。如 `production-agent-harness.md`
2. **写入路径**：`blog/src/content/posts/{slug}.md`
3. **文件内容**：完整 frontmatter + 空行 + 叙事博文正文

### 4.3 更新 blog/manifest.md

manifest 是 frontmatter 的**可读投影**，非独立事实源。**frontmatter 为事实源**。

**若 `blog/manifest.md` 尚不存在**，创建之：

```markdown
# Blog 同步清单

| 博文 | 源 wiki 词条 | 上次生成 | draft |
|------|-------------|---------|-------|
| production-agent-harness.md | [[Harness Engineering]] [[上下文窗口管理]] [[Agent 编排模式]] | 2026-07-17 | false |
```

**若已存在**，追加/更新对应行：

| 操作 | manifest 更新方式 |
|------|------------------|
| 新建博文 | 表格末尾追加一行 |
| 重生成已有博文 | 更新该行的"上次生成"与"draft"字段；若 `derivedFrom` 有变化，同步更新"源 wiki 词条"列 |

**manifest 表格格式**：

| 列 | 内容 |
|----|------|
| 博文 | 文件名（slug.md），如 `production-agent-harness.md` |
| 源 wiki 词条 | 空格分隔的 `[[概念名]]`，如 `[[Harness Engineering]] [[上下文窗口管理]]` |
| 上次生成 | `YYYY-MM-DD` |
| draft | `true` / `false` |

### 4.4 输出变更汇总

在完成所有操作后，以结构化清单输出所有变更：

````markdown
## Publish 执行报告

### 生成博文（{{N}} 篇）
每条格式：
- `blog/src/content/posts/xxx.md`：源自 {{词条A}}、{{词条B}} → 主题"{{标题}}"

### 更新博文（{{N}} 篇）
每条格式：
- `blog/src/content/posts/xxx.md`：新增源词条 {{词条C}}，更新 lastSynced → {{日期}}

### 同步清单
- `blog/manifest.md`：{{新增 N 行 / 更新 N 行}}
````

---

## 过期检测

当用户调用 publish 并选择"检测过期"（或在聚类阶段发现"无可写新主题"后自动转入），执行以下只读检测：

### 操作规范

1. **遍历** `blog/src/content/posts/` 下所有博文
2. **提取**每篇博文 frontmatter 的 `derivedFrom` 与 `lastSynced`
3. **比对**每个源 wiki 词条（`docs/wiki/概念名.md`）的文件修改时间（mtime）
4. **判定规则**：若任一源词条的 mtime > 博文 `lastSynced` → 该博文标记为**过期**

### 输出产物

```markdown
## 过期检测结果

### 过期博文（{{N}} 篇）

| 博文 | 过期源词条 | 上次生成 | 词条更新时间 |
|------|-----------|---------|------------|
| production-agent-harness.md | [[上下文窗口管理]] | 2026-07-10 | 2026-07-15 |
| rag-best-practices.md | [[LLM RAG]] [[Embedding 模型对比]] | 2026-07-01 | 2026-07-12 |

### 无过期（{{N}} 篇）
- transformer-evolution.md
- ...

---

是否重新生成以上过期博文？
① 全部重新生成
② 选择部分（输入编号）
③ 暂不处理
```

### 特殊处理

**源词条已被删除**（文件不存在）：
```
⚠️ 博文 xxx.md 的源词条 [[已删除词条]] 在 docs/wiki/ 中不存在。
该词条可能已被删除或重命名。

选项：
① 从 derivedFrom 中移除该词条（博文保留，更新 frontmatter + manifest）
② 保留该引用，等待词条恢复
③ 删除该博文
```

> 反例自检：过期检测 MUST 是只读操作——不自动重生成、不修改任何文件。用户明确确认后再进入重生成流程。

---

## 增量重生成

用户在过期检测后确认需要重生成的博文，执行重编织。

### 操作规范

1. **逐篇处理**用户确认的过期博文
2. **重新读取**该博文 `derivedFrom` 中所有源 wiki 词条的**当前内容**
3. **保留原有叙事结构**（标题、slug 不变），基于最新词条内容**重写正文**——而非仅修补局部变动
4. **更新 frontmatter**：
   - `lastSynced` → 当前日期
   - `modDatetime` → 当前日期
   - `description` → 如正文有实质性变化，重新生成摘要
   - `derivedFrom` → 若用户选择移除已删除词条，同步更新
5. **更新 manifest.md**：同步更新对应行的"上次生成"列与"源 wiki 词条"列
6. **输出重生成摘要**：
   ```
   ✓ 已重新生成 production-agent-harness.md
     更新内容：[[上下文窗口管理]] 词条新增"窗口驱逐策略"章节
     lastSynced：2026-07-17
     manifest 已同步
   ```

### 重生成前的告知

重生成前 MUST 告知用户影响范围：

```
⚠️ 重生成 production-agent-harness.md 将覆盖当前博文正文。
该博文引用 3 个源词条，其中 1 个（[[上下文窗口管理]]）有更新。

重生成后：
- 正文将基于当前词条内容重新编织
- frontmatter 的 lastSynced 将更新为今日
- 您对博文正文的任何手动编辑将丢失

是否继续？① 确认重生成 ② 取消
```

---

## 强制规则（Violation = 不合格输出）

| 规则 | 说明 |
|------|------|
| **raw 不可发布** | `docs/raw/` 是他人素材，不可作为博客来源。博客仅能从 `docs/wiki/` 派生 |
| **frontmatter 为事实源** | `derivedFrom` 和 `lastSynced` 以博文 frontmatter 为准；`manifest.md` 是可读投影，漂移时以 frontmatter 为准 |
| **双写原子性** | MUST 先写博文文件（含完整 frontmatter），再更新 manifest.md。禁止逆序 |
| **英文 slug** | 博文文件名 MUST 为英文 slug（URL 友好），不含中文/空格/特殊字符。AI 提议，用户可改 |
| **draft 不发布** | `draft: true` 的博文 MUST NOT 出现在构建产物中（blog build 自动排除） |
| **门控不可逾越** | 用户未确认候选聚类前 MUST NOT 生成任何博文。这是强制人机协作节点 |
| **叙事弧必用** | 所有博文（含单词条聚类）MUST 重写为叙事弧，不可照搬 wiki 7 段模板 |
| **转译规则全覆盖** | `[[内链]]`、raw 溯源、冲突标记 MUST 按转译规则表处理，不可遗漏 |
| **description 不可为空** | 每篇博文 `description` MUST 由 AI 在编织时生成（≤160 字符），用于 SEO + 列表摘要 |
| **过期检测只读** | 过期检测 MUST NOT 修改任何文件——仅列出过期项，等用户确认后转入重生成 |
| **源词条变更告知** | 重生成前 MUST 告知用户哪些源词条有更新，以及重生成会覆盖博文正文的手动编辑 |

## 常见错误

### 1. 没读完现有 wiki 词条就开始聚类

→ 漏掉高价值关联、产生冗余聚类。Phase 1 前 MUST 遍历所有 wiki 页面。
症状：输出的候选聚类中遗漏了已有的内链强关联词条。

### 2. 未经用户确认就生成博文

→ 门控被跳过。产出用户不想要的文章。Phase 2 是强制等待节点，不可省略。

### 3. 照搬 wiki 7 段模板

→ 博文读起来像百科词条而非博客文章。MUST 按叙事弧重写。单词条聚类尤需警惕此错误。

### 4. 内链残留 wiki 语法

→ 博文中出现 `[[概念名]]` 标记，公开发布后显示为乱码。MUST 按转译规则全部处理。
症状检查：在生成的博文正文中 grep `[[` 不应有匹配（frontmatter 的 `derivedFrom` 除外）。

### 5. raw 溯源泄露

→ 博文正文中出现 `[docs/raw/xxx.md]` 路径，暴露内部文件结构。MUST 全部丢弃。

### 6. description 留空或超过 160 字符

→ SEO 元描述缺失或截断。description MUST 由 AI 在编织时顺手生成，≤160 字符。

### 7. manifest 与 frontmatter 漂移

→ 先更新 manifest 再写博文；或 manifest 写入时机在博文写入失败之后。必须遵循"先博文后 manifest"的原子顺序。

### 8. 使用 `status: published|draft` 而非 `draft: boolean`

→ 与 Astro 生态不兼容（RSS 过滤、sitemap、主题渲染均预期 `draft: boolean`）。MUST 使用 `draft: true/false`。

### 9. 过期检测后自动重生成

→ 过期检测是只读操作，重生成是写操作。两者 MUST 分离——检测后等待用户确认。

### 10. 重生成时覆盖了用户的手动编辑未告知

→ 博文正文可能被用户润色过。重生成前 MUST 告知覆盖风险，让用户确认。

---

## 与其他 Skill 的联动

```
ingest（raw → wiki 词条）
       │
       ▼
  wiki 词条更新（新增/修改）
       │
       ▼
  publish（本 skill）→ wiki → 博文 markdown
       │                     │
       │ 过期检测               ▼
       │ 增量重生成           blog build（blog skill）
       │                       │
       └── 源词条变更触发 ──────┘
       
---

  publish 生成博文
       │
       ▼
  blog init（blog skill）→ 初始化 Astro 项目
       │
       ▼
  blog serve → 预览 / blog build → 构建 + Pagefind 索引
       │
       ▼
  blog deploy → 发布到线上
```

```
docs/wiki/           → publish（AI 编织转译）  → blog/src/content/posts/*.md
blog/manifest.md ← publish（同步清单维护）
blog/src/       → blog（Astro CLI 包装）  → blog/dist/（静态 HTML）
```

## 目录结构约定（与 blog skill 联动视角）

```
llm-wiki/（框架仓库）
├── .agents/skills/
│   ├── publish/SKILL.md          # ★ 本 skill：AI 编织转译
│   └── blog/SKILL.md             # CLI 包装：Astro 构建/预览/部署
│
└── docs/（内容仓库）
    ├── wiki/                     # publish 的输入
    │   ├── Harness Engineering.md
    │   ├── 上下文窗口管理.md
    │   ├── LLM RAG.md
    │   ├── index.md              # 聚类信号源
    │   └── operation-log.md      # 排除（不作为博文来源）
    │
    └── blog/                     # publish 的输出 + blog 的工作目录
        ├── src/content/posts/
        │   └── *.md              # ★ 博文产物（publish 写入，blog 消费）
        └── manifest.md           # ★ 同步清单（publish 原子更新）
```
