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

| 参数                               | 类型    | 必填 | 默认值                                      | 说明                                                               |
| ---------------------------------- | ------- | ---- | ------------------------------------------- | ------------------------------------------------------------------ |
| `--prompt <text>`                  | string  | 是   | —                                           | 视频描述文本                                                       |
| `--model <model>`                  | string  | 否   | 不传（服务端默认 `doubao-seedance-2-fast`） | 模型：`doubao-seedance-2-pro` / `doubao-seedance-2-fast`           |
| `--resolution <res>`               | string  | 否   | 不传（服务端默认 `720p`）                   | 分辨率：`480p` / `720p` / `1080p`（注意：`1080p` 仅 pro 模型支持） |
| `--ratio <ratio>`                  | string  | 否   | 不传（服务端默认 `16:9`）                   | 画面比例：`16:9` / `4:3` / `1:1` / `3:4` / `9:16` / `21:9`         |
| `--duration <seconds>`             | number  | 否   | —                                           | 视频时长，范围 4–15 秒                                             |
| `--first-frame <path-or-url>`      | string  | 否   | —                                           | 首帧图片，本地文件或平台资产 URL                                   |
| `--last-frame <path-or-url>`       | string  | 否   | —                                           | 末帧图片（必须同时指定 `--first-frame`）                           |
| `--reference-image <path-or-url>`  | string  | 否   | —                                           | 参考图（可重复，最多 9 张），本地文件或平台资产 URL                |
| `--reference-video <path-or-url>`  | string  | 否   | —                                           | 参考视频（可重复，最多 3 个），本地文件或平台资产 URL              |
| `--reference-audio <path-or-url>`  | string  | 否   | —                                           | 参考音频（可重复，最多 3 个），本地文件或平台资产 URL              |
| `--input-video-duration <seconds>` | number  | 否   | —                                           | 参考视频时长，范围 2–15 秒；使用 `--reference-video` 时**必填**    |
| `--no-generate-audio`              | boolean | —    | —                                           | 禁用音轨生成（服务端默认生成音轨）                                 |
| `--seed <number>`                  | number  | 否   | —                                           | 随机种子，范围 -1 到 4294967295                                    |
| `--no-wait`                        | boolean | —    | —                                           | 提交后立即返回，不轮询                                             |
| `--timeout <seconds>`              | number  | 否   | `1200`                                      | 轮询超时                                                           |
| `-j, --json`                       | boolean | —    | —                                           | JSON 输出                                                          |

**输入模式互斥规则（CLI 端校验，不满足直接报错退出）：**

- **帧控制模式**（`--first-frame`/`--last-frame`）与**参考模式**（`--reference-image`/`--reference-video`/`--reference-audio`）不可混用。
- `--last-frame` 必须搭配 `--first-frame`。
- `--reference-audio` 不能单独使用，必须搭配 `--reference-image` 或 `--reference-video`（纯 prompt + audio 不合法）。
- 数量上限：image ≤ 9，video ≤ 3，audio ≤ 3。

**URL 约束：** 所有 `<path-or-url>` 参数仅接受本地文件路径或 ListenHub 平台资产 URL（GCS bucket / CDN）。外部 URL（如 `https://example.com/v.mp4`）会被后端拒绝。

**行为：**

1. 校验输入模式互斥规则和参数范围。
2. 解析 `--prompt` 为 `VideoContentText`。
3. 依据素材参数构建 `content[]`，本地文件通过 `resolveFileOrUrl` 上传后取平台 URL。
4. 仅在用户显式传了 `--model`/`--resolution`/`--ratio`/`--duration`/`--seed` 时才放入请求体，其余由服务端默认。`generateAudio` 仅在 `--no-generate-audio` 时传 `false`。
5. 若有 `--reference-video`，将 `--input-video-duration` 作为 `inputVideoDuration` 传入（缺失则报错）。
6. 调用 `client.createVideoGeneration(params)`。
7. 若 `--no-wait`，打印 `taskId` 后退出。
8. 否则轮询 `client.getVideoGenerationTask(taskId)` 直到 `success` / `failed` / 超时。
9. 成功打印视频 URL 与基本信息。

### `listenhub video get <taskId>`

获取单个任务详情。

| 参数         | 说明      |
| ------------ | --------- |
| `taskId`     | 位置参数  |
| `-j, --json` | JSON 输出 |

### `listenhub video list`

列出视频生成任务。

| 参数                | 默认 | 说明                                                                    |
| ------------------- | ---- | ----------------------------------------------------------------------- |
| `--page <n>`        | 1    | 页码                                                                    |
| `--page-size <n>`   | 20   | 每页条数                                                                |
| `--status <status>` | —    | 可选筛选：`pending` / `generating` / `uploading` / `success` / `failed` |
| `-j, --json`        | —    | JSON 输出                                                               |

### `listenhub video estimate`

预估积分消耗。

| 参数                         | 必填 | 默认    | 说明                                             |
| ---------------------------- | ---- | ------- | ------------------------------------------------ |
| `--model <model>`            | 是   | —       | 模型                                             |
| `--resolution <res>`         | 是   | —       | 分辨率                                           |
| `--duration <seconds>`       | 是   | —       | 时长（4–15）                                     |
| `--ratio <ratio>`            | 否   | `16:9`  | 比例                                             |
| `--has-video-input`          | 否   | `false` | 是否有参考视频                                   |
| `--input-video-duration <s>` | 否   | —       | 参考视频时长（2–15，`--has-video-input` 时必填） |
| `-j, --json`                 | —    | —       | JSON 输出                                        |

