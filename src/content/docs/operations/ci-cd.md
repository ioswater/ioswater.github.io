---
title: CI/CD 设计
description: 从提交到发布的自动化流程。
---

## CI 目标

- 每次提交都执行构建检查。
- 保证导航配置、MDX 语法和组件改动不会破坏站点。

## 当前流水线

仓库内置 `.github/workflows/ci.yml`:

1. 安装依赖
2. 运行 `npm run check`
3. 运行 `npm run build`

## 发布策略建议

- 生产发布: `master` 分支自动发布。
- 预览发布: PR 自动生成预览链接。
- 紧急回滚: 回退到前一个成功构建的 commit。
