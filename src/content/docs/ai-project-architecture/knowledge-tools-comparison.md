---
title: 知识库与向量检索工具对比
description: 横向对比 Qdrant / Notion / Confluence / pgvector / Obsidian / Elasticsearch，并解析「少 token 查整套体系」的 RAG + 子代理 + 缓存机制，以及在 Claude Code 与 Codex 上的落地形态。
lastUpdated: 2026-07-30
order: 2
---

> 生成日期：2026-07-30
> 范围：先回答「为什么查询一整套体系（如逆向拆包全流程）却能消耗很少 token」的核心问题，再横向对比 Qdrant / Notion / Confluence / PostgreSQL(pgvector) / Obsidian / Elasticsearch。

---

## 一、核心问题：为什么查「整套体系」却只要很少 token？

先纠正一个常见误解：**没有工具能真正做到「输出不算输入/输出 token」**。任何返回给模型看的内容，都会以 input token 形式计费。真正的省 token 来自两点：

1. **不把整个语料塞进上下文**（按需检索，而非全量加载）
2. **检索/阅读发生在「隔离的上下文」里**（子代理模式），主流程只收到一个短摘要

下面按「省 token 力度」从大到小拆解可行手段：

### 1. RAG（检索增强生成）——主力手段
- 语料提前切 chunk → 向量化 → 存入向量库。
- 查询时只把「query 的向量」去检索，取 **top-k 个最相关 chunk**（如 5~20 段）注入模型。
- Token 成本 ≈ `query + k 个 chunk + 回答`，**与语料总大小无关**。
- 这是「查逆向拆包整套流程但只花少量 token」的最标准答案：你不是把几百篇文档都读给模型，而是只喂最相关的几段。

### 2. 子代理 / Agent 委派（上下文隔离）——最容易被忽略的省 token 技巧
- 在 WorkBuddy 这类架构里，`Agent` 工具启动的子代理**拥有独立的上下文窗口**。
- 主代理把「去把拆包流程、常用工具、疑难问题整理出来」交给子代理；子代理自己读文件、做检索，最后**只把一段短摘要返回主代理**。
- 效果：原始文档的 token 消耗发生在子代理账上，主流程上下文保持很小。这正是「过程消耗很少 token」的真实来源之一。
- 注意：子代理的 token 依然计费（只是不在主流程），属于「上下文分桶」，不是「免费」。

### 3. MCP 服务器（按需取数，解耦检索与消费）
- MCP 把知识库暴露成标准化工具（`search_docs`、`list_collections` 等）。模型**需要时**才调用，拿到格式化的检索结果。
- 省 token 点：**整个知识库不用作为静态 system prompt 预加载**；切换 AI 宿主（Claude/Cursor/自研）无需重写检索代码（build once, connect everywhere）。
- 局限：MCP 工具返回的文本**仍然进入调用方上下文并计费**。它省的是「全量预加载」和「重复集成的成本」，不是「返回内容免费」。
- 可叠加：hybrid search（向量+关键词）、contextual chunking（带章节标题/前后文的 chunk）、多源 RAG（docs+Slack+Jira+代码）。

### 4. Skill 文件（流程编码，不是数据仓库）
- `SKILL.md` 加载进上下文**会**消耗 token，但它把「如何检索/如何调用外部工具」的流程固化下来，避免每轮对话重复解释。
- 它本身不存数据；真正的数据在它指向的外部系统（向量库 / 文件 / MCP）。所以 skill 是「省说明 token + 规范流程」，不是「省数据 token」。

### 5. 缓存（Cache）
- Prompt Cache：把固定的系统提示 / 常用检索片段缓存，重复命中只收缓存价（远低于全价）。
- 语义缓存：相同/相近问题直接复用上一次检索结果，跳过 embedding+检索。