## 改动点

| 文件                        | 改动                                                       |
| --------------------------- | ---------------------------------------------------------- |
| `source/video/_cli.ts`      | 新增 — Commander 命令注册                                  |
| `source/video/video.ts`     | 新增 — create / get / list / estimate 逻辑 + 输入校验      |
| `source/cli.ts`             | 添加 `registerVideo`                                       |
| `source/_shared/polling.ts` | 新增 `pollVideoTaskUntilDone`                              |
| `source/_shared/upload.ts`  | 扩展支持 `video` 类型（`.mp4`/`.mov`/`.webm`，上限 100MB） |
| `package.json`              | 升级 `@marswave/listenhub-sdk` 到 `^0.0.6`                 |
| `README.md`                 | 添加 `video` 命令说明与示例                                |

## 上传扩展

`resolveFileOrUrl` 签名扩展为支持 category override：

```ts
resolveFileOrUrl(client, input, {accept: 'video', category: 'episode'});
```

**新增 `video` 文件类型：**

- 允许后缀：`.mp4`、`.mov`
- 最大体积：50 MB
- MIME：`video/mp4`、`video/quicktime`

**video 命令中音频素材限制：**

- 允许后缀：`.mp3`、`.wav`（SeeDance 支持范围，不含 `.flac`/`.ogg` 等）
- 最大体积：15 MB
- 在 `video.ts` 校验层额外检查后缀，不合格直接报错

**video 命令的 upload category：** 所有素材（image/video/audio）统一使用 `category=episode`（private upload）。后端 `resolveMediaUrl` 对 private bucket URL 通过 `UserFileDao` 校验所有权后签名，这是最稳妥的路径。现有 image 命令继续用 `category=banana` 不受影响。

> 技术原因：后端 `resolveMediaUrl` 只接受三种 URL —— public CDN、private bucket（需 UserFileDao 记录）、已签名 URL。虽然 banana public bucket 碰巧在白名单中，但 private upload 语义更明确且不依赖隐式行为。

## 轮询策略

视频生成较慢，采用：

- 间隔 10s（同现有全局 `pollIntervalMs`）
- 默认超时 1200s（20 分钟）
- 终态：`success` / `failed`

## CLI 端参数校验

在调用 SDK 之前，CLI 需拦截以下非法输入并给出明确错误提示：

| 规则                                                  | 错误信息                                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `--duration` 不在 4–15                                | `Duration must be between 4 and 15 seconds`                                                                                      |
| `--seed` 不在 -1 到 4294967295                        | `Seed must be between -1 and 4294967295`                                                                                         |
| `--resolution 1080p` + model 非 pro                   | `1080p resolution requires --model doubao-seedance-2-pro`                                                                        |
| `--reference-video` 存在但缺 `--input-video-duration` | `--input-video-duration is required when using --reference-video`                                                                |
| `--input-video-duration` 存在但无 `--reference-video` | `--input-video-duration requires --reference-video`                                                                              |
| `--input-video-duration` 不在 2–15                    | `Input video duration must be between 2 and 15 seconds`                                                                          |
| `--last-frame` 无 `--first-frame`                     | `--last-frame requires --first-frame`                                                                                            |
| 帧控制 + 参考混用                                     | `Cannot mix frame mode (--first-frame/--last-frame) with reference mode (--reference-image/--reference-video/--reference-audio)` |
| `--reference-audio` 无 image/video 素材               | `--reference-audio requires --reference-image or --reference-video`                                                              |
| `--reference-image` 超过 9                            | `Too many reference images (max 9)`                                                                                              |
| `--reference-video` 超过 3                            | `Too many reference videos (max 3)`                                                                                              |
| `--reference-audio` 超过 3                            | `Too many reference audios (max 3)`                                                                                              |

## 错误处理

- CLI 端校验失败：直接抛 Error，由 `handleError` 统一输出。
- SDK/后端返回的 `VideoGenerationErrorCode` 映射为可读消息。
- 与现有模块保持一致：`handleError(error, options.json)` 统一格式。

## 验收标准

1. `listenhub video create --prompt "..."` 可成功创建任务并轮询到最终结果。
2. `listenhub video create --prompt "..." --reference-video ./clip.mp4 --input-video-duration 5` 正常工作。
3. `listenhub video list` 正确展示历史任务列表。
4. `listenhub video get <taskId>` 输出任务详情。
5. `listenhub video estimate --model ... --resolution ... --duration ...` 输出积分预估。
6. 本地文件（图片/视频/音频）通过对应参数上传成功。
7. 传入外部非平台 URL 时后端拒绝，CLI 错误提示清晰。
8. 输入模式互斥校验：混用帧控制 + 参考模式时 CLI 直接报错。
9. `--no-generate-audio` 正确禁用音轨；不传时服务端默认生成音轨。
10. `--json` 模式输出合法 JSON。
11. `pnpm lint` 无错误。
12. README 包含 `video` 命令最小可用示例。
