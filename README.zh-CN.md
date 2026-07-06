# ListenHub CLI

[ListenHub](https://listenhub.ai) 的命令行工具 — 在终端里创建播客、语音合成、讲解视频、故事书、AI 图片、音乐和视频。

[English](README.md)

基于 [`@marswave/listenhub-sdk`](https://github.com/marswaveai/listenhub-sdk) 构建。

## 安装

```bash
npm install -g @marswave/listenhub-cli
```

需要 Node.js >= 20。

## 两种认证方式

|          | OAuth 登录                              | OpenAPI Key                                                             |
| -------- | --------------------------------------- | ----------------------------------------------------------------------- |
| 设置     | `listenhub auth login`（打开浏览器）    | 设置 `LISTENHUB_API_KEY` 环境变量 或 `listenhub openapi config set-key` |
| 命令前缀 | `listenhub podcast`、`listenhub tts` 等 | `listenhub openapi podcast`、`listenhub openapi tts` 等                 |
| 适用场景 | 交互式使用、账号管理                    | 脚本、CI/CD、程序化调用                                                 |
| 凭证存储 | `~/.config/listenhub/credentials.json`  | `~/.config/listenhub/openapi.json` 或环境变量                           |

两种方式底层调用相同的 API，按需选择即可。

## 快速开始 — OAuth

```bash
# 浏览器登录
listenhub auth login

# 创建播客
listenhub podcast create --query "2026年AI趋势" --mode quick

# 生成音乐
listenhub music generate --prompt "轻松的lo-fi节拍" --style "lo-fi" --title "深夜学习"

# 语音合成
listenhub tts create --text "你好世界" --lang zh

# AI 生图
listenhub image create --prompt "水彩风格的小龙" --reference ./sketch.png
```

## 快速开始 — OpenAPI Key

```bash
# 设置 API Key（一次性）
export LISTENHUB_API_KEY="lh_sk_..."
# 或交互式设置：
listenhub openapi config set-key

# 查看可用声音
listenhub openapi speakers list --language zh

# 语音合成（直接输出音频文件）
listenhub openapi tts --text "你好世界" --voice <speaker-id> --output hello.mp3

# 创建播客
listenhub openapi podcast create \
  --source-text "量子计算正在改变密码学" \
  --speaker-id <speaker-id> --no-wait -j

# 查看积分余额
listenhub openapi subscription -j
```

---

## OAuth 命令

### 认证

| 命令                    | 说明              |
| ----------------------- | ----------------- |
| `listenhub auth login`  | 浏览器 OAuth 登录 |
| `listenhub auth logout` | 登出并撤销 token  |
| `listenhub auth status` | 查看登录状态      |

### 音乐

| 命令                           | 说明                               |
| ------------------------------ | ---------------------------------- |
| `listenhub music generate`     | 根据文字描述生成音乐               |
| `listenhub music cover`        | 用参考音频创建翻唱                 |
| `listenhub music extend`       | 基于参考音频续写音乐               |
| `listenhub music remix`        | 用新歌词重制已有歌曲               |
| `listenhub music instrumental` | 生成纯器乐曲                       |
| `listenhub music soundtrack`   | 根据图片或视频生成配乐             |
| `listenhub music track`        | 生成单条乐器/人声轨道              |
| `listenhub music recognize`    | 从音频识别歌词（含时间戳）         |
| `listenhub music describe`     | 分析音频（描述、标签、流派、乐器） |
| `listenhub music stem`         | 分离音轨并返回下载链接             |
| `listenhub music list`         | 列出音乐任务                       |
| `listenhub music get <id>`     | 查看音乐任务详情                   |

### 内容创作

| 命令                         | 说明         |
| ---------------------------- | ------------ |
| `listenhub podcast create`   | 创建播客     |
| `listenhub podcast list`     | 列出播客     |
| `listenhub tts create`       | 创建语音合成 |
| `listenhub tts list`         | 列出语音合成 |
| `listenhub explainer create` | 创建讲解视频 |
| `listenhub explainer list`   | 列出讲解视频 |
| `listenhub slides create`    | 创建幻灯片   |
| `listenhub slides list`      | 列出幻灯片   |

### 图片

| 命令                             | 说明               |
| -------------------------------- | ------------------ |
| `listenhub image create`         | AI 生图            |
| `listenhub image list`           | 列出图片           |
| `listenhub image get <id>`       | 查看图片详情       |
| `listenhub image delete <id...>` | 删除一个或多个图片 |

### 视频生成

| 命令                       | 说明             |
| -------------------------- | ---------------- |
| `listenhub video create`   | 创建视频生成任务 |
| `listenhub video list`     | 列出视频任务     |
| `listenhub video get <id>` | 查看视频任务详情 |
| `listenhub video estimate` | 预估积分消耗     |

### 歌词

| 命令                            | 说明             |
| ------------------------------- | ---------------- |
| `listenhub lyrics extract <id>` | 从作品中提取歌词 |

### 其他

| 命令                                | 说明         |
| ----------------------------------- | ------------ |
| `listenhub speakers list`           | 列出可用声音 |
| `listenhub creation get <id>`       | 查看作品详情 |
| `listenhub creation delete <id...>` | 删除作品     |

---

## OpenAPI Key 命令

以下命令均在 `listenhub openapi` 下。

### 配置

| 命令                     | 说明               |
| ------------------------ | ------------------ |
| `openapi config set-key` | 交互式设置 API Key |
| `openapi config show`    | 查看当前 Key 状态  |
| `openapi config clear`   | 清除已存储的 Key   |

### 声音

| 命令                    | 说明                                   |
| ----------------------- | -------------------------------------- |
| `openapi speakers list` | 列出可用声音（支持 `--language` 过滤） |

### 语音合成

| 命令                   | 说明                         |
| ---------------------- | ---------------------------- |
| `openapi tts`          | 文字转语音，直接保存音频文件 |
| `openapi audio-speech` | TTS（OpenAI 兼容接口）       |
| `openapi speech`       | 创建语音，返回音频 URL       |

### Flow Speech

| 命令                                   | 说明                        |
| -------------------------------------- | --------------------------- |
| `openapi flow-speech create`           | 从 URL/文本创建 flow speech |
| `openapi flow-speech get <id>`         | 查看详情                    |
| `openapi flow-speech tts`              | 从脚本创建 flow speech      |
| `openapi flow-speech text-stream <id>` | 流式输出生成文本（SSE）     |

### 播客

| 命令                                  | 说明                     |
| ------------------------------------- | ------------------------ |
| `openapi podcast create`              | 创建播客                 |
| `openapi podcast get <id>`            | 查看播客详情             |
| `openapi podcast text-content`        | 仅生成文本（不生成音频） |
| `openapi podcast generate-audio <id>` | 为已有文本生成音频       |
| `openapi podcast text-stream <id>`    | 流式输出生成文本（SSE）  |

### 故事书

| 命令                                    | 说明            |
| --------------------------------------- | --------------- |
| `openapi storybook create`              | 创建故事书/讲解 |
| `openapi storybook get <id>`            | 查看详情        |
| `openapi storybook generate-video <id>` | 生成视频        |

### 图片

| 命令                   | 说明                                 |
| ---------------------- | ------------------------------------ |
| `openapi image create` | AI 生图（支持本地文件 + URL 参考图） |

### 视频

| 命令                              | 说明                                       |
| --------------------------------- | ------------------------------------------ |
| `openapi video create`            | 创建视频生成任务                           |
| `openapi video get <id>`          | 查看视频任务详情                           |
| `openapi video list`              | 列出视频任务                               |
| `openapi video estimate`          | 预估积分消耗                               |
| `openapi video pixverse generate` | 创建 PixVerse 视频任务（原子能力 + Agent） |
| `openapi video pixverse estimate` | 预估 PixVerse 积分消耗                     |

### 内容提取

| 命令                       | 说明            |
| -------------------------- | --------------- |
| `openapi content extract`  | 从 URL 提取内容 |
| `openapi content get <id>` | 查看提取结果    |

### 订阅

| 命令                   | 说明               |
| ---------------------- | ------------------ |
| `openapi subscription` | 查看积分和套餐信息 |

---

## 通用选项

所有命令支持：

- `--json` / `-j` — 输出 JSON 格式
- `--help` / `-h` — 显示帮助

创作命令还支持：

- `--no-wait` — 立即返回 ID，不等待完成
- `--timeout <seconds>` — 轮询超时时间（默认值因命令而异）

## 本地文件支持

OAuth 命令（`music cover`、`image create`、`video create`）自动检测本地路径，校验格式和大小，上传到云存储后传给 API。

OpenAPI `image create` 通过 base64 编码支持本地参考图（CLI 侧不限制文件大小）。
OpenAPI `video create` 通过预签名 URL 支持本地图片/视频/音频路径。Seedance 的本地图片参考会自动带上宽高元数据；远程图片 URL 和所有参考视频仍需要显式 metadata。

```bash
# OAuth：本地音频用于翻唱（mp3, wav, flac, m4a, ogg, aac；最大 20MB）
listenhub music cover --audio ./song.mp3

# OAuth：本地图片参考（jpg, png, webp, gif；最大 10MB）
listenhub image create --prompt "以此为灵感" --reference ./photo.jpg

# OpenAPI：本地图片参考（base64 编码）
listenhub openapi image create --prompt "这种风格" --reference ./sketch.png --provider google

# OpenAPI Seedance：本地图片参考会自动补宽高 metadata
listenhub openapi video create --prompt "同样风格" --first-frame ./frame.png

# 远程 URL 和参考视频仍需要尺寸元数据，否则服务端会返回 32004 参数错误
listenhub openapi video create --prompt "同样风格" \
  --reference-video https://example.com/clip.mp4 \
  --reference-video-meta 1280x720:5:30:8000000 \
  --input-video-duration 5
```

## 使用示例

### OpenAPI：播客工作流（文本 → 音频）

```bash
# 第一步：生成文本内容
listenhub openapi podcast text-content \
  --source-url https://example.com/article \
  --speaker-id voice-clone-xxx \
  --no-wait -j
# 返回：{"episodeId": "abc123"}

# 第二步：查看状态
listenhub openapi podcast get abc123 -j

# 第三步：从文本生成音频
listenhub openapi podcast generate-audio abc123

# 第四步：流式查看脚本
listenhub openapi podcast text-stream abc123 --event script
```

### OpenAPI：视频生成

```bash
# 文字生成视频
listenhub openapi video create --prompt "一只猫在弹钢琴" --no-wait -j

# 指定本地首帧（自动上传 + 自动 metadata）
listenhub openapi video create --prompt "镜头缓缓拉远" \
  --first-frame ./frame.png

# 指定远程首帧
listenhub openapi video create --prompt "镜头缓缓拉远" \
  --first-frame https://example.com/frame.png \
  --first-frame-meta 1080x1920:3600000

# 生成前预估积分
listenhub openapi video estimate --model doubao-seedance-2-pro --resolution 1080p --duration 10
```

### OpenAPI：PixVerse 视频生成

PixVerse 支持原子能力（`text_to_video`、`image_to_video`、`transition`、`multi_transition`、`fusion`、`restyle`、`mimic`、`lip_sync`）和营销 `agent`（`ad_master` / `promo_mix`）。`--capability` 必填。`--language en`（默认）走国际站，`--language zh` 走国内站。图片、视频、音频素材可在 URL 后加 `:时长` 后缀（`url:秒数`）。少见的嵌套字段用 `--pixverse-json` 直接传 JSON。

```bash
# 文字生成视频
listenhub openapi video pixverse generate --capability text_to_video \
  --prompt "一只猫在弹钢琴" --quality 720p --aspect-ratio 16:9 --duration 5 --no-wait -j

# 图片生成视频（素材支持 url:时长）
listenhub openapi video pixverse generate --capability image_to_video \
  --image https://example.com/photo.jpg --prompt "镜头缓缓推近"

# 口型同步 TTS，复用已成功的 PixVerse 任务
listenhub openapi video pixverse generate --capability lip_sync \
  --source-task-id 6a2016607ebd26d050c585ca \
  --lip-sync-tts --lip-sync-speaker-id speaker-1 --lip-sync-content "你好世界"

# 营销 Agent（promo_mix 至少 4 张商品图）
listenhub openapi video pixverse generate --capability agent --agent-type promo_mix \
  --quality 1080p --duration 30 \
  --image https://example.com/p1.jpg --image https://example.com/p2.jpg \
  --image https://example.com/p3.jpg --image https://example.com/p4.jpg

# 用 --pixverse-json 传嵌套字段
listenhub openapi video pixverse generate --capability fusion \
  --prompt "@hero 站在 @bg 前" \
  --pixverse-json '{"imageReferences":[{"type":"subject","imageUrl":"https://example.com/hero.png","refName":"hero"},{"type":"background","imageUrl":"https://example.com/bg.png","refName":"bg"}]}'

# 预估积分
listenhub openapi video pixverse estimate --capability text_to_video --quality 720p --duration 5
listenhub openapi video pixverse estimate --capability agent --agent-type ad_master --duration 30
```

### OAuth：音乐生成

```bash
# 带风格和标题
listenhub music generate --prompt "动感电子舞曲" --style "EDM" --title "夜间飞驰"

# 纯音乐
listenhub music generate --prompt "宁静的钢琴旋律" --instrumental

# 本地文件翻唱
listenhub music cover --audio ./original.mp3 --title "我的混音"

# 用新歌词重制已有歌曲（文件、--audio-url 或 --provider-song-id 三选一）
listenhub music remix ./original.mp3 --lyrics "全新的主歌……" --prompt "Lo-fi 嘻哈"

# 纯器乐（--prompt 与 --reference-audio 二选一）
listenhub music instrumental --prompt "电影感弦乐渐强" --model mureka-8

# 根据图片或视频生成配乐（--image 与 --video 二选一）
listenhub music soundtrack --image ./cover.png --prompt "梦幻 synthwave"

# 生成单条乐器/人声轨道（--audio 与 --provider-song-id 二选一）
listenhub music track ./song.mp3 --generate-type Drums --prompt "有力的碎拍"
listenhub music track --provider-song-id abc123 --generate-type Vocals \
  --prompt "灵魂乐副歌" --lyrics "坚持住……" --vocal-gender female

# 同步分析命令（立即返回结果）
listenhub music recognize --audio ./song.mp3
listenhub music describe --audio ./song.mp3
listenhub music stem --audio ./song.mp3 --model audio-separation-2
```

### 脚本中使用 JSON 输出

```bash
# 拿到 ID 后轮询
ID=$(listenhub openapi flow-speech create \
  --source-text "一篇文章的内容" \
  --speaker-id voice-xxx \
  --no-wait -j | jq -r '.episodeId')

listenhub openapi flow-speech get "$ID" -j
```

## 开发

```bash
git clone https://github.com/marswaveai/listenhub-cli.git
cd listenhub-cli
pnpm install
pnpm run dev    # TypeScript 监听模式
pnpm run build  # 构建
pnpm test       # 运行测试
pnpm run lint   # 代码检查
```

## 许可证

[MIT](LICENSE)