### 6. 细粒度返回 + 重排（rerank）
- chunk 大小、top-k、是否带元数据都可调；先粗召回再 rerank（交叉编码器 / ColBERT  late interaction），只把最终最相关的少量内容给模型。
- 例：Qdrant 支持 score boosting、MMR 去冗余、ColBERT 级 token 级精度。

### 结论速记
| 手段 | 省 token 的本质 | 返回内容是否计费 |
|---|---|---|
| RAG + 向量库 | 只检索 top-k chunk，不全量加载 | 是（但量很小） |
| 子代理委派 | 检索发生在隔离上下文，主流程只见摘要 | 是（在子代理账上） |
| MCP | 按需取数，不预加载全库 | 是（返回文本计费） |
| Skill | 固化流程，省重复说明 | 是（加载时计费） |
| 缓存 | 复用命中，跳过重复计算 | 部分（缓存价更低） |

> 一句话：别人「查整套体系却很少 token」= **RAG 只取相关片段 + 子代理隔离上下文 + 按需 MCP 调用 + 缓存**，而不是某个工具「白送 token」。

---

## 二、六个工具横向对比

### 速查表

| 维度 | Qdrant | Notion | Confluence | pgvector | Obsidian | Elasticsearch |
|---|---|---|---|---|---|---|
| 本质 | 专用向量数据库 | 云笔记+数据库 | 企业 Wiki | Postgres 向量扩展 | 本地 Markdown 笔记 | 搜索/分析引擎 |
| 团队共享知识图谱 | ❌ 非图谱（可作 GraphRAG 后端） | 🟡 关系库+双向链接，非真图 | ❌ 页面树，非图 | ❌ 仅向量列 | 🟡 真·个人图谱，但**团队弱** | 🟡 有关联发现，非核心图谱 |
| 团队实时协作 | ✅（服务端多租户） | ✅ 强 | ✅ 强 | ✅（靠应用层） | ❌ 无原生（Git/网盘同步） | ✅ 强 |
| 集成难度 | 中 | 低-中 | 中 | 低（有 PG 则极易） | 中-高（无官方 API） | 高（集群运维重） |
| 返回粒度 | 极细（top-k chunk 可控） | 页/块级 | 页/块级（CQL） | 极细（SQL 行级） | 文件级 / Dataview 查询 | 极细（top-k + 过滤） |
| 主要场景 | RAG、语义检索、Agent 记忆 | 团队 wiki、项目管理 | 企业技术文档、Jira 绑定 | 轻量向量检索（已有 PG） | 个人 PKM、第二大脑 | 大规模混合检索、企业搜索 |
| 自托管/隐私 | ✅ 完全自托管 | ☁️ 云端为主 | ☁️/Data Center | ✅ 自托管 | ✅ 纯本地 | ✅ 自托管 |
| **实时写入/写回省 token** | ✅ `upsert_points` 随时写回片段 | ✅ 官方 MCP 写页/块 | ✅ REST/MCP 写页 | ✅ SQL 随时写回行 | ✅ filesystem MCP 写 `.md` | ✅ 索引 API 随时写回 |

---

### 1. Qdrant（专用向量数据库）
- **特点**：Rust 编写，HNSW 近似检索 + 原生混合检索（dense + sparse，BM25/SPLADE++/miniCOIL）；一阶段过滤（filter 在 HNSW 遍历中执行，非后置）；量化（scalar/product/binary，内存可降 64x）；多向量（multi-vector）、rerank（MMR、ColBERT late interaction）；multitenancy + RBAC；可 on-prem / hybrid / edge / cloud。
- **优点**：性能与扩展性顶级（官方称最高 4x RPS）；检索粒度极细；与 RAG/Agent 场景天然契合；有 `mcp-server-qdrant`。
- **缺点**：是「零件」不是「成品」——你还要自己写 ingestion、chunking、embedding 管线；运维一个服务。
- **团队共享知识图谱**：不是知识图谱本体，无原生图遍历。可作为 GraphRAG 的向量存储后端。
- **集成难度**：中（Docker 起服务 + 官方 client/REST/gRPC）。
- **返回粒度**：极细，top-k 与 payload 完全可控。
- **典型场景**：RAG、语义搜索、推荐、AI Agent 持久记忆。

