# ListenHub CLI 设计规格

## 概述

为 `@marswave/listenhub-sdk` 创建独立的命令行封装 `@marswave/listenhub-cli`，让 skills 和其他自动化工具能通过 CLI 调用 ListenHub API，替代目前的 curl + jq 方式。

**仓库：** `marswaveai/listenhub-cli`  
**包名：** `@marswave/listenhub-cli`  
**CLI 命令：** `listenhub`  
**关联 Issue：** marswaveai/listenhub-ralph#41  
**阻塞：** marswaveai/listenhub-ralph#32（skills 仓库重构）

## 技术选型

| 选择 | 方案 | 理由 |
|------|------|------|
| CLI 框架 | Commander.js | 与 coli 一致的团队惯例 |
| HTTP 层 | `@marswave/listenhub-sdk` | 不重复造轮子，SDK 已处理 response 解包 / 错误 / 429 重试 |
| Token 存储 | `$XDG_CONFIG_HOME/listenhub/` 或 `~/.config/listenhub/` | XDG 规范，MVP 只支持 macOS + Linux |
| 输出格式 | `--json` flag | 默认 human-readable，`--json` 输出结构化 JSON |
| Spinner | ora | 轻量，polling 进度展示 |
| 浏览器打开 | open | 跨平台 OAuth 回调 |
| 构建 | ESM + TypeScript + xo | 与 coli 一致 |
| Node | >= 20 | 与 SDK 一致 |

## 项目结构

```
listenhub-cli/
├── source/
│   ├── cli.ts                  # 入口，注册所有命令
│   ├── auth/
│   │   ├── _cli.ts             # auth login / logout / status
│   │   ├── credentials.ts      # token 读写 + 自动刷新
│   │   └── login-server.ts     # 本地 HTTP server 接收 OAuth callback
│   ├── podcast/
│   │   ├── _cli.ts             # podcast create / list
│   │   └── podcast.ts
│   ├── tts/
│   │   ├── _cli.ts             # tts create / list
│   │   └── tts.ts
│   ├── explainer/
│   │   ├── _cli.ts             # explainer create / list
│   │   └── explainer.ts
│   ├── slides/
│   │   ├── _cli.ts             # slides create / list
│   │   └── slides.ts
│   ├── image/
│   │   ├── _cli.ts             # image create / list
│   │   └── image.ts
│   ├── speakers/
│   │   ├── _cli.ts             # speakers list
│   │   └── speakers.ts
│   ├── creation/
│   │   ├── _cli.ts             # creation get / delete
│   │   └── creation.ts
│   ├── _shared/
│   │   ├── client.ts           # 获取已认证的 ListenHubClient 实例
│   │   ├── polling.ts          # 通用 polling 逻辑
│   │   ├── output.ts           # JSON / human-readable 输出格式化
│   │   └── speaker-resolver.ts # speaker name → speakerInnerId 解析
│   └── index.ts                # library exports（如需要）
├── package.json
├── tsconfig.json
└── xo.config.mjs
```

每个命令模块遵循 coli 的 `_cli.ts` + 实现文件分离模式：
- `_cli.ts`：Commander 命令注册、参数解析、调用实现函数
- 实现文件：核心逻辑，接收已解析的参数，调用 SDK，格式化输出

## 认证流程

### OAuth 登录

仅支持 OAuth，不支持 API Key。

```
listenhub auth login
```

流程：
1. 选择可用端口，启动本地 HTTP server
2. 调用 `sdk.connectInit({callbackPort})` → 拿到 `{sessionId, authUrl}`
3. 用 `open` 包打开浏览器访问 authUrl
4. 用户在浏览器中登录授权
5. 浏览器重定向到 `localhost:<port>/callback?code=xxx`
6. 本地 server 接收 code，调用 `sdk.connectToken({sessionId, code})`
7. 拿到 `{accessToken, refreshToken, expiresIn}`
8. 写入 credentials 文件
9. 关闭 server，输出 "Logged in as <username>"

### auth status

```
listenhub auth status
```

