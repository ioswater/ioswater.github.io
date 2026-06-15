---
title: Agent 可观测性栈设计
description: 从 trace 到 replay，建立可追溯的 agent 诊断链路。
lastUpdated: 2026-06-10
---

## 最小监控面

- 工具调用耗时和失败率
- 每轮上下文 token 消耗
- 关键决策节点的结构化事件

## 推荐产物

1. `Trace Timeline`：按轮次还原行为。
2. `Tool Audit`：按工具聚合异常。
3. `Replay Pack`：可复现实验输入输出。

## 与 instinct-envolve 的关系

可把稳定高频行为沉淀成共享 instinct，再通过 evolve 生成更高阶流程资产。
