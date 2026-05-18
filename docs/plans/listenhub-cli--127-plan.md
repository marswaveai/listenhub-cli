# Plan: CLI 支持 SeeDance2.0 视频生成

> Issue: marswaveai/listenhub-ralph#127
> Spec: docs/specs/listenhub-cli--127-design.md

## 实现步骤

### Step 1: 升级 SDK + 扩展 upload 工具

**文件：`package.json`**
- `@marswave/listenhub-sdk` 从 `^0.0.4` 改为 `^0.0.6`
- `"version"` 从 `"0.0.4"` 升为 `"0.0.5"`（新增功能，minor bump）
- 运行 `pnpm install` 更新 lockfile

**文件：`source/_shared/upload.ts`**

1. 新增 `video` accept type：
   ```ts
   type FileAcceptType = 'audio' | 'image' | 'video';
   ```

2. 新增视频相关常量（SeeDance 仅支持 mp4/mov，单文件 < 50MB）：
   ```ts
   const videoExtensions = new Set(['.mp4', '.mov']);
   // maxSizeBytes
   video: 50 * 1024 * 1024,
   // categoryForType
   video: 'episode',
   // mimeTypes
   ['.mp4', 'video/mp4'],
   ['.mov', 'video/quicktime'],
   ```

3. video 命令中音频素材限制为 `mp3/wav`（SeeDance 支持范围），单文件 < 15MB。
   在 `resolveFileOrUrl` 调用时，video 命令对 audio 类型传 `{ accept: 'audio', category: 'episode' }` ——
   但需新增一个 `videoAudioExtensions` 集合做额外校验（或在 video.ts 校验层先过滤后缀），
   避免用户传 `.flac`/`.ogg` 等 CLI 层面放行但 provider 拒绝的格式。
   
   实现方式：在 `video.ts` 的 `validateCreateOptions` 中检查 `--reference-audio` 文件后缀，
   不在 `['.mp3', '.wav']` 内的直接报错：`Reference audio must be .mp3 or .wav`。

3. `allowedExtensions` 函数扩展 video 分支。

4. `resolveFileOrUrl` 签名增加可选 `category` override：
   ```ts
   export async function resolveFileOrUrl(
     client: ListenHubClient,
     input: string,
     options: { accept: FileAcceptType; category?: string },
   ): Promise<string>
   ```
   内部 `const category = options.category ?? categoryForType[options.accept];`

---

### Step 2: 新增视频轮询函数

**文件：`source/_shared/polling.ts`**

在文件末尾新增 `pollVideoTaskUntilDone`：

```ts
import type { VideoGenerationTaskDetail } from '@marswave/listenhub-sdk';

export async function pollVideoTaskUntilDone(
  client: ListenHubClient,
  taskId: string,
  options: { timeout?: number; json?: boolean },
): Promise<VideoGenerationTaskDetail> {
  const timeoutS = options.timeout ?? 1200;
  const maxAttempts = Math.ceil(timeoutS / (pollIntervalMs / 1000));
  const spinner = options.json
    ? undefined
    : ora({ text: `Generating video... (1/${maxAttempts})` }).start();

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await sleep(pollIntervalMs);
    const task = await client.getVideoGenerationTask(taskId);
    if (task.status === 'success') {
      spinner?.succeed('Video created successfully');
      return task;
    }
    if (task.status === 'failed') {
      spinner?.fail('Video creation failed');
      throw new Error('Video creation failed');
    }
    if (spinner) {
      spinner.text = `Generating video... (${String(i + 2)}/${maxAttempts})`;
    }
  }
  spinner?.fail('Timed out');
  throw new CliTimeoutError(`Timed out after ${timeoutS}s`);
}
```

需在顶部 import 区域添加 `VideoGenerationTaskDetail` 类型。

---

### Step 3: 新增 `source/video/video.ts` — 业务逻辑

导出四个函数：`createVideo`、`getVideo`、`listVideos`、`estimateCredits`。

**类型定义：**

```ts
export type VideoCreateOptions = {
  prompt: string;
  model?: string;
  resolution?: string;
  ratio?: string;
  duration?: number;
  firstFrame?: string;
  lastFrame?: string;
  referenceImage: string[];
  referenceVideo: string[];
  referenceAudio: string[];
  inputVideoDuration?: number;
  generateAudio: boolean; // Commander --no-generate-audio 会反转为 generateAudio: false
  seed?: number;
  wait: boolean;
  timeout: number;
  json: boolean;
};
```