读取本地 credentials → 用 `client.getCurrentUser()` 验证 → 显示用户名、邮箱、token 到期时间。token 无效时输出 "Not logged in" 并退出码 1。

### auth logout

```
listenhub auth logout
```

**Best-effort revoke 策略：**
1. 尝试 `sdk.revoke({refreshToken})`
2. 无论远端 revoke 成功或失败，都删除本地 credentials 文件
3. 远端失败时 stderr 输出 `Warning: remote revoke failed, local credentials cleared`
4. 退出码始终 0（本地状态已清理即算成功）

## 凭据存储

### 文件位置

```
$XDG_CONFIG_HOME/listenhub/credentials.json
```

不设 `$XDG_CONFIG_HOME` 时 fallback 到 `~/.config/listenhub/credentials.json`。

MVP 只支持 macOS + Linux。Windows 支持留作未来扩展（届时用 `env-paths` 包）。

### 文件格式

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": 1712234567890
}
```

`expiresAt` 为绝对时间戳（ms），login 时从 `Date.now() + expiresIn * 1000` 计算。

### 安全与并发

- **原子写**：先写临时文件，再 `rename` 覆盖目标（避免写到一半崩溃导致损坏）
- **文件权限**：创建时 `chmod 0600`（仅 owner 可读写）
- **提前刷新**：过期前 60s 即触发 refresh，避免请求时才发现过期
- **单飞刷新**：使用文件级锁（或 in-process Promise 缓存），并发命令不会同时发起多次 refresh

### 客户端初始化

```typescript
// _shared/client.ts
export async function getClient(): Promise<ListenHubClient> {
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error('Not logged in. Run `listenhub auth login` first.');
  }
  // 检查是否需要刷新
  if (creds.expiresAt - Date.now() < 60_000) {
    creds = await refreshAndSave(creds);
  }
  return new ListenHubClient({
    accessToken: creds.accessToken,
  });
}
```

## 命令设计

### 命令结构

平坦命令，所有命令挂在顶层：

```
listenhub <command> <subcommand> [options]
```

### 全局选项

| 选项 | 说明 |
|------|------|
| `--json` | 输出 JSON 格式（默认 human-readable） |
| `--help` | 显示帮助信息 |
| `--version` | 显示版本号 |

### 内容创建命令

所有创建命令共享的行为：
- 默认 polling 到完成，`--no-wait` 跳过 polling 只返回 ID
- `--timeout <seconds>` 覆盖默认超时
- stderr 输出 polling 进度（spinner），不污染 stdout

#### podcast create

```bash
listenhub podcast create [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--query <text>` | string | - | 主题文字 |
| `--source-url <url>` | string[] | - | 参考链接（可多次传入） |
| `--source-text <text>` | string[] | - | 参考文本（可多次传入） |
| `--mode <mode>` | `quick\|deep\|debate` | `quick` | 生成模式 |
| `--lang <lang>` | `en\|zh\|ja` | 自动推断 | 语言 |
| `--speaker <name>` | string[] | 按语言默认 | Speaker 名称（可多次传入） |
| `--speaker-id <id>` | string[] | - | 直接传 speakerInnerId |
| `--no-wait` | boolean | false | 不等待完成 |
| `--timeout <seconds>` | number | 300 | polling 超时 |

**参数映射到 SDK：**

```typescript
// CLI 参数 → SDK CreatePodcastParams
{
  type: speakers.length <= 1 ? 'podcast-solo' : 'podcast-duo',
  query: options.query,
  sources: buildSources(options.sourceUrl, options.sourceText),
  template: {
    type: 'podcast',
    mode: options.mode ?? 'quick',
    speakers: await resolveSpeakers(options.speaker, options.speakerId, lang),
    language: lang,
  },
}
```

#### tts create

```bash
listenhub tts create [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--text <text>` | string | - | 要转语音的文本 |
| `--source-url <url>` | string[] | - | 参考链接（可多次传入） |
| `--source-text <text>` | string[] | - | 参考文本（可多次传入） |
| `--mode <mode>` | `smart\|direct` | `smart` | 生成模式 |
| `--lang <lang>` | `en\|zh\|ja` | 自动推断 | 语言 |
| `--speaker <name>` | string | 按语言默认 | Speaker 名称 |
| `--speaker-id <id>` | string | - | 直接传 speakerInnerId |
| `--no-wait` | boolean | false | 不等待完成 |
| `--timeout <seconds>` | number | 300 | polling 超时 |

**参数映射：**

```typescript
{
  sources: options.text
    ? [{ type: 'text', content: options.text }]
    : buildSources(options.sourceUrl, options.sourceText),
  template: {
    type: 'flowspeech',
    mode: options.mode ?? 'smart',
    speakers: await resolveSpeakers(options.speaker, options.speakerId, lang),
    language: lang,
  },
}
```

#### explainer create

```bash
listenhub explainer create [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--query <text>` | string | - | 主题文字 |
| `--source-url <url>` | string[] | - | 参考链接 |
| `--source-text <text>` | string[] | - | 参考文本 |
| `--mode <mode>` | `info\|story` | `info` | 生成模式 |
| `--lang <lang>` | `en\|zh\|ja` | 自动推断 | 语言 |
| `--speaker <name>` | string | 按语言默认 | Speaker 名称 |
| `--speaker-id <id>` | string | - | 直接传 speakerInnerId |
| `--skip-audio` | boolean | false | 跳过音频生成 |
| `--image-size <size>` | `2K\|4K` | `2K` | 图片尺寸 |
| `--aspect-ratio <ratio>` | `16:9\|9:16\|1:1` | `16:9` | 图片比例 |
| `--style <style>` | string | - | 自定义风格描述 |
| `--no-wait` | boolean | false | 不等待完成 |
| `--timeout <seconds>` | number | 300 | polling 超时 |

**参数映射到 SDK：**

```typescript
// CLI 参数 → SDK CreateExplainerVideoParams
{
  query: options.query,
  sources: buildSources(options.sourceUrl, options.sourceText),
  style: options.style,
  skipAudio: options.skipAudio ?? false,
  imageConfig: {
    size: options.imageSize ?? '2K',
    aspectRatio: options.aspectRatio ?? '16:9',
  },
  template: {
    type: 'storybook',     // 注意：SDK 类型是 'storybook' 不是 'explainer'
    mode: options.mode ?? 'info',
    speakers: await resolveSpeakers(options.speaker, options.speakerId, lang),
    language: lang,
    style: options.style,
    size: options.imageSize ?? '2K',
    aspectRatio: options.aspectRatio ?? '16:9',
  },
}
```

#### slides create

```bash
listenhub slides create [options]
```

与 `explainer create` 相同的选项（mode 固定为 `slides`，不暴露 `--mode`）。`--skip-audio` 默认 true，用户可传 `--no-skip-audio` 覆盖以生成音频。

**参数映射到 SDK：**

```typescript
// CLI 参数 → SDK CreateSlidesParams
// 注意：SDK createSlides() 内部已默认 skipAudio: true
{
  query: options.query,
  sources: buildSources(options.sourceUrl, options.sourceText),
  style: options.style,
  skipAudio: options.skipAudio ?? true,  // 用户传 --no-skip-audio 时为 false
  imageConfig: {
    size: options.imageSize ?? '2K',
    aspectRatio: options.aspectRatio ?? '16:9',
  },
  template: {
    type: 'storybook',
    mode: 'slides',        // 固定值
    speakers: await resolveSpeakers(options.speaker, options.speakerId, lang),
    language: lang,
    style: options.style,
    size: options.imageSize ?? '2K',
    aspectRatio: options.aspectRatio ?? '16:9',
  },
}
```

#### image create

```bash
listenhub image create [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--prompt <text>` | string | **必填** | 图片描述 |
| `--model <model>` | string | - | 模型（不传则由服务端决定默认值） |
| `--lang <lang>` | `auto\|en\|zh\|ja\|ko\|hi\|pt\|es` | - | prompt 语言提示（不传则由服务端自动判断） |
| `--aspect-ratio <ratio>` | string | `1:1` | 图片比例 |
| `--size <size>` | `1K\|2K\|4K` | `2K` | 图片尺寸 |
| `--reference-url <url>` | string[] | - | 参考图片 URL（可多次传入） |
| `--no-wait` | boolean | false | 不等待完成 |
| `--timeout <seconds>` | number | 120 | polling 超时（图片较快） |

**参数映射到 SDK：**

```typescript
// CLI 参数 → SDK CreateAIImageParams
// 只传用户显式指定的参数，未指定的由服务端决定默认值
{
  prompt: options.prompt,
  ...(options.model && { model: options.model }),
  ...(options.lang && { language: options.lang }),
  aspectRatio: options.aspectRatio ?? '1:1',
  imageSize: options.size ?? '2K',        // 注意：SDK 字段名是 imageSize 不是 size
  ...(options.referenceUrl?.length && { referenceImageUrls: options.referenceUrl }),
}
```

### 查询命令

#### podcast list / tts list / explainer list / slides list

```bash
listenhub podcast list [options]
listenhub tts list [options]
listenhub explainer list [options]
listenhub slides list [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--page <n>` | number | 1 | 分页 |
| `--page-size <n>` | number | 20 | 每页条数 |

#### image list

```bash
listenhub image list [options]
```

同上分页选项。调用 `client.listAIImages()`，注意返回类型是 `ListAIImagesResponse`（`AIImageItem[]`），与 episode 列表的字段不同。

#### image get

```bash
listenhub image get <id>
```

获取单张图片详情。调用 `client.getAIImage(imageId)`。

#### creation get

```bash
listenhub creation get <id>
```

获取 episode 类型（podcast/tts/explainer/slides）的详情。调用 `client.getCreation(episodeId)`。

> 注意：`creation get` 用于 episode 类内容，`image get` 用于 AI 图片。两者使用不同的 SDK 方法和返回类型。

#### creation delete

```bash
listenhub creation delete <id...>
```

删除一个或多个 episode 内容。调用 `client.deleteCreations({ids: [id1, id2, ...]})`。

### Speakers 命令

```bash
listenhub speakers list [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--lang <lang>` | `en\|zh\|ja` | - | 按语言过滤 |

## Speaker 解析规则

### buildSources 辅助函数

将 CLI 的 `--source-url` 和 `--source-text` 参数转换为 SDK 的 `ContentSource[]`：

```typescript
function buildSources(urls?: string[], texts?: string[]): ContentSource[] {
  const sources: ContentSource[] = [];
  for (const uri of urls ?? []) {
    sources.push({ type: 'url', uri });
  }
  for (const content of texts ?? []) {
    sources.push({ type: 'text', content });
  }
  return sources;
}
```

### speaker-resolver.ts

`_shared/speaker-resolver.ts` 负责将 CLI 传入的 speaker name 解析为 SDK 需要的 `speakerInnerId`。

### 解析优先级

1. **`--speaker-id`**：直接使用，不做解析
2. **`--speaker <name>`**：调用 `sdk.listSpeakers({language})` 获取列表，按 name 精确匹配（忽略大小写），匹配失败则报错并列出可选 speaker
3. **不传 speaker**：使用内置默认值

### 内置默认 Speaker

从 SDK 的 `listSpeakers` 响应中硬编码默认 pair（根据 skills 仓库 `shared/speaker-selection.md` 现有默认值）：

```typescript
const DEFAULT_SPEAKERS: Record<Language, string[]> = {
  zh: ['zhiyu-innerId', 'zhichen-innerId'],   // 具体 innerId 在实现时从 API 确认
  en: ['alloy-innerId', 'echo-innerId'],
  ja: ['nanami-innerId', 'keita-innerId'],
};
```

Podcast 默认使用 pair（2人），TTS / Explainer / Slides 默认使用第一个。

### 语言推断

不传 `--lang` 时，按以下顺序推断：
1. 检查 `--query` 或 `--text` 的文字内容：含中文字符 → `zh`，含日文假名 → `ja`，否则 → `en`
2. `--source-url` / `--source-text` 不参与推断（内容可能太长或非目标语言）

## Polling 策略

### 基本行为

- **固定间隔 10s，最多 30 次 = 最长 ~5 分钟**
- `--timeout <seconds>` 可覆盖（换算为 `Math.ceil(timeout / 10)` 次）
- polling 进度输出到 stderr（spinner），不污染 stdout
- 完成后 stdout 输出最终结果

### 429 处理

**CLI 不做 429 特殊处理。** SDK 已内建 429 + Retry-After 重试（默认 2 次）。CLI 的 polling 只是重复调用 `getCreation(id)` 检查状态，如果 SDK 抛出 429 错误（重试耗尽），CLI 将该错误传递给用户。

### 状态判断

```typescript
async function pollUntilDone(client, episodeId, options) {
  const maxAttempts = Math.ceil((options.timeout ?? 300) / 10);
  for (let i = 0; i < maxAttempts; i++) {
    const detail = await client.getCreation(episodeId);
    if (detail.processStatus === 'success') return detail;
    if (detail.processStatus === 'fail') {
      throw new Error(`Creation failed (code: ${detail.failCode})`);
    }
    // status === 'pending', 继续等待
    await sleep(10_000);
  }
  throw new Error(`Timed out after ${options.timeout ?? 300}s`);
}
```

## 输出格式

### Human-readable（默认）

创建成功：
```
✓ Podcast created

  ID:       ep_abc123
  Title:    AI 趋势解读
  Duration: 12:34
  Status:   success
  Audio:    https://cdn.listenhub.ai/...mp3
```

列表：
```
  ID            Title                   Status    Created
  ep_abc123     AI 趋势解读             success   2026-04-04
  ep_def456     Climate Change Debate   pending   2026-04-03
```

错误：
```
✗ Error: Not logged in. Run `listenhub auth login` first.
```

### JSON（`--json`）

创建成功：
```json
{
  "id": "ep_abc123",
  "title": "AI 趋势解读",
  "processStatus": "success",
  "audioUrl": "https://cdn.listenhub.ai/...mp3",
  "audioDuration": 754
}
```

JSON 模式下错误也输出 JSON 到 stderr：
```json
{
  "error": "Not logged in",
  "code": "AUTH_REQUIRED"
}
```

### Polling 进度（stderr）

```
⠋ Creating podcast... (1/30)
⠙ Creating podcast... (2/30)
```

`--json` 模式下 spinner 静默，仅在完成时输出 JSON。

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 通用错误（API 错误、参数错误等） |
| 2 | 认证错误（未登录或 token 失效且刷新失败） |
| 3 | 超时（polling 超时） |

## 构建与发布

### package.json 关键字段

```json
{
  "name": "@marswave/listenhub-cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "listenhub": "distribution/source/cli.js"
  },
  "files": ["distribution"],
  "engines": { "node": ">=20" },
  "dependencies": {
    "@marswave/listenhub-sdk": "^0.0.2",
    "commander": "^14.0.0",
    "ora": "^8.0.0",
    "open": "^10.0.0"
  }
}
```

### TypeScript 配置

继承 `@sindresorhus/tsconfig`，与 coli 一致：

```json
{
  "extends": "@sindresorhus/tsconfig",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "distribution",
    "types": ["node"]
  },
  "include": ["source"]
}
```

### 开发工作流

```bash
npm run dev     # tsc --watch
npm run build   # tsc + chmod +x
npm test        # xo lint
```

## 不在 MVP 范围内

以下功能明确排除，留作未来扩展：

- **API Key 认证** — 当前仅 OAuth
- **Windows 支持** — MVP 只支持 macOS + Linux
- **user info / subscription 命令** — 按需添加
- **checkin 命令** — 按需添加
- **settings 命令** — 按需添加
- **explainer export 命令** — SDK 有 `exportExplainerVideo(episodeId)` 方法用于触发视频导出，按需添加
- **image `--enable-search` / `--lossless` 选项** — SDK 支持但 MVP 不暴露
- **Shell 自动补全** — 未来可通过 Commander 的 completions 插件添加
- **配置文件**（如 `~/.config/listenhub/config.json` 存默认 speaker/language）— 未来可添加
