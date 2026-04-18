# ListenHub-CLI 配置迁移至 vite-plus 设计文档

> Issue: marswaveai/listenhub-ralph#60
> Date: 2026-04-18

## 背景

ListenHub-SDK 已经在使用 vite-plus 作为统一工具链（构建、lint、格式化、测试、类型检查），
但 CLI 还在用 tsc + xo + Prettier 的老组合。两个包的开发体验割裂，维护成本高。

本次迁移将 CLI 的整条工具链切到 vite-plus，与 SDK 对齐。

## 目标

1. CLI 构建从 tsc 迁移到 `vp pack`，输出单文件 bundle
2. Lint 从 xo（ESLint）迁移到 `vp lint`（oxlint）
3. 格式化从 Prettier（xo 内置）迁移到 `vp fmt`（oxfmt）
4. 引入 `vp test`（vitest）测试框架
5. 静态检查统一到 `vp check`（聚合 fmt + lint + type checks）
6. SDK 升级 vite-plus 到最新版（0.1.18）

## 涉及仓库

| 仓库          | 改动范围           |
| ------------- | ------------------ |
| listenhub-cli | 全量工具链迁移     |
| listenhub-sdk | vite-plus 版本升级 |

## 设计详情

### 1. 构建迁移

**现状**：`tsc` 编译 `source/` 下 30+ 文件到 `distribution/source/`，手动 `chmod +x`。

**目标**：`vp pack` 以 `source/cli.ts` 为入口（在 `vite.config.ts` 中配置），bundle 成单文件 `dist/cli.mjs`。

变更点：

- 入口文件 `source/cli.ts` 顶部的 `#!/usr/bin/env node` shebang 保留，vp pack 打包后自动带入
- `package.json` 的 `bin` 改为 `"listenhub": "dist/cli.mjs"`
- `package.json` 的 `files` 改为 `["dist"]`
- 删除 `distribution/` 目录，更新 `.gitignore`
- tsconfig.json 简化：去掉 `outDir`、`declaration`，保留 `rootDir`、`types`、`include` 给 `vp check` 用

### 2. Lint 迁移

**现状**：xo（ESLint 封装），自定义规则在 `xo.config.mjs`。

**目标**：`vp lint`（oxlint，Rust 实现）。

变更点：

- 删除 `xo.config.mjs`
- 移除 xo 依赖
- 现有自定义规则处理：
  - `@typescript-eslint/only-throw-error: off`：绕过 xo 误报，oxlint 无此问题
  - `import-x/extensions: off`：ESM 扩展名规则，oxlint 不需要
  - `import-x/order`：oxlint 内置 import 排序支持

### 3. 格式化

**现状**：Prettier（通过 xo 内置调用）。

**目标**：`vp fmt`（oxfmt，Rust 实现）。

变更点：

- 首次运行会重新格式化全部代码，产生一次性大 diff
- 后续开发使用 `vp fmt` 保持格式一致

### 4. 测试框架

**现状**：CLI 没有单元测试，`pnpm test` 实际上只跑 xo lint（是质量门，不是测试）。

**目标**：引入 vitest 框架，搭好骨架。

变更点：

- 创建 `vitest.config.ts`，参考 SDK 配置
- 不在本次迁移中编写测试用例
- `test` script 改为 `vp test run`

**行为变化**：迁移后 `pnpm test` 在没有测试文件时会直接通过（或报"无测试"），不再起到原来 lint gate 的作用。为保持提交前的质量门不中断，新增 `ready` 脚本聚合所有检查：

```json
{
  "ready": "vp check && vp test run"
}
```

`pnpm ready` 承接原来 `pnpm test` 的"提交前跑一遍"语义。

### 5. package.json scripts

```json
{
  "dev": "vp pack --watch",
  "build": "vp pack",
  "lint": "vp lint",
  "lint:fix": "vp lint --fix",
  "fmt": "vp fmt",
  "fmt:check": "vp fmt --check",
  "check": "vp check",
  "test": "vp test run",
  "test:watch": "vp test",
  "ready": "vp check && vp test run",
  "prepublishOnly": "pnpm run build"
}
```

### 6. 依赖变更

**新增 devDependencies**：

- `vite-plus: ^0.1.18`
- `vite: ^8.0.3`
- `vitest: ^2.0.0`

**降级 devDependencies**：

- `typescript`：从 `^6.0.2` 降级到 `^5.9.3`，与 SDK 对齐。vite-plus-core 的 peer dependency 要求 `typescript: ^5.0.0`，CLI 当前的 6.x 不在范围内。同时移除 `package.json` 中的 `pnpm.overrides.typescript` override

**移除 devDependencies**：

- `xo`
- `@sindresorhus/tsconfig` 保留（SDK 也在用，与 vp check 兼容）

**运行时依赖不变**：

- `@marswave/listenhub-sdk`
- `commander`
- `open`
- `ora`

### 7. SDK 升级

- `vite-plus` 从 `^0.1.14` 升级到 `^0.1.18`
- 其他不动

### 8. tsconfig.json（迁移后）

默认保留 `@sindresorhus/tsconfig` extends（SDK 也在用），去掉 tsc 编译相关字段：

```json
{
  "extends": "@sindresorhus/tsconfig",
  "compilerOptions": {
    "rootDir": "source",
    "types": ["node"]
  },
  "include": ["source"]
}
```

### 9. vite.config.ts（新增）

所有 vp 子命令（pack、lint、fmt、check）的行为集中到 `vite.config.ts`，不依赖 CLI 参数传递：

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["source/cli.ts"],
    platform: "node",
    format: ["esm"],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
```

配置要点：

- `pack.entry`：固定入口为 `source/cli.ts`，输出到 `dist/cli.mjs`
- `pack.platform: 'node'`：Node 内置模块自动 external
- `pack.format: ['esm']`：保持 ESM only，与现有 `"type": "module"` 一致
- `lint.options.typeAware`：启用 type-aware linting
- `lint.options.typeCheck`：让 `vp check` 包含 TypeScript 类型检查
- fmt 使用默认配置即可，不需要额外设置

## 验证标准

1. `pnpm build` 成功产出 `dist/cli.mjs`
2. `dist/cli.mjs` 可直接执行：`node dist/cli.mjs --help`
3. `pnpm check` 通过（聚合 fmt + lint + type checks）
4. `pnpm ready` 通过（check + test，承接原来 `pnpm test` 的质量门）
5. `listenhub auth login` → `listenhub podcast list` 端到端正常工作
6. SDK 升级后 `pnpm build` 和 `pnpm test` 通过

## 风险与应对

| 风险                                                        | 影响 | 应对                                                              |
| ----------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| vp pack 打包 CLI 后运行时报错（动态 import、Node 内置模块） | 阻塞 | 配置 externals 排除 Node 内置模块；动态 import 用 `import()` 保留 |
| oxlint 规则与现有代码冲突多                                 | 低   | `vp lint --fix` 自动修复大部分问题                                |
| oxfmt 格式化结果与 Prettier 差异大                          | 低   | 一次性 diff，审核后接受即可                                       |
| @sindresorhus/tsconfig 与 vp check 不兼容                   | 低   | 移除 preset，手动配置 strict flags                                |

## 不做的事

- 不写测试用例（只搭框架）
- 不改业务逻辑
- 不改 SDK 的 API 接口
- 不改认证流程或凭据存储方式
