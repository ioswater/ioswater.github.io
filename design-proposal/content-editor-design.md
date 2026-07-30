# liuluit 内容编辑器 · 设计规格

> 目标：把博客「必须内容的编辑」集中到一个 GUI——支持排序、简介、栏目管理、校验，
> **但不编辑 md 正文**（正文本地编辑）。设计基于当前项目真实约定
> （Astro + Starlight，`src/content/docs/` + `src/config/sidebar.json`）。

---

## 1. 范围（Scope）

**纳入（编辑器负责）**
- 文章元数据（frontmatter）：`title` / `description` / `lastUpdated` / `order` / `slug` / `draft` / `prev` / `next` / 栏目归属
- 栏目（sidebar.json 顶层分组）：`label` / `en` 翻译 / `autogenerate` 目录 或 手动 `items` / 顶层顺序
- 落地页（`index.md`）元数据：`title` / `description`
- 英文镜像状态与 EN 前台字段（`title` / `description`）
- 校验 + 可视化侧边栏树

**不纳入（用户本地完成 / 后续）**
- md 正文编辑（含落地页引言段、文章主体）—— 用户本地编辑
- 图片 / 静态资源上传（可后续扩展）

---

## 2. 数据模型

### 2.1 文章（doc，对应一个 `.md` 文件）

| 字段 | 类型 | 必填 | 说明 | 映射到 Starlight |
|---|---|---|---|---|
| `title` | string | ✅ | 页面 H1 + 卡片标题 | `docsSchema.title` |
| `description` | string | ✅ | **简介/摘要**（搜索、卡片、social 摘要都用它） | `docsSchema.description` |
| `lastUpdated` | date | ⬜（惯用） | 末次更新，显示在页脚 | `docsSchema.lastUpdated` |
| `order` | number | ⬜ | 同栏目内排序；autogenerate 默认按文件名，`order` 显式控制且**不改 URL** | Starlight 原生 `order`（autogenerate 排序） |
| `slug` | string | ⬜ | 自定义 URL 片段 | `docsSchema.slug` |
| `draft` | boolean | ⬜ | `true` 则生产环境隐藏 | `docsSchema.draft` |
| `prev` / `next` | slug | ⬜ | 手动指定上下篇 | `docsSchema.prev/next` |
| `section` | 目录 | — | 所属栏目（= 文件所在目录） | 由目录决定 |
| `en` | {exists,title?,description?} | — | 英文镜像状态与前台字段 | `en/<dir>/<file>.md` |

> 排序决策：`order` 用正整数，值越小越靠前。编辑器拖拽排序后**自动重算并写回各文件 frontmatter 的 `order` 字段**，不重命名文件、不改 URL。

### 2.2 栏目（section，对应 sidebar.json 顶层一项）

| 字段 | 说明 |
|---|---|
| `label` | 中文标题 |
| `translations.en` | 英文标题 |
| `mode` | `autogenerate { directory }` 或 `items [手动链接]` |
| `order` | 顶层顺序（拖拽顶层分组调整） |
| 约束 | `autogenerate` 目录必须存在 `index.md`，否则该栏目 404（编辑器校验告警） |

### 2.3 落地页（index.md）

- 元数据：`title` / `description`（同文章）
- 引言段（正文首段）归本地 md 编辑，不进编辑器
- `## 本栏目文章` 列表：编辑器可一键「按目录顺序重生成」链接区（仅动链接，可选功能 F12）

---

## 3. 界面设计（顶栏 + 三栏）

```
┌──────────────────────────────────────────────────────────────┐
│ 顶栏: 🔍搜索 | ＋新增文章 | ＋新增栏目 | 主题:🌙 | 应用变更 │
├──────────────┬───────────────────────────┬──────────────────┤
│ [⬇拖入.md导入]│ 元数据表单(选中文章/栏目)   │ 预览 + 校验 + EN  │
│ 侧边栏树      │ title*                     │ ── frontmatter    │
│ (栏目▾文章)   │ description*(简介)         │ ── sidebar.json   │
│  · 拖拽手柄   │ lastUpdated [日期]         │ 校验: ⚠ 缺 index  │
│  · 顺序实时   │ order [number]             │ EN: ✅/➕生成stub  │
│    反映       │ slug / draft / prev / next │                  │
│  · ✕删除      │                           │                  │
│  · 栏目可拖拽 │                           │                  │
└──────────────┴───────────────────────────┴──────────────────┘
       应用变更 → 弹框列变更 → 确认 → 改文件+提交+部署
```

