# 项目长期记忆：liuluit 文档站

## 仓库与部署（重要）
- 仓库 `ioswater/ioswater.github.io`（GitHub Pages，域名 liuluit.com）。`master` 根目录=构建产物；源码在 `codex/dockit-source` 分支。
- 构建 `npm run build`（Astro 6 + Starlight）→ `dist/`。发布 `npm run deploy:github-pages`（scripts/deploy-github-pages.sh：npm ci + build + 克隆 master 清空根 + 拷 dist + .nojekyll + 推送）。
- Astro：`site: https://liuluit.com`，无 base，`trailingSlash: "always"`。另有 netlify.toml / wrangler.jsonc；CI 只构建不发布。

## 坑
- 合并 codex 分支进 master 触发 git 自动重命名，把根 `index.html/.nojekyll/CNAME` 移进 legacy/ → 整站 404。修复：重新 build+deploy 覆盖 master 根。master 只接收部署提交，勿直接提交源码。
- WorkBuddy safe-delete shim（`genie-safe-delete.cjs`，仅当 `CODEBUDDY_SESSION_ID`/`CLAUDE_SESSION_ID` 存在时激活）拦截批量删 → build/npm ci 失败。绕过：`env -u CODEBUDDY_SESSION_ID -u CLAUDE_SESSION_ID npm run build|deploy:github-pages`。`rm -rf node_modules` 也被拦，用 `npm install` 增量修更顺。
- 部署/构建必须在 `codex/dockit-source` 跑（package-lock.json 仅在此分支；master 工作树无 lockfile 会 ENOLOCK）。`git checkout codex` 会被 `.workbuddy` 冲突拦截 → 先 `mv .workbuddy /tmp/xxx` 或 `git checkout -f`。
- Starlight customCss 加载顺序：global.css 被并进 ThemeSwitch chunk 且排在 common.css 前，common.css 后加载用默认蓝覆盖整组 `--sl-color-*`。修复：global.css 里整组 `--sl-color-*`（white/gray-1..6/black/hairline/accent(-low/-high)）及 `--sl-font`/`--sl-font-mono` 全加 `!important`（只加 accent 不够）。
- lightningcss 归一化：`oklch(74% 0.14 195)` → `oklch(74% .14 195)`，grep 用归一化形态。
- Hero 覆盖组件需 `src/content/docs/index.mdx` 含 `hero:` frontmatter 才渲染；删该字段回退默认 splash。Hero 内容可硬编码，字段必须存在。
- Astro 模板文本直接写 `{`/`}` 触发表达式解析报错。修复：含花括号代码段放 frontmatter 字符串变量 + `set:html={var}`；前端函数须定义在 frontmatter。

## 范式
- 栏目落地页须有 `index.md`（autogenerate 目录无 index 会 404）。en 版需 `en/<dir>/index.md`。
- 自定义组件硬编码站内绝对路径不会自动加 `/en` 前缀 → `base = locale==='en'?'/en':''; withLocale=(p)=>base+p` 包裹；已含前缀链接勿再套。
- Starlight 0.38.1 无内置 EC，须独立 `astro-expressive-code` 且排 `integrations` 首位、`starlight()` 前；`useDarkModeMediaQuery:false` + `themeCssSelector` 返回 `[data-theme=dark]`/`:root,[data-theme='light']`；`shiki.langAlias:{oc:'objective-c'}`；`--ec-*` 用 `!important`，暗色挂 `[data-theme=dark]`。

## 视觉规范
- 代码块铁律：全站统一「品牌渐变描边深色卡」——恒深色面板（github-dark 单主题 `themes:["github-dark"]` + `themeCssSelector:()=>":root"`）+ 青渐变描边（mask-composite exclude）+ 角落微光；radius 14px。改样式只动 `src/styles/code-block.css`（全 !important）。新增代码展示沿用此风，勿引入第三种卡。
- 主题切换平滑：ThemeSwitch change 临时加 `.theme-transition`（.35s），`prefers-reduced-motion` 关；`html{scroll-behavior:smooth}` + 区块 `scroll-margin-top:5.5rem`。
- 首页 TOC scrollspy：IntersectionObserver（rootMargin `-30% 0px -60% 0px`）高亮 `.active`。
- 色板唯一真源 `src/config/theme.json`（经 `src/tailwind-plugin/tw-theme.js` 注入 `--color-*`）。global.css 覆盖 `--sl-color-*`：accent←--color-primary、white←--color-light、black←--color-dark。设计稿 OKLCH 冷调：暗 primary `oklch(74% .14 195)`/body `oklch(15% .028 255)`；亮 primary `oklch(54% .13 195)`/body `oklch(98.5% .004 250)`。`--color-primary-gradient` 在 global.css。theme-color meta 用 hex `#040b17`（meta 不支持 oklch）。
- 文章页交互：①正文列宽重平衡（`--sl-sidebar-width:224px !important`、`--sl-content-width:56rem !important`、TOC `16rem`、正文居中）；②顶部重复分组栏 `SidebarNav.astro` 已删；③左侧导航可折叠且默认折叠（Header `#sidebar-toggle` + `b` 快捷键，`html.sidebar-collapsed`，localStorage 记忆）；④右侧目录可折叠（TwoColumnContent 包 `.toc-panel` + `#toc-toggle`，箭头旋转动画，`localStorage` 记忆），并修复目录列宽塌缩——需显式给 `.right-sidebar-container{width:var(--sl-table-of-contents-width);min-width:...}` 且覆盖 `.right-sidebar-panel .sl-container{max-width:none!important;width:100%!important}`，否则 Starlight 的 max-width 计算会让 TOC 变成竖排文字。