**`createVideo` 逻辑：**

1. **校验阶段** — 调用 `validateCreateOptions(options)` 内部函数，按 spec 校验表逐条检查，不满足直接 `throw new Error(msg)`。
   额外规则：
   - 没有 `--reference-video` 时传了 `--input-video-duration` → 报错 `--input-video-duration requires --reference-video`
   - `--reference-audio` 文件后缀不在 `.mp3`/`.wav` 内 → 报错 `Reference audio must be .mp3 or .wav`
   - `--reference-video` 文件后缀不在 `.mp4`/`.mov` 内 → 报错 `Reference video must be .mp4 or .mov`

2. **构建 content 数组：**
   ```ts
   const content: VideoContentItem[] = [];
   // prompt → { type: 'text', text: options.prompt }
   // firstFrame → resolveFileOrUrl(client, path, { accept: 'image', category: 'episode' })
   //              → { type: 'image_url', image_url: { url }, role: 'first_frame' }
   // lastFrame → 同上，role: 'last_frame'
   // referenceImage[] → 同上，role: 'reference_image'
   // referenceVideo[] → resolveFileOrUrl(client, path, { accept: 'video', category: 'episode' })
   //                   → { type: 'video_url', video_url: { url }, role: 'reference_video' }
   // referenceAudio[] → resolveFileOrUrl(client, path, { accept: 'audio', category: 'episode' })
   //                   → { type: 'audio_url', audio_url: { url }, role: 'reference_audio' }
   ```

3. **构建请求参数：** 只传用户显式指定的字段。
   ```ts
   const params: CreateVideoGenerationParams = {
     content,
     ...(options.model && { model: options.model }),
     ...(options.resolution && { resolution: options.resolution }),
     ...(options.ratio && { ratio: options.ratio }),
     ...(options.duration !== undefined && { duration: options.duration }),
     ...(!options.generateAudio && { generateAudio: false }),
     ...(options.seed !== undefined && { seed: options.seed }),
     ...(options.inputVideoDuration !== undefined && { inputVideoDuration: options.inputVideoDuration }),
   };
   ```

4. **调用 SDK + 轮询/即时返回。**

5. **输出：** 成功时 `printDetail` 展示 taskId、videoUrl、duration、resolution、ratio、seed、creditCharged。

**`getVideo`：** 调用 `client.getVideoGenerationTask(taskId)` → `printDetail` / `printJson`。

**`listVideos`：** 调用 `client.listVideoGenerationTasks(params)` → `printTable` 显示 ID / Model / Status / Duration / Created。

**`estimateCredits`：** 调用 `client.estimateVideoGenerationCredits(params)` → 输出 tokens 和 credits。
校验：`--input-video-duration` 和 `--has-video-input` 必须成对出现，缺一报错。

---

### Step 4: 新增 `source/video/_cli.ts` — Commander 注册

```ts
import { type Command, Option } from 'commander';
import { getClient } from '../_shared/client.js';
import { handleError } from '../_shared/output.js';
import { createVideo, getVideo, listVideos, estimateCredits } from './video.js';

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function register(program: Command) {
  const cmd = program.command('video').description('SeeDance video generation');

  cmd.command('create')
    .description('Create a video generation task')
    .requiredOption('--prompt <text>', 'Video description')
    .option('--model <model>', 'Model: doubao-seedance-2-pro, doubao-seedance-2-fast')
    .option('--resolution <res>', 'Resolution: 480p, 720p, 1080p')
    .option('--ratio <ratio>', 'Aspect ratio: 16:9, 4:3, 1:1, 3:4, 9:16, 21:9')
    .option('--duration <seconds>', 'Video duration in seconds (4-15)', Number)
    .option('--first-frame <path-or-url>', 'First frame image')
    .option('--last-frame <path-or-url>', 'Last frame image (requires --first-frame)')
    .option('--reference-image <path-or-url>', 'Reference image (repeatable, max 9)', collect, [])
    .option('--reference-video <path-or-url>', 'Reference video (repeatable, max 3)', collect, [])
    .option('--reference-audio <path-or-url>', 'Reference audio (repeatable, max 3)', collect, [])
    .option('--input-video-duration <seconds>', 'Reference video duration (2-15, required with --reference-video)', Number)
    .option('--no-generate-audio', 'Disable audio generation')
    .option('--seed <number>', 'Random seed (-1 to 4294967295)', Number)
    .option('--no-wait', 'Return immediately without polling')
    .option('--timeout <seconds>', 'Polling timeout', Number, 1200)
    .option('-j, --json', 'Output JSON', false)
    .action(async (options) => { ... });

  cmd.command('get <taskId>')
    .description('Get video task details')
    .option('-j, --json', 'Output JSON', false)
    .action(async (taskId, options) => { ... });

  cmd.command('list')
    .description('List video generation tasks')
    .option('--page <n>', 'Page number', Number, 1)
    .option('--page-size <n>', 'Items per page', Number, 20)
    .option('--status <status>', 'Filter: pending, generating, uploading, success, failed')
    .option('-j, --json', 'Output JSON', false)
    .action(async (options) => { ... });

  cmd.command('estimate')
    .description('Estimate credit cost')
    .requiredOption('--model <model>', 'Model name')
    .requiredOption('--resolution <res>', 'Resolution')
    .requiredOption('--duration <seconds>', 'Duration (4-15)', Number)
    .option('--ratio <ratio>', 'Aspect ratio', '16:9')
    .option('--has-video-input', 'Has reference video input', false)
    .option('--input-video-duration <seconds>', 'Reference video duration', Number)
    .option('-j, --json', 'Output JSON', false)
    .action(async (options) => { ... });
}
```

