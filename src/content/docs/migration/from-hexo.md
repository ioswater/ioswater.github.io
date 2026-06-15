---
title: 从 Hexo 迁移说明
description: 旧站资源保留策略与后续迁移路径。
---

## 已完成迁移

- 原站静态文件已整体移动至 `legacy/hexo-export/`。
- 新站点已切换为 Starlight + Astro 文档架构。

## 为什么保留 legacy

- 可追溯历史页面内容。
- 便于后续把历史文章逐步转 Markdown。
- 避免一次性大迁移导致信息丢失。

## 后续迁移建议

1. 按文章批量抽取 Markdown。
2. 存放到 `src/content/docs/history/`。
3. 每迁移一批，同步更新 `release-notes`。
