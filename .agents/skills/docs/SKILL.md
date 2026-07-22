---
name: docs
version: 1.0.0
description: "Manage the docs/ content repository — init, clone, pull, push, status, remote, log. Use when user says 'docs管理', 'git docs', '推送wiki', '拉取wiki', 'wiki仓库', 'docs仓库', '推送docs', 'docs同步', '初始化docs', '关联仓库', 'clone wiki', or any git operation on the docs/ content directory."
---

# Docs（内容仓库管理）

管理 `docs/` 目录的 git 仓库。`docs/` 是 LLM Wiki 的内容产出物目录（包含 `docs/wiki/`、`docs/raw/`），独立于框架仓库进行版本管理。

## 前置信息

- **`docs/` 被框架 `.gitignore` 排除**：框架仓库不感知 `docs/` 的内容和 git 配置
- **`docs/` 是独立 git 仓库**：每个框架克隆实例可在 `docs/` 下关联不同的内容仓库
- **所有 git 操作必须在 `docs/` 目录内执行**

## 核心流程

```
用户发起 docs 操作
       │
       ▼
┌─────────────────────────────────────────────┐
│ Step 0: 检查 docs/ 是否已初始化为 git 仓库    │
│ - cd docs/ && git rev-parse --git-dir       │
│ - 若未初始化 → 仅允许 init / clone 操作       │
│ - 若已初始化 → 所有操作可用                   │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Step 1: 识别用户意图，路由到对应操作           │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Step 2: 在 docs/ 目录内执行 git 命令          │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ Step 3: 输出结果摘要                         │
└─────────────────────────────────────────────┘
```

## 操作命令

### 0. 检查状态

在任何操作前，先判断 `docs/` 的 git 状态：

```bash
git -C docs/ rev-parse --is-inside-work-tree 2>/dev/null
```

- 返回 `true` → `docs/` 已是 git 仓库，所有操作可用
- 返回空/错误 → `docs/` 未初始化，仅允许 `init` 或 `clone`

### 1. init — 初始化 docs/ 为独立 git 仓库

**触发词**：「初始化docs」「docs init」「新建wiki仓库」「git init docs」

```bash
cd docs/ && git init && git add -A && git commit -m "init: wiki content repository"
```

**操作步骤**：
1. `git init` 初始化仓库
2. `git add -A` 暂存所有现有内容（wiki/、raw/ 下的文件）
3. `git commit -m "init: wiki content repository"` 创建初始提交
4. 提示用户是否需要设置 remote

**输出**：
```
✓ docs/ 已初始化为独立 git 仓库
  初始提交：abc1234 "init: wiki content repository"
  包含文件：N 个

下一步：关联远程仓库 → docs remote <url>
       或直接推送        → 先设置 remote 再 push
```

### 2. clone — 克隆已有内容仓库到 docs/

**触发词**：「clone wiki」「克隆wiki仓库」「拉取wiki」「docs clone」

**前置条件**：`docs/` 下无 git 仓库（或用户确认覆盖）

```bash
# 备份现有内容（如有）
# 克隆目标仓库
git clone <repo-url> /tmp/docs-temp && rm -rf docs/.git && mv /tmp/docs-temp/.git docs/ && rm -rf /tmp/docs-temp && git -C docs/ checkout -- .
```

**操作步骤**：
1. 向用户确认远程仓库 URL
2. 若 `docs/` 已有内容，询问是否需要先备份
3. 克隆远程仓库，将其 `.git` 合并到 `docs/`
4. 恢复远程仓库的文件内容
5. 输出状态摘要

**输出**：
```
✓ 已从 <repo-url> 克隆内容仓库到 docs/
  最新提交：abc1234 "xxx"
  Remote：origin → <repo-url>

当前 docs/ 内容：
  docs/wiki/：N 个词条
  docs/raw/：N 个素材
```

### 3. remote — 管理远程仓库关联

**触发词**：「设置remote」「关联远程仓库」「docs remote」「查看remote地址」

