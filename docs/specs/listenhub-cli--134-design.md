# Feature: 支持 OpenAPI Key 调用方式

> Issue: marswaveai/listenhub-ralph#134
> Repo: listenhub-cli
> Date: 2026-05-18

## 概述

为 listenhub-cli 新增 `openapi` 子命令组，让用户通过 API Key 认证调用 ListenHub OpenAPI 服务。与现有 OAuth 命令完全隔离，复用 SDK 的 `OpenAPIClient`。

## 前置依赖

- listenhub-sdk 已发布包含 `OpenAPIClient` 的版本（#133 合并后）
- CLI 需升级 `@marswave/listenhub-sdk` 到最新版

## 认证与配置

### API Key 存储

- 路径：`~/.config/listenhub/openapi.json`（与 OAuth 的 `credentials.json` 平级）
- 格式：`{ "apiKey": "lh_sk_<keyId>_<secret>" }`
- 文件权限：0600（atomic write via tmp + rename）

### Key 来源优先级（高→低）

1. `LISTENHUB_API_KEY` 环境变量
2. 本地配置文件 `~/.config/listenhub/openapi.json`

### 管理命令

| 命令 | 行为 |
|------|------|
| `listenhub openapi config set-key` | 交互式输入 API Key，校验 `lh_sk_` 前缀后存入本地 |
| `listenhub openapi config show` | 显示 Key 来源（env/file）和脱敏 Key ID |
| `listenhub openapi config clear` | 删除本地配置文件 |

### 客户端工厂

`source/openapi/client.ts` 导出 `getOpenAPIClient()`：
- 按优先级读取 Key
- 实例化 SDK 的 `OpenAPIClient({ apiKey })`
- Key 不存在时抛出错误，提示运行 `openapi config set-key` 或设置环境变量

## 命令结构

所有命令挂在 `listenhub openapi` 下：

### Config
```
listenhub openapi config set-key
listenhub openapi config show
listenhub openapi config clear
```

### Speakers
```
listenhub openapi speakers list [--language <lang>]
```

### TTS（流式二进制，OpenAI 兼容）
```
listenhub openapi tts --text <text> --voice <speakerId> --output <file> [--format mp3|opus|aac|flac|wav|pcm]
```
- 调用 `client.tts(params)`（路由 `POST /v1/tts`）→ 返回 binary Response stream
- 必须指定 `--output`，写入文件后打印路径和大小
- 同时注册别名命令 `listenhub openapi audio-speech`（路由 `POST /v1/audio/speech`），参数完全相同
- 两个命令的区别仅在于后端路由，`audio-speech` 是 OpenAI `/v1/audio/speech` 兼容路由

### Speech（JSON 响应，异步）
```
listenhub openapi speech --script <content> --speaker-id <id> [-j]
```
- 调用 `client.speech(params)` → 返回 `{ audioUrl, audioDuration, subtitlesUrl, taskId, credits }`
- 同步返回结果，无需 polling

### Flow Speech
```
listenhub openapi flow-speech create --source-url <url>|--source-text <text> --speaker-id <id> [--mode smart|direct] [--lang <lang>] [--no-wait] [--timeout <s>] [-j]
listenhub openapi flow-speech get <episodeId> [-j]
listenhub openapi flow-speech tts --script <content> --speaker-id <id> [--title <title>] [--no-wait] [--timeout <s>] [-j]
listenhub openapi flow-speech text-stream <episodeId> --event script|outline
```

### Podcast
```
listenhub openapi podcast create --query <text>|--source-url <url>|--source-text <text> --speaker-id <id> [--mode <mode>] [--lang <lang>] [--no-wait] [--timeout <s>] [-j]
listenhub openapi podcast get <episodeId> [-j]
listenhub openapi podcast text-content --query <text>|--source-url <url> --speaker-id <id> [--mode <mode>] [--no-wait] [--timeout <s>] [-j]
listenhub openapi podcast generate-audio <episodeId> [--no-wait] [--timeout <s>] [-j]
listenhub openapi podcast text-stream <episodeId> --event script|outline
```