### 2. Notion（云笔记 + 数据库）
- **特点**：block 编辑器，内联数据库（relation/rollup/formula，多视图 table/board/calendar/gallery）；Notion AI 做写作/摘要/跨工作区问答；模板生态丰富。
- **优点**：上手快、灵活度极高、团队实时协作体验好；API + SDK + 社区 MCP 易集成；适合「文档即数据库」。
- **缺点**：规模大（5000+ 页）会变慢、搜索变弱；权限模型在大组织易混乱；无原生 Jira 深度集成；合规/审计要到 Enterprise。
- **团队共享知识图谱**：页面双向链接 + 数据库 relation 能形成关联网络，但**不是图数据库**，无图遍历算法；团队共享是强项。
- **集成难度**：低-中（REST API + OAuth + MCP）。
- **返回粒度**：页/块（block）级，API 可取单 block。
- **典型场景**：团队 wiki、轻量项目管理、产品规格/路线图、客户 FAQ。

### 3. Confluence（企业 Wiki）
- **特点**：Space → Page 树状层级，模板面向技术文档/SOP/决策记录；宏（macro）、与 Jira 原生双向联动（inline issue、smart link）；Atlassian Intelligence（Rovo）做 AI 搜索/摘要；Data Center 可自托管。
- **优点**：结构化、可治理、页面级权限 + 审批流 + 审计轨迹，适合合规与大组织；Jira 用户几乎必选。
- **缺点**：灵活度低于 Notion；配置/上手更重；无原生图；单价虽低但需配套 Atlassian 栈。
- **团队共享知识图谱**：无原生图谱；靠页面树 + 链接组织。团队共享强。
- **集成难度**：中（REST + CQL + Forge，有社区 MCP）。
- **返回粒度**：页/块级，CQL 过滤能力强。
- **典型场景**：中大型企业的技术文档、研发知识库、与 Jira 绑定的工程协作。

### 4. PostgreSQL / pgvector（向量扩展）
- **特点**：在 Postgres 里加 `vector` 类型 + 距离算子；支持 exact / 近似（HNSW、IVFFlat）、L2/IP/cosine/L1/Hamming/Jaccard；halfvec、binary quantization、sparsevec；与 ACID、JOIN、行级权限天然一体。
- **优点**：**已在用 PG 的团队几乎零额外组件**；过滤/联表/租户就是普通 SQL；免费、无厂商锁定；Supabase/Neon/RDS 都自带。
- **缺点**：超大规模（数亿~十亿向量）或纯向量负载时，不如专用向量库；HNSW 调参需懂 PG；不是图谱。
- **团队共享知识图谱**：无原生图（可叠 Apache AGE 等图扩展）；团队共享靠 PG 本身的多连接/权限。
- **集成难度**：低（有 PG 则装扩展 + 写 SQL 即可）。
- **返回粒度**：极细（SQL 行级 + WHERE 过滤）。
- **典型场景**：已有 Postgres 的团队做轻量向量检索；希望「向量 + 关系数据」统一存储，避免双写同步。

