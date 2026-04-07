# ListenHub CLI

[ListenHub](https://listenhub.ai) 的命令行工具 — 在终端里创建播客、语音合成、讲解视频、幻灯片、AI 图片和音乐。

[English](README.md)

基于 [`@marswave/listenhub-sdk`](https://github.com/marswaveai/listenhub-sdk) 构建。

## 安装

```bash
npm install -g @marswave/listenhub-cli
```

需要 Node.js >= 20。

## 快速开始

```bash
# 浏览器登录
listenhub auth login

# 创建播客
listenhub podcast create --query "2026年AI趋势" --mode quick

# 生成音乐
listenhub music generate --prompt "轻松的lo-fi节拍" --style "lo-fi" --title "深夜学习"

# 用本地音频翻唱
listenhub music cover --audio ./song.mp3 --title "我的翻唱"

# 用本地参考图生成 AI 图片
listenhub image create --prompt "水彩风格的小龙" --reference ./sketch.png

# 语音合成
listenhub tts create --text "你好世界" --lang zh
```

## 命令列表

### 认证

| 命令 | 说明 |
|------|------|
| `listenhub auth login` | 浏览器 OAuth 登录 |
| `listenhub auth logout` | 登出并撤销 token |
| `listenhub auth status` | 查看登录状态 |

### 音乐

| 命令 | 说明 |
|------|------|
| `listenhub music generate` | 根据文字描述生成音乐 |
| `listenhub music cover` | 用参考音频创建翻唱 |
| `listenhub music list` | 列出音乐任务 |
| `listenhub music get <id>` | 查看音乐任务详情 |

### 内容创作

| 命令 | 说明 |
|------|------|
| `listenhub podcast create` | 创建播客 |
| `listenhub podcast list` | 列出播客 |
| `listenhub tts create` | 创建语音合成 |
| `listenhub tts list` | 列出语音合成 |
| `listenhub explainer create` | 创建讲解视频 |
| `listenhub explainer list` | 列出讲解视频 |
| `listenhub slides create` | 创建幻灯片 |
| `listenhub slides list` | 列出幻灯片 |

### 图片

| 命令 | 说明 |
|------|------|
| `listenhub image create` | AI 生图 |
| `listenhub image list` | 列出图片 |
| `listenhub image get <id>` | 查看图片详情 |

### 其他

| 命令 | 说明 |
|------|------|
| `listenhub speakers list` | 列出可用声音 |
| `listenhub creation get <id>` | 查看作品详情 |
| `listenhub creation delete <id...>` | 删除作品 |

每个命令都可以加 `--help` 查看完整选项。

## 通用选项

所有命令支持：

- `--json` / `-j` — 输出 JSON 格式
- `--help` / `-h` — 显示帮助

创作命令还支持：

- `--no-wait` — 立即返回 ID，不等待完成
- `--timeout <seconds>` — 轮询超时时间（默认值因命令而异）

## 本地文件上传

`music cover` 和 `image create` 支持引用本地文件。CLI 自动检测本地路径，校验格式和大小，上传到云存储后传给 API。

```bash
# 本地音频文件用于翻唱（mp3, wav, flac, m4a, ogg, aac；最大 20MB）
listenhub music cover --audio ./song.mp3

# 本地图片用于参考（jpg, png, webp, gif；最大 10MB）
listenhub image create --prompt "以此为灵感" --reference ./photo.jpg

# URL 直接透传
listenhub music cover --audio https://example.com/song.mp3
```

## 认证

使用 OAuth 认证。运行 `listenhub auth login` 会打开浏览器授权。Token 存储在 `~/.config/listenhub/credentials.json`（或 `$XDG_CONFIG_HOME/listenhub/`），过期前自动刷新。

运行 `listenhub auth status` 查看当前状态。

## 使用示例

### 音乐生成

```bash
# 带风格和标题
listenhub music generate --prompt "动感电子舞曲" --style "EDM" --title "夜间飞驰"

# 纯音乐
listenhub music generate --prompt "宁静的钢琴旋律" --instrumental

# 本地文件翻唱
listenhub music cover --audio ./original.mp3 --title "我的混音"

# 获取任务 ID 后轮询
ID=$(listenhub music generate --prompt "测试" --no-wait --json | jq -r '.taskId')
listenhub music get "$ID" --json
```

### 播客

```bash
listenhub podcast create \
  --query "气候变化解决方案" \
  --mode deep \
  --source-url https://example.com/article \
  --lang zh
```

### 带参考图生成图片

```bash
listenhub image create \
  --prompt "以这种风格创作风景画" \
  --reference ./sketch.jpg \
  --reference ./palette.png \
  --aspect-ratio 16:9 --size 4K
```

### 脚本中使用 JSON 输出

```bash
# 获取 ID 不等待
ID=$(listenhub podcast create --query "测试" --no-wait --json | jq -r '.episodeId')

# 之后查询状态
listenhub creation get "$ID" --json
```

## 开发

```bash
git clone https://github.com/marswaveai/listenhub-cli.git
cd listenhub-cli
npm install
npm run dev    # TypeScript 监听模式
npm run build  # 构建
npm test       # xo 代码检查
```

## 许可证

[MIT](LICENSE)
