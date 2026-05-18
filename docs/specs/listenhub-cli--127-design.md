# Spec: CLI 支持 SeeDance2.0 视频生成

> Issue: marswaveai/listenhub-ralph#127

## 背景

SDK 0.0.6 已封装 SeeDance2.0 视频生成 API（`v1/video-generation/*`），CLI 需要同步暴露对应命令，让用户通过终端即可创建视频任务、查看任务状态、列出历史任务和预估积分消耗。

## 目标

在 `listenhub-cli` 中新增 `video` 命令组，覆盖 SeeDance2.0 全部核心操作。

## 新增模块

```
source/video/_cli.ts   — Commander 注册
source/video/video.ts  — 业务逻辑
```

`source/cli.ts` 新增 `registerVideo` 导入。

## 命令设计

### `listenhub video create`

创建视频生成任务。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--prompt <text>` | string | 是 | — | 视频描述文本 |
| `--model <model>` | string | 否 | `doubao-seedance-2-pro` | 模型：`doubao-seedance-2-pro` / `doubao-seedance-2-fast` |
| `--resolution <res>` | string | 否 | `720p` | 分辨率：`480p` / `720p` / `1080p` |
| `--ratio <ratio>` | string | 否 | `16:9` | 画面比例：`16:9` / `4:3` / `1:1` / `3:4` / `9:16` / `21:9` |
| `--duration <seconds>` | number | 否 | — | 视频时长（秒），不传则使用服务端默认 |
| `--first-frame <path-or-url>` | string | 否 | — | 首帧图片，本地文件或 URL |
| `--last-frame <path-or-url>` | string | 否 | — | 末帧图片 |
| `--reference-image <path-or-url>` | string | 否 | — | 参考图，可重复 |
| `--reference-video <path-or-url>` | string | 否 | — | 参考视频，本地文件或 URL |
| `--reference-audio <path-or-url>` | string | 否 | — | 参考音频 |
| `--generate-audio` | boolean | 否 | `false` | 是否生成音轨 |
| `--seed <number>` | number | 否 | — | 随机种子 |
| `--no-wait` | boolean | — | — | 提交后立即返回，不轮询 |
| `--timeout <seconds>` | number | 否 | `600` | 轮询超时 |
| `-j, --json` | boolean | — | — | JSON 输出 |

**行为：**
1. 解析 `--prompt` 为 `VideoContentText`。
2. 依据 `--first-frame`/`--last-frame`/`--reference-image`/`--reference-video`/`--reference-audio` 构建 `content[]`，本地文件通过 `resolveFileOrUrl` 上传后取 URL。
3. 调用 `client.createVideoGeneration(params)`。
4. 若 `--no-wait`，打印 `taskId` 后退出。
5. 否则轮询 `client.getVideoGenerationTask(taskId)` 直到 `success` / `failed` / 超时。
6. 成功打印视频 URL 与基本信息。

### `listenhub video get <taskId>`

获取单个任务详情。

| 参数 | 说明 |
|------|------|
| `taskId` | 位置参数 |
| `-j, --json` | JSON 输出 |

### `listenhub video list`

列出视频生成任务。

| 参数 | 默认 | 说明 |
|------|------|------|
| `--page <n>` | 1 | 页码 |
| `--page-size <n>` | 20 | 每页条数 |
| `--status <status>` | — | 可选筛选：`pending` / `generating` / `uploading` / `success` / `failed` |
| `-j, --json` | — | JSON 输出 |

### `listenhub video estimate`

预估积分消耗。

| 参数 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `--model <model>` | 是 | — | 模型 |
| `--resolution <res>` | 是 | — | 分辨率 |
| `--duration <seconds>` | 是 | — | 时长 |
| `--ratio <ratio>` | 否 | `16:9` | 比例 |
| `--has-video-input` | 否 | `false` | 是否有参考视频 |
| `--input-video-duration <s>` | 否 | — | 参考视频时长 |
| `-j, --json` | — | — | JSON 输出 |

## 改动点

| 文件 | 改动 |
|------|------|
| `source/video/_cli.ts` | 新增 — Commander 命令注册 |
| `source/video/video.ts` | 新增 — create / get / list / estimate 逻辑 |
| `source/cli.ts` | 添加 `registerVideo` |
| `source/_shared/polling.ts` | 新增 `pollVideoTaskUntilDone` |
| `source/_shared/upload.ts` | 扩展支持 `video` 类型（`.mp4`/`.mov`/`.webm`，上限 100MB） |
| `package.json` | 升级 `@marswave/listenhub-sdk` 到 `^0.0.6` |
| `README.md` | 添加 `video` 命令说明与示例 |

## 上传扩展

`resolveFileOrUrl` 需要新增 `video` 文件类型：
- 允许后缀：`.mp4`、`.mov`、`.webm`
- 最大体积：100 MB
- MIME：`video/mp4`、`video/quicktime`、`video/webm`
- category：`banana`（同 image）

## 轮询策略

视频生成较慢，采用：
- 间隔 10s（同现有全局 `pollIntervalMs`）
- 默认超时 600s（10 分钟）
- 终态：`success` / `failed`

## 错误处理

- SDK 返回的 `VideoGenerationErrorCode` 映射为可读消息输出。
- 与现有模块保持一致：`handleError(error, options.json)` 统一格式。

## 验收标准

1. `listenhub video create --prompt "..." ` 可成功创建任务并轮询到最终结果。
2. `listenhub video list` 正确展示历史任务列表。
3. `listenhub video get <taskId>` 输出任务详情。
4. `listenhub video estimate --model ... --resolution ... --duration ...` 输出积分预估。
5. 本地文件（图片/视频/音频）通过 `--first-frame`/`--reference-video` 等参数上传成功。
6. `--json` 模式输出合法 JSON。
7. `pnpm lint` 无错误。
8. README 包含 `video` 命令最小可用示例。
