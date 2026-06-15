---
title: 扩展点设计
description: 后续功能扩展从哪里入手。
---

## 一等扩展点

- 组件扩展: `src/components/user-components/`
- 框架覆盖: `src/components/override-components/`
- 主题配置: `src/config/theme.json`
- 内容模型: `src/content.config.ts`

## 典型扩展场景

### 增加 API 文档模块

1. 新建 `src/content/docs/api/`。
2. 在 `sidebar.json` 添加 `autogenerate`。
3. 新增 `api/index.md` 作为入口。

### 引入版本文档

1. 使用 `content/releases/` 维护版本目录。
2. 通过 `release-notes.md` 聚合链接。
3. 结合 CI 在发布时自动更新版本索引。

### 深度定制头部/页脚

在 `override-components/Header.astro` 与 `Footer.astro` 修改导航逻辑，保持配置驱动，不写死业务链接。