#### 3.1 查看当前 remote

```bash
git -C docs/ remote -v
```

#### 3.2 设置 remote（首次关联）

```bash
git -C docs/ remote add origin <repo-url>
```

#### 3.3 修改 remote

```bash
git -C docs/ remote set-url origin <new-repo-url>
```

**输出示例**：
```
当前 docs/ 远程仓库：
  origin → git@github.com:user/my-wiki-content.git (fetch)
  origin → git@github.com:user/my-wiki-content.git (push)
```

### 4. pull — 拉取远程最新内容

**触发词**：「拉取docs」「docs pull」「同步wiki」「更新wiki内容」「pull docs」

```bash
git -C docs/ pull --rebase origin <branch>
```

**操作步骤**：
1. 检查当前是否有未提交的本地修改：
   ```bash
   git -C docs/ status --porcelain
   ```
2. 若有未提交修改，询问用户：
   - A) 先 commit 本地修改再 pull
   - B) stash 本地修改 → pull → stash pop
   - C) 放弃本地修改，强制拉取
   - D) 取消操作
3. 执行 pull
4. 输出拉取的更新摘要（新增/修改的文件列表）

**输出**：
```
✓ 已从 origin/main 拉取最新内容

更新摘要：
  Fast-forward abc1234..def5678

  新增文件（N）：
  + docs/wiki/新词条.md
  修改文件（N）：
  ~ docs/wiki/已有词条.md
```

### 5. push — 推送本地修改到远程

**触发词**：「推送docs」「docs push」「推送wiki」「上传wiki」「push docs」

```bash
git -C docs/ push origin <branch>
```

**操作步骤**：
1. 检查是否有未提交的修改：
   ```bash
   git -C docs/ status --porcelain
   ```
2. 若有未提交修改，询问用户是否先 commit
3. 若有 unpushed commits，展示待推送的提交列表：
   ```bash
   git -C docs/ log origin/<branch>..HEAD --oneline
   ```
4. 与用户确认后执行 push
5. 输出推送结果

**输出**：
```
✓ 已推送到 origin/main

推送提交（N）：
  abc1234 新增词条：Transformer.md
  def5678 更新词条：LLM RAG.md（补充对比信息）
  ghi9012 Lint 修复：孤立页面链接

远程地址：git@github.com:user/my-wiki-content.git
```

### 6. status — 查看 docs/ 工作区状态

**触发词**：「docs状态」「wiki状态」「查看docs」「docs status」「有什么改动」

```bash
git -C docs/ status
git -C docs/ status --short
```

**输出**：
```
docs/ 仓库状态

分支：main（与 origin/main 同步 / 领先 N 个提交 / 落后 N 个提交）

未暂存的修改：
  M docs/wiki/LLM RAG.md
  M docs/wiki/index.md

未跟踪的文件：
  ?? docs/raw/新素材.md

待推送提交：N 个
```

### 7. log — 查看提交历史

**触发词**：「docs日志」「wiki日志」「docs log」「查看提交历史」

```bash
git -C docs/ log --oneline -<N>
```

默认显示最近 10 条，用户可指定数量。

**输出**：
```
docs/ 最近 10 条提交：

abc1234 (HEAD -> main, origin/main) 新增词条：Transformer自注意力机制
def5678 Lint 修复：拆分超长页面，补全孤链
ghi9012 Ingest：处理 raw/2026-karpathy-llm-wiki.md
...
```

### 8. diff — 查看未提交的差异

**触发词**：「docs diff」「wiki改了什么」「查看docs修改」

```bash
git -C docs/ diff
git -C docs/ diff --stat
```

先展示文件级别的统计（`--stat`），若用户需要详细差异再展示完整 diff。

## 完整交互示例

### 示例 1：首次设置