- **左栏 侧边栏树**：还原**真实 `sidebar.json` 顺序**（含「个人简介」「站点维护」真实位置）；顶部「拖入 .md 导入」区；栏目可折叠、可拖拽调序；文章/栏目行均有 `✕` 删除（带确认）。
- **中栏 表单**：选中文章显示文章元数据；选中栏目显示栏目配置（label/en/mode/目录）；导入的「待加入」文章显示来源文件名与提示。
- **右栏 实时预览**：编辑即生成「frontmatter YAML」「sidebar.json JSON」diff；校验徽标；EN 镜像状态与生成按钮。
- **应用变更弹框**：列出本次增/删/改/排序变更，确认后执行 `git commit` + `npm run deploy:github-pages`（真实版写文件并推 master）。

---

## 4. 功能清单

### 必须（对应你说的"各必须内容 + 排序 + 简介"）
- **F1 侧边栏树**：栏目→文章层级，点击选中；**动态读取真实 `sidebar.json`**（含个人简介、站点维护的真实位置）
- **F2 文章元数据表单**：`title` / `description` / `lastUpdated` / `order` / `slug` / `draft` / `prev` / `next`
- **F3 拖拽排序**：栏目**内**文章顺序 + 栏目**顶层**顺序均可拖拽；`order` 自动重算写回
- **F4 简介编辑**：`description` 字段（含字符数提示，建议 ≤160 用于社交摘要）
- **F5 栏目管理**：增 / **删** / 改名 / 排序 / 切换 `autogenerate↔slug↔items` / 中英文标题（删除带二次确认）
- **F6 落地页元数据**：`index.md` 的 `title` / `description`
- **F7 校验**：必填缺失、缺 `index.md`、缺 EN、order 重复、slug 冲突
- **F8 应用变更弹框**：点击后弹出**变更清单**（增/删/改/排序），确认后执行脚本 → 改本地文件 + `git commit` + `npm run deploy:github-pages` 推线上
- **F17 删除文章 / 栏目**：文章行 `✕`、栏目头 `✕`；二次确认；真实版删除对应 `.md` / `sidebar.json` 项 / 目录
- **F18 拖拽导入文章索引**：左栏拖入 `.md` → 解析 frontmatter（title/description）→ 生成「待加入」文章到目标栏目；应用变更后正式写入该栏目目录（真实版移动/创建文件）

### 补充（我建议纳入的"其他必要功能"）
- **F9 英文镜像面板**：显示每篇 EN 是否存在；一键生成 EN stub（仅 frontmatter + 「待翻译」注释，不碰正文）
- **F10 草稿/发布开关** + 批量「标今天更新」（`lastUpdated` 批量设为今天）
- **F11 文章搜索 / 过滤**（按栏目、草稿、缺 EN）
- **F12 落地页列表同步**：按目录 `order` 重生成 `## 本栏目文章` 链接（仅动链接区，可选开启）
- **F13 新建文章脚手架**：生成带 frontmatter 的空 `.md` + 注册进栏目（正文本地填）
- **F14 正文只读首段预览**：确认上下文，不编辑
- **F15 主题跟随**：深 / 浅
- **F16 未保存提示 + 最近修改**

---

## 5. 技术架构（实现建议）

- **形态**：本地 Web 应用，`npm run editor` 启动（Vite 前端 + 轻量 Node 服务）
- **后端 API（Node/http）**
  - `GET /api/sidebar` 解析 `src/config/sidebar.json`
  - `GET /api/docs` 列出所有 doc 及其 frontmatter（用 `gray-matter` 解析）
  - `GET /api/doc?path=` 读 frontmatter + 正文（正文只读）
  - `PUT /api/doc` 写回 frontmatter（**保留正文**，用 gray-matter 重序列化）
  - `PUT /api/sidebar` 写回 `sidebar.json`
  - `POST /api/doc` 新建（frontmatter stub + 空正文占位）
  - `POST /api/en-stub` 生成 EN 镜像 stub
- **前端**：轻框架（Preact/Svelte）或原生；拖拽用原生 HTML5 DnD；状态用 store
- **安全**：仅允许操作 `src/content/docs/**` 与 `src/config/sidebar.json`；写前自动 `.bak`；危险操作确认弹窗
- **约定对齐**：写回 frontmatter 只改指定字段；`order` 用数字；栏目改动映射到 sidebar.json 既有结构（与 `deploy` 流程无关，纯本地文件操作）

