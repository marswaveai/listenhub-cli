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

### 语音克隆

上传参考音频建任务，轮询到克隆完成后确认成可反复使用的私有音色。等级配额内确认不扣积分，
超出配额后每次扣 300 积分，且必须显式传 `--use-credits`。语言：`zh`、`en`。

| 命令                                        | 说明                            |
| ------------------------------------------- | ------------------------------- |
| `listenhub voice-clone create`              | 用 1-6 个参考音频文件建克隆任务 |
| `listenhub voice-clone get <taskId>`        | 查看任务状态                    |
| `listenhub voice-clone confirm`             | 把已完成的任务确认成私有音色    |
| `listenhub voice-clone speakers`            | 列出私有音色与配额              |
| `listenhub voice-clone speaker <speakerId>` | 查看单个私有音色                |
| `listenhub voice-clone update <speakerId>`  | 改音色名称或性别                |
| `listenhub voice-clone delete <speakerId>`  | 删除音色并释放一个名额          |

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

### 语音克隆

流程与 OAuth 端相同，另外支持 `ja`，以及 `--auto-confirm`（发现任务完成的那次轮询直接确认）。
每次创建都必须带 `--consent`，即声明已获得被克隆者授权——不带这个参数服务端会拒绝。

| 命令                                      | 说明                           |
| ----------------------------------------- | ------------------------------ |
| `openapi voice-clone create`              | 建克隆任务，必须带 `--consent` |
| `openapi voice-clone get <taskId>`        | 查看任务；按需在轮询里自动确认 |
| `openapi voice-clone confirm`             | 确认任务并打印 speaker ID      |
| `openapi voice-clone speakers`            | 列出私有音色与配额             |
| `openapi voice-clone speaker <speakerId>` | 查看单个私有音色               |
| `openapi voice-clone update <speakerId>`  | 改音色名称或性别               |
| `openapi voice-clone delete <speakerId>`  | 删除音色并释放一个名额         |

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

## Base URL 配置

CLI 走**两条独立的请求链路**，各有自己的 Base URL 和覆盖变量：

| 请求链路          | 命令                                                     | 默认 Base URL                     | 覆盖变量                |
| ----------------- | -------------------------------------------------------- | --------------------------------- | ----------------------- |
| OAuth（普通命令） | `listenhub podcast`、`tts`、`music`、`image`、`video` 等 | `https://api.listenhub.ai/api`    | `LISTENHUB_API_URL`     |
| OpenAPI Key       | `listenhub openapi …`                                    | `https://api.marswave.ai/openapi` | `LISTENHUB_OPENAPI_URL` |

每个变量覆盖的是**整个 Base URL，含路径前缀**——普通命令的 URL 以 `/api` 结尾，OpenAPI 的 URL 以 `/openapi` 结尾。只设置与你实际使用的命令匹配的那个变量即可。

### 网络受限环境的覆盖

如果你的网络无法访问 `listenhub.ai` / `marswave.ai` 默认地址（例如整个 `listenhub.ai` 域当前在中国大陆不可达），把 Base URL 指向一个可达的主机。截至 2026-07-24，`listenhub.app` 主机是一个已验证可用的覆盖地址：

```bash
# 普通命令（OAuth）
export LISTENHUB_API_URL="https://api.listenhub.app/api"

# OpenAPI 命令
export LISTENHUB_OPENAPI_URL="https://api.listenhub.app/openapi"
```

这些变量是**网络受限环境的覆盖方式，不是新默认值**——出厂默认仍是 `.ai` / `marswave.ai`，网络正常的用户不需要设置它们。`listenhub.app` 只是当前已验证的示例；若它也变得不可达，把变量改成任何一个提供同样 API 的可达主机即可，保持 `/api`（普通）或 `/openapi`（OpenAPI）后缀不变。

### 钉住某个域

不想每个 shell 都 export 一遍完整 URL，可以把域钉死一次——两条命令链路都覆盖，且会持久化：

```bash
listenhub config set-domain app      # 全部走 api.listenhub.app
listenhub config set-domain default  # 强制用出厂的 .ai / marswave.ai
listenhub config set-domain auto     # 取消钉死（默认值），交给 SDK 自己选
listenhub config show                # 这条命令实际会打到哪个 Base URL？
```

`auto` 是开箱默认行为：SDK 先打出厂默认域，只有在**完全连不上**时才切到可达的备选域，并记住结果，之后的命令直接走那里。两点要知道：创建/生成类命令失败后**绝不会被重发到另一个域**（连接失败不能证明服务端没收到，重发可能双份扣费），所以在受限网络上第一条这类命令会失败并提示你重试——重试那次就通了；另外显式设了 `LISTENHUB_API_URL` / `LISTENHUB_OPENAPI_URL` 或钉死了域，自动切换就完全关闭。

## 排查 `fetch failed`

`TypeError: fetch failed` 表示请求**根本没到达服务器**（DNS / TLS / 代理 / Base URL 问题），因此没有 HTTP 状态码可读。它**不是**鉴权错误——服务器一旦可达，你拿到的会是结构化响应（例如 `401`，或业务码 `21007`）。

按顺序检查，过程中不要打印任何密钥：

1. **是哪条链路失败？** 普通 `listenhub …` 命令走 `LISTENHUB_API_URL`；`listenhub openapi …` 命令走 `LISTENHUB_OPENAPI_URL`。修正与失败命令匹配的那个变量。
2. **Node.js 版本。** 运行 `node -v`；CLI 需要 Node.js >= 20（依赖原生 `fetch`）。
3. **当前实际用的是哪个 Base URL？** 跑 `listenhub config show`——它会打印两条链路各自生效的 Base URL、来源和 Node.js 版本，且不会打印任何 key 或 token。
4. **那个主机能连通吗？** 试一个可达的覆盖地址，比如 `https://api.listenhub.app/api`（普通）或 `https://api.listenhub.app/openapi`（OpenAPI）。如果默认主机在你的网络被封，换成一个可达主机，保持 `/api` 或 `/openapi` 后缀不变。

排查时不要把 API key、access token 或完整环境变量贴进日志或 issue——主机名和失败的命令类型就够定位了。

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
