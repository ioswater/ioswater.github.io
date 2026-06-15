---
title: 快速开始
description: 本地启动、调试和构建命令。
---

## 环境要求

- Node.js 20+
- Yarn 1.22+

## 本地开发

```bash
npm install
npm run dev
```

默认访问 `http://localhost:4321/`。

## 生产构建

```bash
npm run build
npm run preview
```

## 常用目录

- `src/content/docs/`: 文档正文
- `src/config/sidebar.json`: 左侧导航
- `src/config/menu.root.json`: 顶部导航与页脚
- `src/components/override-components/`: Starlight 覆盖组件
- `legacy/hexo-export/`: 旧站静态归档