### Storybook
```
listenhub openapi storybook create --source-url <url>|--source-text <text> [--speaker-id <id>] [--skip-audio] [--style <style>] [--mode info|story|slides] [--lang <lang>] [--no-wait] [--timeout <s>] [-j]
listenhub openapi storybook get <episodeId> [-j]
listenhub openapi storybook generate-video <episodeId> [-j]
```

### Image
```
listenhub openapi image create --prompt <text> --provider <p> [--model <m>] [--size 1K|2K|4K] [--ratio 16:9|4:3|1:1|3:4|9:16|21:9] [--reference <path-or-url>]... [-j]
```
- `--reference` 可重复，接受本地文件路径或已上传的 fileUri
- 本地文件：CLI 读取后 base64 编码，通过 `inlineData` 传入（自动检测 mimeType）
- URL/fileUri：通过 `fileData.fileUri` 传入

### Video
```
listenhub openapi video create --prompt <text> [--first-frame <url>] [--last-frame <url>] [--reference-image <url>]... [--reference-video <url>]... [--reference-audio <url>]... [--input-video-duration <s>] [--model doubao-seedance-2-pro|doubao-seedance-2-fast] [--resolution 480p|720p|1080p] [--ratio <r>] [--duration <s>] [--no-generate-audio] [--seed <n>] [--no-wait] [--timeout <s>] [-j]
listenhub openapi video get <taskId> [-j]
listenhub openapi video list [--page <n>] [--page-size <n>] [--status <s>] [-j]
listenhub openapi video estimate --model <m> --resolution <r> --duration <s> [--has-video-input] [--input-video-duration <s>] [--ratio <r>] [-j]
```
- 命名沿用现有 `video create` 的 flag 风格：`--first-frame`、`--last-frame`、`--reference-image`、`--reference-video`、`--reference-audio`
- Frame 模式和 Reference 模式互斥（与现有 OAuth video 命令行为一致）
- `--reference-video` 需要配合 `--input-video-duration`
- **仅接受 URL**（不支持本地文件上传）：OpenAPIClient 无 file upload 能力，本地文件需用户自行上传后传 URL。这与现有 OAuth video 命令不同（OAuth 版支持 `resolveFileOrUrl()`）

### Content Extract
```
listenhub openapi content extract --url <url> [--summarize] [--max-length <n>] [--no-wait] [--timeout <s>] [-j]
listenhub openapi content get <taskId> [-j]
```

### Subscription
```
listenhub openapi subscription [-j]
```

## 通用 Flags

**JSON 响应类命令支持：**
- `-j, --json` — JSON 格式输出

不适用于 `tts`/`audio-speech`（二进制输出到文件）和 `text-stream`（SSE 流输出到 stdout）。

**仅异步创建/提取类命令支持（flow-speech create/tts, podcast create/text-content/generate-audio, storybook create, video create, content extract）：**
- `--no-wait` — 不轮询，立即返回 ID
- `--timeout <seconds>` — polling 超时，默认 300s

## 文件结构

```
source/openapi/
├── _cli.ts              # 注册 openapi Command 子组，挂载所有子命令
├── client.ts            # getOpenAPIClient(): 读 config/env → new OpenAPIClient(opts)
├── config.ts            # loadOpenAPIConfig / saveOpenAPIConfig / deleteOpenAPIConfig
├── config-cmd.ts        # config set-key / show / clear 实现
├── speakers.ts          # speakers list
├── tts.ts               # tts (streaming) + speech (JSON)
├── flow-speech.ts       # flow-speech create / get / tts / text-stream
├── podcast.ts           # podcast create / get / text-content / generate-audio / text-stream
├── storybook.ts         # storybook create / get / generate-video
├── image.ts             # image create
├── video.ts             # video create / get / list / estimate
├── content.ts           # content extract / get
└── subscription.ts      # subscription
```