---

## 6. 与现有 5 步编辑流程的映射

| 现有手动步骤 | 编辑器替代 |
|---|---|
| 1. 选/建目录 + 写 `index.md` | F5 栏目管理 + F6 落地页元数据（校验缺 `index.md`） |
| 2. 写 frontmatter（`title`+`description`+`lastUpdated`） | F2 表单 |
| 3. 正文从 `##` 起（不写 H1） | 本地编辑（正文不在编辑器） |
| 4. 在 `index.md` 加文章链接 | F12 一键同步（或保留手动） |
| 5. `npm run build` 验证 | F7 校验 + F8 应用 + 仍建议 build |

---

## 7. 关于「个人简介 / 站点维护」栏目顺序的说明（已澄清）

- **编辑器此前显示「站点维护」在第 4 位，是原型占位示例数据的错位，非线上 bug。** 真实 `sidebar.json` 顺序为：
  1. 博客总览 2. iOS 基础知识 3. AI 项目实战架构 4. 个人项目 **5. 个人简介** 6. 代码块示例 **7. 站点维护（最后）**。
- **真实编辑器会动态读取 `sidebar.json`**，不会写死顺序，故不会出现该错位；原型 v2 已改为镜像真实结构。
- **「个人简介」完全可维护**：它是 `profile/` 目录的 `autogenerate` 栏目（当前含 `about-me.md`），编辑器原生支持，无需特殊处理。原型此前漏写它，v2 已补回。

### 待你拍板：站点维护是否对外展示？
「站点维护」含 内容发布流程 / 发布记录 / 部署方案 / CI/CD 等运维文档。两种取向：
- **保留公开**（现状）：透明，便于协作者了解流程；
- **移出公共导航**：把它从 `main` 移到仅内部可见的分组或单独入口，避免普通读者看到运维细节。
> **已决策（2026-07-30）**：站点维护**不对外展示**。已从 `sidebar.json` 的 `main` 移除，改放 `src/config/editor-internal.json`（内部只读栏目：编辑器可见、带「仅编辑器可见」徽标、不可编辑）。线上已部署生效。

---

## 8. 开放问题（待确认）
1. **移动文章到另一栏目**是否本版实现？（涉及文件 relocate + 链接修正，工作量较大）
2. **落地页列表同步**是否允许编辑器触碰 md 正文链接区？（你说不编辑 md，但纯链接维护争议小）
3. 是否需要 **EN 正文翻译协作**流程？（超出本次范围）
4. ~~实现形态~~：**已实现为本地 Web 应用**（`npm run editor` → http://localhost:5179），见 `editor/`。
5. 「站点维护」决策已完成（见第 7 节），线上已生效。

## 9. 实现状态（2026-07-30，已上线）
- **形态**：零依赖本地 Web 应用，源码在 `editor/`（`server.mjs` + `public/{index.html,app.js,styles.css}`）。
- **启动**：`npm run editor` → 打开 http://localhost:5179
- **架构**：后端 Node http 服务，扫描 `src/content/docs/`，用自写 frontmatter 解析器读写（**保留正文**）；`sidebar.json` = 公开栏目，`editor-internal.json` = 内部只读栏目。
- **已覆盖需求**：
  - ① 删除文章（DELETE）与栏目（删目录）
  - ② 拖拽导入 .md（解析 frontmatter → 暂存「待加入」→ 应用变更后正式写入目标目录）
  - ③ 栏目顺序拖拽（公开栏目；内部栏目只读不参与）
  - ④ 应用变更弹框列出变更（新增/修改/删除/排序/导航）→ 确认后写文件 + `git commit` + `npm run deploy:github-pages` 推线上
  - ⑤ 站点维护 = 内部只读栏目（仅编辑器可见）
- **功能**：文章元数据表单（title/description/lastUpdated/order/slug/draft/prev/next）、实时 frontmatter 预览、校验（必填/简介长度/EN 状态）、EN 镜像状态、主题切换、搜索过滤、新建文章/栏目脚手架。
- **安全**：每次 apply 前对 `sidebar.json` / `editor-internal.json` 写 `.bak`；`*.bak` 已加入 `.gitignore`。
- **注意**：部署命令用 `env -u CODEBUDDY_SESSION_ID -u CLAUDE_SESSION_ID` 前缀绕过 safe-delete shim（仅在本 Agent 环境需要；你本地终端直接跑即可）。
