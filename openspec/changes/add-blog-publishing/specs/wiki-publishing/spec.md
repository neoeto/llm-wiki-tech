## ADDED Requirements

### Requirement: 主题聚类提议

publish skill SHALL 基于 Phase 0 代码预处理提取的结构化 index card（标题+基础定义摘要+内链+分类，每条 ~50 tokens），按主题相关性提出候选博文聚类，并在生成任何博文前交由用户确认。聚类信号 MUST 综合三类：(1) `docs/wiki/index.md` 分类目录、(2) `[[概念名]]` 双向内链图（互相链接的词条相关）、(3) 语义相似度（基于 index card 的标题与摘要）。每个候选聚类 MUST 附理由说明为何这些词条适合合成一篇。**MUST NOT 在聚类阶段读取 wiki 全文**--全文仅在 Phase 3 对用户确认的聚类成员（2-5 篇）才读取。

#### Scenario: AI 提出候选聚类
- **WHEN** 用户调用 publish 且无未确认的候选聚类
- **THEN** skill 执行 Phase 0 bash 命令提取 index card，基于此轻量数据输出候选主题列表，每条含：拟定标题、成员词条清单、合成理由、提议英文 slug
- **AND** 不生成任何博文文件，等待用户选择确认

#### Scenario: 聚类覆盖已发布博文
- **WHEN** 某候选聚类的成员词条已被现有博文 `derivedFrom` 引用
- **THEN** skill MUST 标注该候选为"更新现有博文"而非"新建"，并指明对应博文文件名

#### Scenario: 无可写主题
- **WHEN** 扫描后发现所有词条均已被博文覆盖且无新增
- **THEN** skill 报告"无可写新主题"，转而执行过期检测流程

### Requirement: Phase 0 代码预处理（零 LLM Token）

publish skill SHALL 在聚类前执行代码预处理，用 bash 命令提取全部 wiki 词条的结构化 index card（文件名、标题、基础定义摘要 ≤200 字、`[[内链]]` 列表），并从已有博文 frontmatter 提取已覆盖词条列表。预处理 MUST NOT 调用 LLM 或消耗 token。输出为一张结构化表格（每条词条一行），直接供 Phase 1 聚类使用。

#### Scenario: Index card 提取
- **WHEN** publish 执行 Phase 0
- **THEN** bash 命令遍历 `docs/wiki/*.md`（排除 index.md、operation-log.md），为每条词条提取标题、`## 1. 基础定义` 段落摘要、全部 `[[内链]]`，输出为 markdown 表格

#### Scenario: 博文覆盖检测
- **WHEN** publish 执行 Phase 0
- **THEN** bash 命令从 `blog/src/content/posts/*.md` 提取全部 `[[...]]` 模式（derivedFrom 值），与 wiki 词条列表比对，标记已覆盖 vs 未覆盖

#### Scenario: Token 效率
- **WHEN** wiki 含 N 条词条
- **THEN** Phase 0 输出约 N×50 tokens 的 index card 数据，而非 N×1300 tokens 的全文

### Requirement: 用户确认门控

publish skill MUST 在生成博文前获得用户对聚类的明确确认。MUST NOT 自主决定生成未经确认的博文。

#### Scenario: 用户确认部分聚类
- **WHEN** 用户从候选列表中选择部分聚类确认生成
- **THEN** skill 仅对已确认的聚类执行博文生成，其余丢弃

#### Scenario: 用户拒绝全部聚类
- **WHEN** 用户拒绝所有候选聚类
- **THEN** skill 不生成任何博文，结束本次执行

### Requirement: 叙事博文编织

对已确认的聚类，publish skill SHALL 将多个 wiki 词条编织为一篇叙事博文。博文 MUST 采用叙事弧结构（钩子 -> 问题 -> 探索 -> 综合 -> 回顾），MUST NOT 机械拼接或照搬 wiki 7 段模板。博文 SHOULD 展示跨词条的综合洞察，而非单词条的复述。

#### Scenario: 多词条合成叙事
- **WHEN** 确认的聚类包含多个 wiki 词条
- **THEN** 生成的博文以连贯叙事整合这些词条的核心内容，呈现跨词条综合观点，而非分段罗列各词条

#### Scenario: 单词条聚类
- **WHEN** 确认的聚类仅含一个词条
- **THEN** 生成的博文仍须重写为叙事弧结构，不可照搬词条 7 段模板

### Requirement: wiki 约定转译

publish skill MUST 按以下规则将 wiki 专有约定转译为博客可读内容：

| wiki 元素 | 转译规则 |
|---|---|
| `[[概念名]]` 内链 | 源词条已发布为博文 -> 真实博文链接；未发布 -> 散文化提及 |
| `[docs/raw/xxx:章节]` 溯源 | 丢弃 |
| `【信息冲突】` 标记 | 在叙事中化解为"业界仍有争议"叙述，或保留为讨论 |
| 7 段刚性模板 | 重排为叙事弧 |
| `operation-log.md` / `index.md` | 排除，不作为博文来源 |
| ASCII 图表 / 代码块 / 表格 | 保留 |

#### Scenario: 内链转译为真实链接
- **WHEN** 博文正文中出现 `[[概念名]]` 且该概念已有对应已发布博文
- **THEN** 转译为指向该博文的相对链接

#### Scenario: 内链转译为散文
- **WHEN** 博文正文中出现 `[[概念名]]` 且该概念无对应已发布博文
- **THEN** 转译为自然散文提及，不留 wiki 语法残痕