### 5. Obsidian（本地 Markdown 笔记）
- **特点**：本地优先，笔记即 `.md` 文件，永久拥有、可 Git 版本化；双向链接 + 图谱视图（graph view）是灵魂；1700+ 社区插件（Dataview 把 vault 当数据库查、Templater、Canvas、Excalidraw）。
- **优点**：**真正的个人知识图谱**（节点+边可视化）；极快、极隐私（不上云除非主动 Sync/Publish）；个人免费、可高度定制；适合「第二大脑」。
- **缺点**：**无原生团队实时协作**（同笔记并发编辑会冲突，只能 Git/Dropbox/网盘同步）；对 AI Agent 集成不友好——无官方 API/云端，需直接读本地 `.md` 或用 Local REST API 等社区插件；学习曲线陡。
- **团队共享知识图谱**：个人图谱极强，但「团队共享」弱（单用户本地优先）。小技术团队用 Git 共享 vault 做文档可以，但不是协作工具。
- **集成难度**：中-高（对 AI 而言）；本质是文件系统，最适合直接 `Read` 本地 md 或接 MCP filesystem。
- **返回粒度**：文件级（读整篇 .md）或 Dataview 查询结果。
- **典型场景**：个人 PKM、研究者文献网络、开发者本地文档库、隐私敏感笔记。

### 6. Elasticsearch（搜索 / 分析引擎）
- **特点**：`dense_vector` + `sparse_vector` + `semantic_text`；retriever 多阶段管线（keyword knn + sparse + rerank，RRF/线性融合）；BBQ/int8/int4 量化；内置 ELSER/E5/Jina 等嵌入模型与推理 API；ES|QL 用 FORK/FUSE/RERANK 组合检索；9.4 起 `query_vector_builder.lookup` 单次请求完成「类此文档」检索。
- **优点**：大规模混合检索（关键词+向量）王者；水平扩展、企业级；可被 MCP/客户端接入；适合「全文 + 语义」同时要的场景。
- **缺点**：JVM/集群运维重、资源占用大；对非搜索团队过重；不是知识图谱（虽有历史 Graph 功能，但现代图谱非核心）。
- **团队共享知识图谱**：无原生图谱；关联发现能力一般。团队共享强（服务端多租户）。
- **集成难度**：高（集群运维成本）。
- **返回粒度**：极细（top-k + 丰富过滤 + 重排）。
- **典型场景**：企业级搜索、日志/全文 + 语义混合检索、大规模 RAG（百万~十亿级文档）、多媒体相似检索。

---

## 三、怎么选（决策建议）

- **想要「查整套技术体系却省 token」** → 优先 **RAG + 向量库**，再叠加**子代理隔离**与**缓存**。
  - 轻量 / 已有 Postgres → **pgvector**
  - 性能/规模/混合检索优先 → **Qdrant**（或 **Elasticsearch** 若还需全文）
  - 完全托管不想运维 → Pinecone / Qdrant Cloud（不在你列表内，但值得知道）
- **团队共享知识库（人要写、要协作）** → **Notion**（灵活、快）或 **Confluence**（已在用 Jira、要合规）。
- **个人「第二大脑」+ 真图谱** → **Obsidian**（但团队共享弱）。
- **真正要「团队共享知识图谱」**（图遍历、实体关系推理，如 GraphRAG）→ 上述六个都不是最佳本体；应看 **Neo4j / NebulaGraph** 或在向量库之上跑 **Microsoft GraphRAG**。

### 针对你的「逆向拆包知识库」的具体建议
1. 文档（流程、工具清单、疑难排查）落地为 Markdown/PDF，用 **Qdrant 或 pgvector** 做 chunk 嵌入。
2. 写一个小 **MCP server**（或复用社区版）暴露 `search_unpack_docs(query, top_k)`，模型按需调用，只返回 top-k 片段。
3. 复杂「全流程整理」类问题交给**子代理**跑检索并回摘要，主流程保持轻量。
4. 若要人和 AI 都能浏览，把精华沉淀进 **Notion/Confluence** 作为「人读层」，向量库作为「机读检索层」——双层结构最稳。

---

## 四、在 Claude Code 与 Codex 上的场景

你点名的这两个 agent 正是「查整套体系却很少 token」的主战场。下面把它们的底层能力和六个工具的接入方式对齐。

### 4.1 两个 agent 的底层能力对比

