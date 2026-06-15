---
title: instinct-envolve 团队使用指南
description: 团队如何使用 instinct-envolve 自我进化系统的完整说明。
---

# instinct-envolve 自我进化系统（团队使用指南）

## 1. 文档目标

这份指南用于给团队成员统一说明：

1. instinct-envolve 在 具体项目AAA 项目中的主流程是什么。
2. 系统是如何工作的（原理和边界）。
3. 日常如何使用、有哪些注意事项、遇到问题怎么排查。

本指南以仓库当前实现为准（`.claude/` + `.agents/` 双入口兼容）。

---

## 2. 一句话理解系统

instinct-envolve 是一个“从日常开发行为里自动学习，再沉淀为可复用规则/流程”的机制：

1. Hook 捕获工具行为（observation）。
2. 后台 observer 提炼为 instinct（带置信度）。
3. 通过 share/evolve 形成团队可复用资产（共享 instinct、命令、技能、agent）。

---

## 3. 核心概念

1. `Observation`：一次工具调用行为记录（例如 Edit/Write/Bash）。
2. `Instinct`：原子习惯（`trigger -> action`），带 `confidence`。
3. `Personal instinct`：项目私有学习结果，存本地数据目录。
4. `Shared instinct`：团队共享版本，存仓库 `.claude/instincts/shared/`。
5. `Evolve`：把多个 instinct 聚类，产出更高阶结构（command/skill/agent）。

---

## 4. 主流程（团队日常）

### 4.1 自动学习链路

1. 开发过程中，Hook 自动记录 observation。
2. observer 按条件分析 observation（达到最小数量后）并更新 instinct。
3. 成员通过 `/instinct-status` 查看当前学习状态。

### 4.2 手动触发学习

当你希望立即分析，不等周期：

```bash
/instinct-learn
```

实际执行脚本：

```bash
bash .claude/skills/instinct-system/scripts/instinct-learn.sh
```

### 4.3 共享给团队

当某条 instinct 达到可共享质量后：

```bash
/instinct-share <instinct-id>
```

或批量共享高置信度：

```bash
/instinct-share --all-ready
```

共享行为会把文件写到 `.claude/instincts/shared/` 并自动 `git add`。

### 4.4 在新会话生效

会话开始时（SessionStart）会自动把 `.claude/instincts/shared/` 转成软规则文件，写入：

```text
.claude/rules/instinct-shared/
```

这类规则是“建议型”，不会覆盖硬规则（如 `CLAUDE.md` 中 MUST/NEVER）。

### 4.5 进化为更高阶资产

```bash
/evolve
/evolve --generate
```

用于从多条 instinct 中抽取工作流，生成 command/skill/agent 候选或文件。

---

## 5. 当前命令总览

### 核心命令

1. `/instinct-status`：查看项目+全局 instinct 状态。
2. `/instinct-learn`：立即触发一次 observer 分析。
3. `/instinct-share`：共享 instinct 到团队目录并自动 git add。
4. `/evolve`：聚类 instincts 并生成进化候选/产物。

### 管理命令

1. `/instinct-import`：导入 instincts（本地文件或 URL）。
2. `/instinct-export`：导出 instincts。
3. `/promote`：项目 instinct 提升为全局 instinct。
4. `/projects`：查看项目注册和统计。
5. `/prune`：清理过期 pending instincts。

---

## 6. 存储与目录说明

### 仓库内（可提交）

1. `.claude/instincts/shared/`：团队共享 instincts。
2. `.claude/rules/instinct-shared/`：SessionStart 自动生成的软规则文件。
3. `.claude/commands/*.md`：命令入口文档。
4. `.claude/skills/continuous-learning-v2/`：ECC runtime（项目内镜像）。

### 本地（不入库）

默认根目录：

```text
~/.local/share/具体项目AAA-instincts/
```

关键子目录：

1. `projects/<project-id>/observations.jsonl`
2. `projects/<project-id>/instincts/personal/`
3. `projects/<project-id>/instincts/inherited/`
4. `projects/<project-id>/evolved/`
5. `projects.json`

---

## 7. 运行原理与边界

### 7.1 触发点

1. `PreToolUse`：`bash .claude/hooks/instinct-observe.sh pre`
2. `PostToolUse`：`bash .claude/hooks/instinct-observe.sh post`
3. `SessionStart`：`bash .claude/hooks/instinct-load-shared.sh`

### 7.2 项目隔离

通过 git 项目信息计算 `project_id`，不同仓库天然隔离，避免跨项目污染。

### 7.3 与其他规则系统关系

1. `CLAUDE.md`：硬规则，优先级最高。
2. `shared instinct -> rules`：软规则，提供建议，不强制覆盖硬规则。
3. `auto-memory`：事实记忆，不等于 instinct 行为模式。

---

## 8. 团队使用建议

1. 先观察再共享：建议 `confidence >= 0.7` 再共享。
2. 共享内容保持“可泛化”：
   - 写触发条件（when...）
   - 写明确动作（do...）
   - 避免把一次性上下文塞进 instinct。
3. 共享后务必走正常 code review，避免“错误习惯放大”。
4. 高频有效 instinct 再考虑 evolve，避免过早生成低价值 command/skill。

---

## 9. 注意事项（常见误区）

1. `shared` 不是硬规范：它是建议，不是强制替代架构规范。
2. `instinct-learn` 触发后不一定立刻新增文件：observer 可能因阈值/冷却策略不产出新 instinct。
3. `instinct-share --all-ready` 是批量动作：执行前先确认本地 personal instincts 质量。
4. 本地数据目录不要手工大规模改写：优先使用 CLI 命令导入/导出/清理。

---

## 10. 故障排查

### 10.1 快速自检

```bash
python3 .claude/skills/instinct-system/scripts/instinct-cli.py --help
python3 .agents/skills/instinct-system/scripts/instinct-cli.py --help
bash .claude/skills/instinct-system/scripts/instinct-learn.sh
```

### 10.2 一键验收（推荐）

```bash
bash scripts/instinct/acceptance-mainflow.sh
```

### 10.3 ECC 同步后校验

```bash
bash scripts/instinct/sync-from-ecc.sh --verify-only
```

---

## 11. 与 ECC 同步策略（团队维护）

项目采用“upstream full runtime + local thin wrapper”策略：

1. ECC runtime 同步到：`.claude/skills/continuous-learning-v2/`
2. 具体项目AAA 保持薄封装：
   - `.claude/skills/instinct-system/scripts/*` wrappers
   - `.agents/skills/instinct-system/scripts/*` wrappers
   - 本地路径与会话流程适配

推荐同步命令：

```bash
bash scripts/instinct/sync-from-ecc.sh
bash scripts/instinct/acceptance-mainflow.sh
```

---

## 12. 给团队成员的最小操作清单

1. 每天正常开发，不需要额外操作（自动采集）。
2. 需要立即学习时执行：`/instinct-learn`。
3. 复盘后共享高质量习惯：`/instinct-share <id>`。
4. 周期性检查进化候选：`/evolve`。
5. 发布前跑一遍验收脚本，确保主链路可用。

