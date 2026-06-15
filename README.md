# LiuLuit Docs

基于 **Dockit - Astro** 的文档站重构版本，面向长期维护、可扩展和稳定发布。

## 技术栈

- Astro 6
- Starlight
- Tailwind CSS 4
- Dockit override components

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 目录约定

- `src/content/docs/`：文档内容（按模块拆分）
- `src/config/`：导航、主题、站点配置
- `src/components/override-components/`：Starlight UI 覆盖层
- `legacy/hexo-export/`：旧 Hexo 静态导出归档

## 发布

1. 代码合并到 `master`/`main`
2. CI 自动执行 `npm run check` + `npm run build`
3. 托管平台（Netlify/Vercel/Cloudflare）自动拉取并发布 `dist`

## GitHub Pages（liuluit.com）发布方式

当前域名 `liuluit.com` 指向 `ioswater.github.io`（GitHub Pages）。

- 源码开发分支：`codex/dockit-source`
- 线上发布分支：`master`（仅静态产物）

一键发布脚本：

```bash
npm run deploy:github-pages
```

脚本会自动执行：

1. `npm ci` + `npm run build`
2. 克隆远端 `master`
3. 用 `dist/` 全量替换并推送

## 后续扩展建议

- 新模块：在 `src/content/docs/<module>/` 增加目录并配置 sidebar autogenerate
- 多语言：在 `src/content/docs/en/` 增加对应英文页面
- 版本化文档：在 `content/release-notes` 记录发布历史，必要时拆分版本目录
