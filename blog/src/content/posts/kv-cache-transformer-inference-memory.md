---
title: "KV Cache：Transformer 推理的「记忆体」"
description: "为什么大模型聊到后来越来越贵？为什么不同模型的推理成本差几十倍？答案藏在 KV Cache 里——这个把 Transformer 从 O(n²) 拯救到 O(n) 的关键机制，如何在 GPU 显存中被高效管理？"
pubDatetime: 2026-07-22
tags: [kv-cache, transformer, inference, vllm, sglang, llm-serving]
draft: false
author: "Neo"
slug: kv-cache-transformer-inference-memory
derivedFrom:
  - "[[KV Cache]]"
  - "[[KV Cache 查找机制]]"
  - "[[KV Cache 命中率]]"
  - "[[vLLM]]"
  - "[[SGLang]]"
lastSynced: 2026-07-22
---

你和 ChatGPT 聊到第一百轮，有没有想过一个问题：它回答最后一个问题时，需不需要"重读"前面九十九轮？

直觉上不需要——它应该"记得"你们说过什么。但在 Transformer 的底层，记忆这件事远比你想的昂贵。每一轮生成的每一个 token，都要和之前所有 token 做一次注意力计算。如果模型有 4096 个 token 的上下文窗口，生成第 4096 个 token 时，它要算 4095 次点积。而更恐怖的是，如果没有一种叫 KV Cache 的机制，前面 4095 个 token 的关键信息每一步都要全部重算一遍。

这不是"算得慢一点"的问题，而是根本算不起。

## 为什么 Transformer 的记忆这么贵

核心在 Self-Attention 的公式里：

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

生成第 $t$ 个 token 时，这个 token 产出一个 Query 向量（$Q_t$），而所有历史 token 提供 Key（$K$）和 Value（$V$）向量。当前 token 的 Query 要和全部历史的 Key 做点积，得到注意力权重后，再加权求和全部历史的 Value。

关键在于：这些历史的 K 和 V，在每一步生成中都会被用到。没有 Cache 的话，生成第 $n$ 个 token 时，前 $n-1$ 个 token 的 K/V 要全量重新计算一遍。在整个生成过程中，最早的那个 token 的 K/V 被重复计算了 $n-1$ 次。整体复杂度从 O(n) 膨胀到 O(n²)。

而 Q 不需要缓存——它只用一次就丢掉了。历史的 K/V 是被所有未来 token 消费的共享数据。这就是 KV Cache 的本质：**把"被未来消费的中间结果"存起来，避免重复计算。**

## KV Cache 如何在 GPU 显存中"找得到"

物理上，KV Cache 就是 GPU 上一块巨大的张量。比如在 vLLM 中：

```
kv_cache: [num_blocks, num_kv_heads, block_size, 2 × head_size]
```

但问题来了：如果有 100 个用户同时在用，每个用户的对话长度不同，怎么分配显存？答案是借鉴操作系统的虚拟内存——把 KV Cache 切成固定大小的块（通常 16 个 token 一块），通过一张"块表"来做地址翻译。

```python
# 查找"请求 R 的第 i 个 token 的 KV"
block_index = i // 16          # 在哪个逻辑块
offset_in_block = i % 16       # 块内第几个位置
physical_block = block_table[R][block_index]  # 查块表 → 物理块号
# 直接索引: kv_cache[physical_block][head_id][offset_in_block][:]
```

两次整数运算，一次数组索引。O(1)。这就是全部——没有哈希，没有搜索，纯粹的"公式算地址，直接读显存"。

这个设计来自 vLLM 的 PagedAttention，它把操作系统分页的思想搬到了 GPU 显存管理上，将显存碎片从 60-80% 降到了 4% 以下。推理吞吐因此提升了 2-4 倍。

## 不只是自己用——跨请求的"记忆共享"

KV Cache 的另一个妙用：如果多个用户共享同一个 system prompt，那这段 prompt 的 KV 只需要算一次。

当一个新请求进来时，推理系统会去查："你的前缀，我算过了吗？"

两种主流方案在做这件事。vLLM 用哈希：给每个 KV 块算一个 SHA-256 哈希（包含父块哈希 + 当前块 token IDs + 额外键），新请求的前缀算一次哈希，查表，命中就跳过计算。SGLang 用 Radix Tree（前缀树）：把所有请求的 token 序列组织成一棵树，新请求沿树走一遍，找到最长匹配前缀，即使在块边界处也能精确拆分——比哈希方案更灵活。

实测中，这两种方案的命中率差异显著：vLLM 在简单前缀共享场景下表现不错，但分支场景（如两个请求共享 system prompt 但用户问题不同）容易 miss。SGLang 的 Radix Tree 在 LMSYS Chatbot Arena 中测出 74% 的命中率，首次 token 延迟降低 1.7 倍。

## 为什么不同模型的命中率差几十倍

命中率不是一个固定数字，它受到五大因素影响：

**首当其冲是模型架构。** MHA（如 LLaMA-2）的 KV 缓存成本最高，而 LLaMA-3 的 GQA 压缩到了 1/8，DeepSeek-V3 的 MLA 更是压缩了约 25 倍。相同显存下，MLA 模型能缓存的 token 数是 MHA 的数十倍，天然命中率更高。在 100 万 token 上下文下，MHA + FP16 需要 135GB，MLA + FP8 只需 8GB。

**请求模式是人为可控的最大杠杆。** ProjectDiscovery 团队曾测得 7% 的命中率——原因是 system prompt 里塞了时间戳。改成静态后，命中率飙升到 84%。多轮对话天然有 60-80% 的命中率；Few-shot 提示（相同示例）可达 70-90%；但代码补全（独特文件）只有不到 10%。

**工作负载之外，推理系统本身的设计也决定命中率上限。** vLLM 的哈希匹配适合稳定前缀场景，SGLang 的 Radix Tree 在分支/嵌套场景更强。SGLang 还做了 cache-aware 负载均衡——把请求路由到已有匹配前缀的副本上，实测命中率从 20% 提升到 75%。

## 回头看：KV Cache 就是 Transformer 的虚拟内存

如果把 Transformer 想象成一台计算机，那 KV Cache 就是它的虚拟内存系统：

- **Block Table** 相当于页表，把逻辑地址翻译成物理地址
- **PagedAttention** 相当于虚拟内存分页，消除碎片
- **前缀缓存** 相当于共享内存段，多进程复用同一块物理页
- **GQA/MLA** 相当于数据压缩，减少每次内存访问的数据量
- **Prefill 和 Decode** 相当于写入和读取两个阶段

理解了 KV Cache，你就能理解为什么 DeepSeek-V3 用 MLA 而不是 GQA，为什么 vLLM 选择分页而不是整块分配，为什么 SGLang 用 Radix Tree 而不是哈希表——它们都是在"如何更高效地管理 Transformer 的记忆"这个问题上，给出了各自的最优解。

下次你用大模型聊天时，不妨想一想：在 GPU 的某个角落，有一块叫做 KV Cache 的显存区域，正以 O(1) 的速度帮你定位每一条历史消息的"记忆"。而一块叫做 Block Table 的翻译表，正忙着把你的 token 逻辑地址，翻译成显存的物理偏移。

这就是让大模型从"能跑"到"跑得划算"的核心秘密。