## 入口注册

在 `source/cli.ts` 新增：
```ts
import {register as registerOpenApi} from './openapi/_cli.js';
registerOpenApi(program);
```

## Polling 适配

复用 `_shared/polling.ts` 的 spinner 机制。每个异步命令传入对应的 `getStatus` 回调：

| 命令 | Detail 接口 | 完成条件 | 失败条件 |
|------|------------|---------|---------|
| flow-speech create | `client.getFlowSpeech(id)` | `processStatus === 'success'` | `processStatus === 'failed'` |
| flow-speech tts | `client.getFlowSpeech(id)` | `processStatus === 'success'` | `processStatus === 'failed'` |
| podcast create | `client.getPodcast(id)` | `processStatus === 'success'` | `processStatus === 'failed'` |
| podcast text-content | `client.getPodcast(id)` | `contentStatus === 'text-success'` | `contentStatus === 'text-fail'` |
| podcast generate-audio | `client.getPodcast(id)` | `contentStatus === 'audio-success'` | `contentStatus === 'audio-fail'` |
| storybook create | `client.getStorybook(id)` | `processStatus === 'success'` | `processStatus === 'failed'` |
| video create | `client.getVideoGenerationTask(id)` | `status === 'success'` | `status === 'failed'` |
| content extract | `client.getContentExtract(id)` | `status === 'completed'` | `status === 'failed'` |

### Podcast 两阶段说明

Podcast 支持两阶段创建：
1. `text-content` 只生成文本脚本（不生成音频），通过 `contentStatus === 'text-success'/'text-fail'` 判断完成
2. `generate-audio` 对已有脚本的 episode 生成音频，通过 `contentStatus === 'audio-success'/'audio-fail'` 判断完成
3. 直接 `create` 是一步到位（脚本 + 音频），通过 `processStatus === 'success'/'failed'` 判断完成

### Text Stream 说明

`flow-speech text-stream` 和 `podcast text-stream` 调用 SDK 的 `getFlowSpeechTextStream()`/`getPodcastTextStream()`，返回 SSE 流。CLI 将流内容输出到 stdout，适合管道使用。`--event` 参数选择 `script`（生成的脚本）或 `outline`（大纲）。

失败时打印 `message` + `failCode`，退出码 1。

## 错误处理

- SDK 的 `ListenHubError` 已标准化：`{ status, code, message, requestId }`
- CLI 层复用 `_shared/output.ts` 的 `handleError` 统一格式化
- 401 → 提示 "API Key invalid or expired. Run `listenhub openapi config set-key`."
- 429 → SDK 内置 retry（最多 2 次），CLI 无需额外处理
- 网络错误 → 标准 error 输出

## 退出码

复用现有 `_shared/output.ts` 的 `handleError`，退出码保持一致：

| Code | 含义 |
|------|------|
| 0 | 成功 |
| 1 | 一般错误（API 错误、参数错误） |
| 2 | 认证失败（401/403，API Key 无效或过期） |
| 3 | Polling 超时 |

## 与现有命令的隔离

- `openapi` 子命令组不依赖 OAuth token，不调用 `_shared/client.ts` 的 `getClient()`
- 现有 OAuth 命令不受影响
- 两套认证系统完全独立，用户可以同时配置但各走各的路径

## 输出格式

### 默认（人类可读）

异步任务完成后打印关键信息：
```
Episode created: abc123
Status: success
Audio: https://...
Duration: 3m 25s
Credits: 12
```

### JSON 模式（-j）

输出 SDK 返回的完整 JSON 对象，方便管道处理。

## 测试策略

- 单元测试：config 读写、Key 校验、client factory
- 集成测试：mock SDK OpenAPIClient，验证每个命令的参数传递和输出格式
- 手动验证：实际 API Key 跑几个核心命令（tts、podcast create、subscription）