| 能力 | Claude Code | Codex（OpenAI） |
|---|---|---|
| 上下文窗口 | 货真价实 200K，不会静默截断 | 与所用模型/配置相关（o 系列推理模型 + 大窗口） |
| 子代理隔离上下文 | ✅ 原生（内置 Explore / Plan / General-purpose + 自定义 `.claude/agents/*.md`） | ✅（MultiAgentV2，多 agent 可并行） |
| **子代理内联 MCP（父对话不加载工具描述）** | ✅ 支持：子代理 frontmatter 的 `mcpServers` 可内联定义，**专属于该子代理**，主会话根本看不到工具描述、也不载入检索结果 | ❌ MCP 在 `~/.codex/config.toml` **全局共享**，连上后工具描述进入主会话（v0.143 起默认用 tool search 缓解） |
| MCP 接入 | ✅ stdio / http / sse；`claude mcp add`；官方连接器（Notion `mcp.notion.com/mcp`、GitHub、Context7） | ✅ stdio + Streamable HTTP（OAuth / bearer）；`codex mcp add`；ChatGPT 桌面/CLI/IDE 共享配置 |
| Skill 渐进加载 | ✅ 启动只预载名称+描述（约 100 token），全文与参考资料按需读取 | 🟡 有 memory（记偏好/修正/耗时信息）+ 插件，但无等价「按需渐进加载」机制 |
| 记忆/指令 | CLAUDE.md 分层 + `.claude/rules/` | ✅ memory 预览版 + Goals + 自动化线程 |

**最关键的省 token 差异**：
- **Claude Code 的杀手锏 = 子代理 + 内联 MCP + Skill 渐进加载三者叠加**。把重型检索 MCP（如 Qdrant/ES）「内联」定义在子代理 frontmatter 里，主对话既看不到它的工具描述，也不会被检索结果污染；子代理在自己独立的上下文窗口里做检索，只回一段精简摘要。这是「查整套体系却很少 token」当下最干净的实现形态。
- **Codex** 同样支持 MCP + 子代理隔离，但 MCP 是全局共享，工具描述会进主会话（tool search 默认减轻）；主要靠子代理隔离 + memory 缓存来省。Codex 还有 computer use，能直接操作无 API 的工具界面（例如打开 Obsidian 或浏览器查资料）。

### 4.2 六个工具 × 两个 agent 的接入矩阵

| 工具 | Claude Code 接入 | Codex 接入 | 省 token 建议 |
|---|---|---|---|
| **Qdrant** | `mcp-server-qdrant`（或自建）；**内联进子代理**最佳 | `codex mcp add`（stdio/http），Qdrant 自带 MCP server | 检索 MCP 内联到子代理，主流程零负担 |
| **Notion** | 官方连接器 `https://mcp.notion.com/mcp` | Notion MCP / 插件（Codex 已原生集成 Notion） | 作为人读层；检索走 API 取 block 级 |
| **Confluence** | 社区 MCP（Atlassian） | Atlassian Rovo 插件 / Confluence MCP | 与 Jira 联动时最优 |
| **pgvector** | Postgres MCP（`server-postgres`），用 SQL 查向量列 | Postgres MCP，`codex mcp add` | 已有 PG 直接查，零新组件 |
| **Obsidian** | filesystem MCP 读本地 `.md` / 社区 `obsidian-mcp` | 本地文件原生可读（Codex 直接读 vault） | 仅文件系统级，**无语义检索**；要语义需额外向量层 |
| **Elasticsearch** | ES 官方 MCP server，knn 查询 | ES MCP，`codex mcp add` | 大规模混合检索，chunk 可控 |

> 注意：Obsidian 在两个 agent 里都只是「本地 Markdown 文件」——Claude Code 用 filesystem MCP、Codex 直接读盘。没有向量层时它**不会做语义检索**，只能靠文件名/全文 grep。要保留 Obsidian 的图谱体验又想语义检索，得在它之上另接 Qdrant/pgvector 做嵌入。

