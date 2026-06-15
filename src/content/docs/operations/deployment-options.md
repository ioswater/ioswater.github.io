---
title: 部署方案
description: 免费托管的推荐方式与取舍。
---

## 方案对比

- Netlify: 配置最简单，适合文档站快速上线。
- Vercel: 预览链接体验好，适合频繁迭代。
- Cloudflare Pages/Workers: 全球边缘性能强，适合自定义策略。

## 通用配置

构建命令:

```bash
npm run build
```

输出目录:

```bash
dist
```

Node 版本建议:

```bash
20
```

## 自定义域名

`public/CNAME` 已保留 `liuluit.com`，可继续用于静态托管绑定。
