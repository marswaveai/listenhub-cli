# ListenHub CLI

Command-line interface for [ListenHub](https://listenhub.ai) — create podcasts, text-to-speech, explainer videos, slides, and AI images from your terminal.

Built on top of [`@marswave/listenhub-sdk`](https://github.com/marswaveai/listenhub-sdk).

## Install

```bash
npm install -g @marswave/listenhub-cli
```

Requires Node.js >= 20.

## Quick Start

```bash
# Log in via browser
listenhub auth login

# Create a podcast
listenhub podcast create --query "AI agent trends in 2026" --mode quick

# Text-to-speech
listenhub tts create --text "Hello, world" --lang en

# Generate an AI image
listenhub image create --prompt "a dragon in watercolor style" --size 2K

# List your speakers
listenhub speakers list --lang zh
```

## Commands

| Command | Description |
|---------|-------------|
| `listenhub auth login` | Log in via browser OAuth |
| `listenhub auth logout` | Log out and revoke tokens |
| `listenhub auth status` | Show current login status |
| `listenhub podcast create` | Create a podcast episode |
| `listenhub podcast list` | List podcast episodes |
| `listenhub tts create` | Create text-to-speech audio |
| `listenhub tts list` | List TTS creations |
| `listenhub explainer create` | Create an explainer video |
| `listenhub explainer list` | List explainer videos |
| `listenhub slides create` | Create a slide deck |
| `listenhub slides list` | List slide decks |
| `listenhub image create` | Generate an AI image |
| `listenhub image list` | List AI images |
| `listenhub image get <id>` | Get image details |
| `listenhub speakers list` | List available speakers |
| `listenhub creation get <id>` | Get creation details |
| `listenhub creation delete <id...>` | Delete creations |

Run `listenhub <command> --help` for full options.

## Common Options

All commands support:

- `--json` / `-j` — Output JSON instead of human-readable text
- `--help` / `-h` — Show help

Creation commands (`podcast create`, `tts create`, etc.) also support:

- `--no-wait` — Return the ID immediately without polling
- `--timeout <seconds>` — Polling timeout (default: 300s, image: 120s)
- `--lang <lang>` — Language (`en`, `zh`, `ja`); auto-detected from input if omitted
- `--speaker <name>` — Speaker name (use `speakers list` to see available options)

## Authentication

ListenHub CLI uses OAuth. Run `listenhub auth login` to open a browser window for authorization. Tokens are stored at `~/.config/listenhub/credentials.json` (or `$XDG_CONFIG_HOME/listenhub/`).

Tokens auto-refresh when nearing expiry. Run `listenhub auth status` to check.

## Examples

### Podcast with reference material

```bash
listenhub podcast create \
  --query "Climate change solutions" \
  --mode deep \
  --source-url https://example.com/article \
  --lang en
```

### TTS with a specific speaker

```bash
listenhub speakers list --lang zh
listenhub tts create --text "你好世界" --speaker 若云
```

### Explainer video

```bash
listenhub explainer create \
  --source-url https://example.com/paper \
  --mode story \
  --image-size 4K \
  --aspect-ratio 16:9
```

### JSON output for scripting

```bash
# Get episode ID without waiting
ID=$(listenhub podcast create --query "test" --no-wait --json | jq -r '.episodeId')

# Poll status later
listenhub creation get "$ID" --json
```

## Development

```bash
git clone https://github.com/marswaveai/listenhub-cli.git
cd listenhub-cli
npm install
npm run dev    # TypeScript watch mode
npm run build  # Build for distribution
npm test       # Lint with xo
```

## License

MIT

---

# ListenHub CLI

[ListenHub](https://listenhub.ai) 的命令行工具 — 在终端里创建播客、语音合成、讲解视频、幻灯片和 AI 图片。

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

# 语音合成
listenhub tts create --text "你好世界" --lang zh

# AI 生图
listenhub image create --prompt "水彩风格的小龙" --size 2K

# 查看可用声音
listenhub speakers list --lang zh
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `listenhub auth login` | 浏览器 OAuth 登录 |
| `listenhub auth logout` | 登出并撤销 token |
| `listenhub auth status` | 查看登录状态 |
| `listenhub podcast create` | 创建播客 |
| `listenhub podcast list` | 列出播客 |
| `listenhub tts create` | 创建语音合成 |
| `listenhub tts list` | 列出语音合成 |
| `listenhub explainer create` | 创建讲解视频 |
| `listenhub explainer list` | 列出讲解视频 |
| `listenhub slides create` | 创建幻灯片 |
| `listenhub slides list` | 列出幻灯片 |
| `listenhub image create` | AI 生图 |
| `listenhub image list` | 列出图片 |
| `listenhub image get <id>` | 查看图片详情 |
| `listenhub speakers list` | 列出可用声音 |
| `listenhub creation get <id>` | 查看作品详情 |
| `listenhub creation delete <id...>` | 删除作品 |

每个命令都可以加 `--help` 查看完整选项。

## 认证

使用 OAuth 认证。运行 `listenhub auth login` 会打开浏览器授权。Token 存储在 `~/.config/listenhub/credentials.json`，过期前自动刷新。

## 许可证

MIT