#### Scenario: raw 溯源丢弃
- **WHEN** wiki 原文含 `[docs/raw/xxx.md:章节]` 溯源标注
- **THEN** 博文中不出现任何 raw 文件路径或内部结构信息

#### Scenario: 信息冲突化解
- **WHEN** wiki 词条含 `【信息冲突】` 标记
- **THEN** 博文以叙事方式呈现争议，不暴露内部策展标记符号

### Requirement: frontmatter 生成

每篇生成的博文 MUST 含完整 frontmatter，分为两类字段：

**Astro 社区共识字段**（与 Astro 工具链兼容）：
- `title`（必填，≤60 字符）
- `description`（必填，≤160 字符，SEO 元描述 + 列表页摘要来源）
- `pubDatetime`（必填，ISO 日期）
- `tags`（default `[]`）
- `draft`（boolean，default `false`；`true` 时构建排除）
- `modDatetime`（optional，内容更新信号）
- `author`（default 全局 SITE.author）

**本项目同步骨架字段**（自定义，Astro 工具不感知但无害）：
- `slug`（英文 slug，URL 友好）
- `derivedFrom`（源 wiki 词条名列表，同步事实源）
- `lastSynced`（生成日期，过期检测基准）

publish MUST 产出上述全部字段。`description` 由 publish 在编织钩子段时顺手生成，MUST NOT 留空。`draft` 默认 `false`。

#### Scenario: 完整 frontmatter
- **WHEN** 生成新博文
- **THEN** 文件头部含全部 10 个字段（7 标准 + 3 同步骨架），`derivedFrom` 列出该博文引用的所有 wiki 词条名，`lastSynced` 为当日日期，`description` 非空且 ≤160 字符

#### Scenario: description 摘要生成
- **WHEN** 生成新博文
- **THEN** `description` 为博文内容的精炼摘要（≤160 字符），用于 SEO 元描述与列表页预览，MUST NOT 照搬首段原文

#### Scenario: slug 提议
- **WHEN** 生成新博文
- **THEN** AI 提议英文 slug（URL 友好），用户可在确认时修改

### Requirement: 同步清单维护

publish skill MUST 在生成或更新博文后原子更新 `blog/manifest.md`。manifest 是 frontmatter `derivedFrom` + `lastSynced` 的可读投影，frontmatter 是唯一事实源。更新顺序 MUST 为：先写博文文件（含 frontmatter），再更新 manifest。

#### Scenario: 新博文追加到 manifest
- **WHEN** 生成新博文成功
- **THEN** manifest.md 表格追加一行：博文文件名、源词条、生成日期、draft 状态

#### Scenario: 更新博文同步 manifest
- **WHEN** 已有博文被重新生成
- **THEN** manifest 对应行的"上次生成"与"draft"字段更新

### Requirement: 过期检测

当用户调用 publish 并选择"检测过期"时，publish skill SHALL 比对每篇博文 frontmatter 的 `lastSynced` 与其 `derivedFrom` 源 wiki 词条的修改时间，列出所有源词条较新的过期博文。检测 MUST 是只读操作，不自动重生成。

#### Scenario: 检测出过期博文
- **WHEN** 博文 A 的 `derivedFrom` 含词条 X，且词条 X 的修改时间晚于博文 A 的 `lastSynced`
- **THEN** skill 列出博文 A 为过期，标注过期源词条 X

#### Scenario: 无过期博文
- **WHEN** 所有博文的源词条修改时间均不晚于对应 `lastSynced`
- **THEN** skill 报告"无过期博文"

### Requirement: 增量重生成

publish skill SHALL 在过期检测后，对用户确认的过期博文执行重生成。重生成 MUST 基于当前 wiki 词条内容重新编织叙事，更新 frontmatter `lastSynced` 与 manifest。重生成前 MUST 告知用户该博文影响的源词条范围。

#### Scenario: 用户确认重生成
- **WHEN** 过期检测列出过期博文且用户确认重生成其中若干篇
- **THEN** skill 对确认的博文逐篇重新编织，更新 frontmatter `lastSynced` 为当日，并同步更新 manifest

#### Scenario: 源词条已删除
- **WHEN** 博文的某源 wiki 词条已被删除（文件不存在）
- **THEN** skill 报告该源词条缺失，询问用户是否移除该 derivedFrom 项或保留待补

### Requirement: 博文文件命名

博文文件名 MUST 使用英文 slug（如 `production-agent-harness.md`），URL 友好，区别于 wiki 的中文概念名。slug 在生成时由 AI 提议、用户可修改。

#### Scenario: 英文 slug 命名
- **WHEN** 生成新博文
- **THEN** 文件名为英文 slug + `.md` 后缀，不含中文或空格

### Requirement: 草稿与发布状态

博文 frontmatter `draft` 字段（boolean）控制可见性，采用 Astro 社区标准。`draft: true` 的博文 MUST NOT 出现在最终构建的静态站点中（由 blog skill 的构建排除，含 RSS、sitemap、搜索索引）。`draft: false` 的博文正常发布。

#### Scenario: 草稿不发布
- **WHEN** 博文 frontmatter `draft: true`
- **THEN** blog skill 构建时排除该博文，不出现在 `dist/` 站点、RSS feed、sitemap、搜索索引

#### Scenario: 草稿转发布
- **WHEN** 用户将博文 `draft` 从 `true` 改为 `false`
- **THEN** 下次 blog build 后该博文出现在站点、RSS、sitemap 与搜索索引