---

### Step 5: 注册到主入口

**文件：`source/cli.ts`**

```ts
import { register as registerVideo } from './video/_cli.js';
// ...
registerVideo(program);  // 放在 registerCreation 之前
```

---

### Step 6: 更新 README

**文件：`README.md`**

1. Commands 表新增 Video 部分：
   ```
   ### Video Generation

   | Command                    | Description                   |
   | -------------------------- | ----------------------------- |
   | `listenhub video create`   | Create a video generation task |
   | `listenhub video list`     | List video tasks              |
   | `listenhub video get <id>` | Get video task details        |
   | `listenhub video estimate` | Estimate credit cost          |
   ```

2. Examples 新增 Video generation 小节：

   ```bash
   # Text-to-video
   listenhub video create --prompt "A cat playing piano in a jazz bar"

   # Image-to-video (first frame)
   listenhub video create --prompt "Camera slowly zooms out" --first-frame ./scene.png

   # With reference video
   listenhub video create --prompt "Same style dancing" \
     --reference-video ./clip.mp4 --input-video-duration 8

   # Estimate credits
   listenhub video estimate --model doubao-seedance-2-pro --resolution 1080p --duration 10
   ```

**文件：`README.zh-CN.md`**

同步更新中文 README，添加对应的 Video Generation 命令表和示例（与英文版对齐）。

---

### Step 7: `vp check` + Smoke check

```bash
# vp check = fmt --check + lint + type check（三合一）
pnpm check

# Smoke check — 确认命令注册正确
pnpm build
node dist/cli.js video --help
node dist/cli.js video create --help
node dist/cli.js video list --help
node dist/cli.js video estimate --help
```

若有问题则修复后重新运行。`vp check` 必须全通过才能提交 PR。

---

## 文件清单

| 文件 | 操作 | 行数估算 |
|------|------|----------|
| `package.json` | 修改 | ~1 行 |
| `source/_shared/upload.ts` | 修改 | +15 行 |
| `source/_shared/polling.ts` | 修改 | +30 行 |
| `source/video/video.ts` | 新增 | ~200 行 |
| `source/video/_cli.ts` | 新增 | ~90 行 |
| `source/cli.ts` | 修改 | +2 行 |
| `README.md` | 修改 | +25 行 |
| `README.zh-CN.md` | 修改 | +25 行 |

总新增约 340 行代码。

## 风险点

1. **SDK 0.0.6 兼容性** — CLI 当前锁定 `^0.0.4`，升级后确认其他命令不受影响（SDK 是向后兼容的增量新增）。
2. **视频文件上传体积** — 50MB 本地文件上传到 GCS 可能耗时较长，`resolveFileOrUrl` 当前无进度条，大文件体验需留意（不在本次范围内解决）。
3. **Commander `--no-generate-audio` 语义** — Commander 会自动创建 `generateAudio` 布尔值，默认 `true`，传 `--no-generate-audio` 后变 `false`。需确认 Commander 版本行为。