### 4.3 推荐落地形态（以逆向拆包知识库为例）

**Claude Code（最省 token 范式）**
1. 文档 chunk 嵌入进 **Qdrant**（或 pgvector / ES）。
2. 写自定义子代理 `~/.claude/agents/unpack-researcher.md`：
   - frontmatter 内联 Qdrant MCP（`mcpServers` 字段），并 `tools: Read` + 该 MCP 工具，**只读**；
   - 规定输出格式为「精简摘要 + 引用来源」。
3. 配一个 Skill 描述「何时委派该子代理」。
4. 主代理收到「拆包全流程/疑难问题」类问题 → 委派 → 子代理在自己的上下文里检索 top-k → 只回摘要。**主对话上下文几乎不变**。

**Codex**
1. 全局 `codex mcp add` 连一个检索 MCP（如 Qdrant）。
2. 用子代理 / MultiAgent 隔离检索上下文；或用 memory 记住「拆包知识库在 X」，配合 tool search 自动定位工具。
3. 若没有合适 MCP，可用 computer use 直接打开 Obsidian / 浏览器查（代价是屏幕内容会进上下文，不如 MCP 干净）。

### 4.4 一句话选型
- 想要「**主流程极致省 token**」→ Claude Code 的**内联 MCP 子代理**是当下最干净的实现（父会话完全不沾工具描述与检索结果）。
- Codex 胜在**生态广**（90+ 插件、computer use、memory），但 MCP 全局共享，省 token 主要依赖子代理隔离 + memory，而非工具描述隔离。

---

## 五、实时写入/使用知识库（write-back loop）以省 token

你这个问题点到了「省 token」更深的一层：**与其每次都重新推导/重新检索，不如让 agent 在会话过程中把结论「外置」进知识库，下次（或同会话后续）直接读回**。这就是 2026 年热议的 **write-back loop（写回闭环）** 思想——把 token 从「消耗品（opex）」变成「资产（capex）」。

### 5.1 核心机制：检索比生成便宜 10–50×
- 标准做法：agent 每遇到一个没答案的问题，就现场去查、去推导、把大段原文塞进上下文 → 每次都「从零生成」。
- 写回闭环：agent 推导出结论后，**立刻把结论写回持久知识库**（一条结构化笔记 / 一个向量 chunk / 一页 wiki）。下一次相关问题出现时，**先命中知识库（检索）而非重新生成**。检索成本约为生成的 1/10 ~ 1/50。
- 已公布的对照实验（LinkedIn 转发的一篇 arxiv 论文，编号 2604.11243，**属单一报告、领域相关，非独立验证**）：同一领域连续提问，写回闭环累计 token 47K vs 标准 RAG 基线 305K → **标称省 84.6%**；到第 4 次提问，同样一道题从 28K 降到 4K。30 天投影：高集中度领域省 81%、中等 54%、最差（分散低频）仍省 26%。
  - ⚠️ 这是「领域集中度」高度相关的乐观数据，不能当成所有场景的保证值；但「写回比不复用省得多」的方向是稳的。

### 5.2 两种写回范式（关键区分）
| 范式 | 写入形态 | 代表工具 | 适合解决什么 | 局限 |
|---|---|---|---|---|
| **语义写回（机读层）** | 把结论/片段 `embedding` 后 upsert 进向量库 | Qdrant / pgvector / Elasticsearch | 海量语料里按语义召回，未来 query 命中 top-k 即走 | 纯 RAG「每次从零重发现」，**不累积连接**（片段之间无关联，体系性知识易丢链路） |
| **编译型 wiki 写回（人读+累积层）** | 把原始材料「编译」成结构化 Markdown wiki（摘要+反向链接+索引页） | Obsidian / Notion / Confluence | 「iOS 逆向怎么操作」这类**体系化、强关联**知识，跨会话累积、自动加载 | 自身无语义检索（除非叠向量层）；Obsidian 团队弱 |

