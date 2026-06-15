---
title: 项目结构
description: 面向扩展和长期维护的目录约定。
---

## 推荐分层

- `src/content/docs/getting-started/`: 上手文档
- `src/content/docs/architecture/`: 架构设计与 ADR
- `src/content/docs/content/`: 内容生产规范
- `src/content/docs/operations/`: 部署和发布
- `src/content/docs/migration/`: 迁移历史

## 新增模块规范

1. 在 `src/content/docs/<module>/` 新建目录。
2. 在 `src/config/sidebar.json` 增加 `autogenerate` 规则。
3. 如需顶部导航，更新 `src/config/menu.root.json`。
4. 如需多语言，在 `src/content/docs/en/<module>/` 增加对应文档。