```
用户：帮我设置 wiki 仓库

助手：
检测到 docs/ 尚未关联 git 仓库。你想：

① 初始化全新仓库（适合从零开始）
② 克隆已有内容仓库（已有 wiki 内容在远程）

选哪个？

---
用户：②，仓库地址 git@github.com:user/my-llm-wiki.git

助手：
⚠️ docs/ 当前已有内容：
  docs/wiki/index.md
  docs/wiki/operation-log.md

克隆远程仓库会覆盖当前内容。是否先备份当前内容？

---
用户：不用备份，这些是模板文件，直接覆盖

助手：
✓ 已克隆 git@github.com:user/my-llm-wiki.git → docs/
  最新提交：abc1234 "增加 Transformer 词条"
  Remote：origin → git@github.com:user/my-llm-wiki.git

当前 docs/ 内容：
  docs/wiki/：12 个词条
  docs/raw/：3 个素材
```

### 示例 2：日常同步

```
用户：推送 wiki

助手：
docs/ 当前状态：
  分支：main
  未提交修改：
    M docs/wiki/LLM RAG.md（新增对比关联）
    M docs/wiki/index.md（更新目录）
  
  待推送提交：无

需要先 commit 吗？建议提交信息：「更新 LLM RAG 词条：补充对比关联」

---
用户：按你的建议提交并推送

助手：
✓ 已提交：def5678 "更新 LLM RAG 词条：补充对比关联"
  修改文件：2 个

✓ 已推送到 origin/main
  远程：git@github.com:user/my-llm-wiki.git
```

## 强制规则

| 规则 | 说明 |
|------|------|
| **docs/ 独立** | 所有 git 命令在 `docs/` 目录内执行，不污染框架仓库 |
| **操作前检查** | 任何 git 操作前 MUST 先检查 `docs/` git 状态 |
| **不自动覆盖** | clone / pull 会覆盖本地内容时 MUST 询问用户 |
| **Push 前确认** | 展示待推送内容摘要，用户确认后再执行 |
| **变更展示** | status / log / diff 结果以中文摘要呈现，不直接 dump 原始 git 输出 |
| **错误友好** | git 报错时翻译成中文解释（如 "no upstream branch" → "尚未设置远程仓库，请先执行 docs remote <url>"） |
| **不跨仓库** | 绝不操作框架仓库（根目录的 .git），仅操作 docs/ 内的 .git |
| **幂等安全** | init 已初始化的仓库应提示「已初始化」，不做破坏性操作 |

## 常见错误处理

| git 错误 | 中文解释 | 解决方案 |
|---------|---------|---------|
| `fatal: not a git repository` | docs/ 尚未初始化为 git 仓库 | 使用 `init` 或 `clone` |
| `fatal: No configured push destination` | 未设置远程仓库地址 | 使用 `docs remote add <url>` |
| `fatal: remote origin already exists` | 远程仓库已关联 | 使用 `docs remote set-url <新url>` 修改 |
| `rejected: failed to push` | 远程有更新，本地落后 | 先 `pull` 再 `push` |
| `merge conflict` | 本地和远程同时修改了同一文件 | 手动解决冲突后 commit，或放弃一方修改 |
| `Permission denied (publickey)` | SSH 密钥未配置或无权限 | 检查 SSH 配置或改用 HTTPS |

## 与其他 Skill 的联动

```
Ingest 产生新 wiki 词条
       │
       ▼
  用户想保存到远程
       │
       ▼
  docs push（本 skill）→ 推送到远程仓库
       
---

新环境克隆框架
       │
       ▼
  docs clone <url>（本 skill）→ 拉取已有内容
       │
       ▼
  Query 可检索词条 / Explore 可引用
```

## 目录结构约定

```
项目根目录/
├── agent-spec.md           # 框架（被框架仓库跟踪）
├── .agents/skills/         # 框架（被框架仓库跟踪）
├── .gitignore              # 包含 docs/，框架不跟踪
└── docs/                   # 内容（独立 git 仓库，被框架忽略）
    ├── .git/               # 内容仓库的 git 数据
    ├── wiki/               # wiki 词条
    │   ├── index.md
    │   └── operation-log.md
    └── raw/                # 原始素材
        └── chats/          # 会话归档
```