> Karpathy 2026-04 提出的 LLM Knowledge Base 模式即后者：**Raw → Compile → Lint → Query** 循环。agent 把架构决策、踩坑、约束编译成带反链的 wiki，下一次会话直接读文件即可，不必重新让你解释——既省 token 又避免「重新解释必有损」。他明确指出：纯 RAG 是「每道题都从头重新发现知识，没有积累」；而编译型 wiki 会复利式增长。

### 5.3 六个工具「实时写入/使用」能力对齐
| 工具 | 会话中实时写入 | 会话中实时使用 | 写回形态 / 省 token 要点 | 注意点 |
|---|---|---|---|---|
| **Qdrant** | ✅ `upsert_points`（向量+metadata payload 随时增改） | ✅ `search` 随时取 top-k | 把「结论 chunk」嵌好写回；未来命中即走，机读层首选 | 写回前需 embed（少量 token/延迟）；要做「写入校验」防记忆投毒 |
| **pgvector** | ✅ `INSERT/UPDATE` 带 vector 列（Postgres MCP） | ✅ SQL 相似度查询 | 与 Qdrant 同机制，外加 SQL 元数据过滤/联表 | 同 Qdrant 的 embed 成本 |
| **Elasticsearch** | ✅ 索引 API 随时写 doc | ✅ knn + 关键词混合 | 海量语料里写回 + 混合召回 | 集群运维重 |
| **Notion** | ✅ **官方 MCP**：`create-a-page` / `append-blocks` / `update-a-page`（读+写齐全） | ✅ `search` / 读 block | 写回 = 一页「人读 playbook」，未来会话/你本人直接读 | **限频 3 req/s**；适合写「精炼产物」，不适合高频碎写 |
| **Confluence** | ✅ REST API / MCP 建页改页 | ✅ 读页（CQL） | 企业版「人读 playbook」，与 Jira 联动最佳 | 灵活度低于 Notion |
| **Obsidian** | ✅ filesystem MCP：`obsidian_write` / `append` / `update`（直接写 `.md`）；社区 `native-mcp` 插件支持 hash 安全编辑+审计日志 | ✅ 读 `.md` / grep / Dataview | **就是 Karpathy 编译型 wiki 本体**：写 Markdown 落盘、可 Git 版本化、会话启动自动加载 | 自身**无语义检索**，要知道路径或靠全文 grep；团队并发弱 |

### 5.4 在 Claude Code / Codex 里的「写回」落地
- **Claude Code（最顺）**：
  1. 子代理在前述「内联 MCP」里检索后，不仅回摘要，还**把结论写回 KB**（如 `upsert` 进 Qdrant，或 `create-a-page` 进 Notion，或 `obsidian_write` 落盘）。主会话仍不被污染。
  2. `CLAUDE.md` / `.claude/rules/` / memory 文件**在每次会话启动自动加载**——这本身就是「编译型 wiki 自动注入」，等于零成本复用上次沉淀。
  3. 模式：原始语料 → 子代理编译成 wiki/向量 → 下次会话自动读回。**成本随使用复利下降**。
- **Codex**：
  1. 子代理 / MultiAgent 隔离检索，写回走全局 MCP（Qdrant/Notion/Obsidian 均可）。
  2. `memory` 预览版可记住「拆包知识库在 X、结论摘要是 Y」，配合 tool search 自动定位。
  3. 无合适 MCP 时，computer use 可直接开 Obsidian 写笔记（但屏幕内容进上下文，不如 MCP 干净）。

### 5.5 落地建议（结合你的「逆向拆包」）
- **双层写回最稳**：机读层（Qdrant/pgvector 存结论 chunk，供语义召回）+ 人读层（Notion/Confluence/Obsidian 存一页精炼 playbook，供你和 AI 直接读）。一次推导，两种资产。
- **写入校验必做**：agent 自己写记忆会引入「记忆投毒」风险（prompt injection 可污染 KB）。写回前过滤含指令/URL/代码式样的内容（mem0 的守护实践）。
- **不是所有内容都值得写回**：只沉淀「可复用结论 + 链接 + 约束」，别把一次性的原始原文全灌进去，否则 KB 膨胀反而拉高检索噪声。

