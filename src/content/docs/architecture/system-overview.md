---
title: 架构总览
description: Dockit + Astro 站点的关键架构决策。
---

## 技术栈

- 框架: Astro + Starlight
- 样式: Tailwind CSS 4
- 模板: Dockit override components
- 部署: Netlify / Vercel / Cloudflare (免费层)

## 关键目标

- 内容与 UI 解耦，避免“改文档要改代码”。
- 导航自动化，减少手工维护成本。
- 发布可验证，降低线上变更风险。

## 数据流

1. Markdown/MDX 文档存放于 `src/content/docs/`。
2. `sidebar.json` 通过目录自动生成文档导航。
3. 页面通过 Starlight 渲染并由 Dockit 组件增强交互。
4. `npm run build` 输出 `dist/` 作为静态站点发布。