---

## 六、参考来源

- Qdrant 官网 / 特性页：https://qdrant.tech/ 、 https://qdrant.tech/qdrant-vector-database
- pgvector README（PGXN）：https://pgxn.org/dist/vector/README.html
- pgvector 2026 评测（makerstack）：https://makerstack.co/reviews/pgvector-review/
- Obsidian 评测（toolpilot，2026-02）：https://toolpilot.dev/tools/saas/obsidian
- Elasticsearch 向量检索文档：https://www.elastic.co/docs/solutions/search/vector
- Elasticsearch 9.4 stored-vector lookup：https://www.elastic.co/search-labs/es/blog/elasticsearch-vector-search-lookup
- Notion vs Confluence 对比（2026）：https://www.mgsoftware.nl/en/vergelijking/notion-vs-confluence 、 https://www.ideaplan.io/compare/notion-vs-confluence
- MCP for RAG（aimadetools，2026-04）：https://www.aimadetools.com/blog/mcp-for-rag
- RAG with MCP 架构（mcpserverspot）：https://mcpserverspot.com/learn/use-cases/rag-applications-mcp
- Claude Code 子代理文档（含内联 MCP）：https://docs.anthropic.com/pt/docs/claude-code/sub-agents 、 http://code.claude.com/docs/zh-CN/sub-agents
- Claude Code 进阶（Skills/Subagents/MCP，53ai 编译）：https://www.53ai.com/news/LargeLanguageModel/2026013004176.html
- Codex MCP 官方文档：https://developers.openai.com/codex/mcp
- Codex 版本更新日志（MCP tool search / 子代理）：https://developers.openai.com/codex/changelog/
- Codex 新增能力概览（插件/记忆/computer use）：https://openai.com/zh-Hans-CN/index/codex-for-almost-everything/
- Codex MCP 接入指南（matagi）：https://matagi.ai/blog/guides/how-to-add-mcp-servers-to-codex

### 本轮新增来源（第五节 write-back loop）
- Write-back loop / Knowledge Compounding 论文解读（LinkedIn 转 arxiv 2604.11243，单一报告、含 84.6% 标称省 token 数据）：https://www.linkedin.com/posts/will-lu-9b9b972b_knowledge-compounding-an-empirical-economic-activity-7450245423711125504-jEk1
- The 2026 Token Optimization Playbook（Mem0，检索 vs 全量注入省 72%）：https://mem0.ai/blog/the-2026-token-optimization-playbook-cut-ai-agent-memory-costs-3–4x
- LLM Knowledge Base: Beyond RAG（Karpathy Raw→Compile→Lint→Query 模式，verdent）：https://www.verdent.ai/guides/llm-knowledge-base-coding-agents
- RAG vs Memory for AI Agents（Memori，记忆层 vs 检索层）：https://memorilabs.ai/blog/rag-vs-memory-for-ai-agents/
- Qdrant MCP（含 upsert_points 写回）：https://aerostack.dev/mcp/aerostack/mcp-qdrant
- Notion 官方 MCP Server（含 create-a-page / append-blocks 写回）：https://promptgenius.net/mcp/business-productivity/notion
- Obsidian native-mcp 插件（hash 安全编辑 + 审计日志）：https://community.obsidian.md/plugins/native-mcp
- Obsidian filesystem MCP（直接读写 .md）：https://lobehub.com/pt-BR/mcp/neveugregor-mcp-obsidian
- 腾讯云 Agent Memory 服务（分层存储/按需加载省 token）：https://new.qq.com/rain/a/20260428A074UU00?refer=cp_1009
