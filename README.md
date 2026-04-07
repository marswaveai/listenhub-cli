# ListenHub CLI

Command-line interface for [ListenHub](https://listenhub.ai) — create podcasts, text-to-speech, explainer videos, slides, AI images, and music from your terminal.

[中文文档](README.zh-CN.md)

Built on [`@marswave/listenhub-sdk`](https://github.com/marswaveai/listenhub-sdk).

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

# Generate music
listenhub music generate --prompt "Chill lo-fi beats" --style "lo-fi" --title "Study Session"

# Create a cover from local audio
listenhub music cover --audio ./song.mp3 --title "My Cover"

# Generate an AI image with a local reference
listenhub image create --prompt "a dragon in watercolor style" --reference ./sketch.png

# Text-to-speech
listenhub tts create --text "Hello, world" --lang en
```

## Commands

### Auth

| Command | Description |
|---------|-------------|
| `listenhub auth login` | Log in via browser OAuth |
| `listenhub auth logout` | Log out and revoke tokens |
| `listenhub auth status` | Show current login status |

### Music

| Command | Description |
|---------|-------------|
| `listenhub music generate` | Generate music from a text prompt |
| `listenhub music cover` | Create a cover from reference audio |
| `listenhub music list` | List music tasks |
| `listenhub music get <id>` | Get music task details |

### Content Creation

| Command | Description |
|---------|-------------|
| `listenhub podcast create` | Create a podcast episode |
| `listenhub podcast list` | List podcast episodes |
| `listenhub tts create` | Create text-to-speech audio |
| `listenhub tts list` | List TTS creations |
| `listenhub explainer create` | Create an explainer video |
| `listenhub explainer list` | List explainer videos |
| `listenhub slides create` | Create a slide deck |
| `listenhub slides list` | List slide decks |

### Images

| Command | Description |
|---------|-------------|
| `listenhub image create` | Generate an AI image |
| `listenhub image list` | List AI images |
| `listenhub image get <id>` | Get image details |

### Other

| Command | Description |
|---------|-------------|
| `listenhub speakers list` | List available speakers |
| `listenhub creation get <id>` | Get creation details |
| `listenhub creation delete <id...>` | Delete creations |

Run `listenhub <command> --help` for full options.

## Common Options

All commands support:

- `--json` / `-j` — Output JSON instead of human-readable text
- `--help` / `-h` — Show help

Creation commands also support:

- `--no-wait` — Return the ID immediately without polling
- `--timeout <seconds>` — Polling timeout (default varies by command)

## Local File Upload

`music cover` and `image create` support local file references. The CLI automatically detects local paths, validates format and size, and uploads to cloud storage before passing to the API.

```bash
# Local audio file for cover (mp3, wav, flac, m4a, ogg, aac; max 20MB)
listenhub music cover --audio ./song.mp3

# Local image for reference (jpg, png, webp, gif; max 10MB)
listenhub image create --prompt "inspired by this" --reference ./photo.jpg

# URLs are passed through directly
listenhub music cover --audio https://example.com/song.mp3
```

## Authentication

ListenHub CLI uses OAuth. Run `listenhub auth login` to open a browser window for authorization. Tokens are stored at `~/.config/listenhub/credentials.json` (or `$XDG_CONFIG_HOME/listenhub/`).

Tokens auto-refresh when nearing expiry. Run `listenhub auth status` to check.

## Examples

### Music generation

```bash
# Generate with style and title
listenhub music generate --prompt "Upbeat electronic dance" --style "EDM" --title "Night Drive"

# Instrumental only
listenhub music generate --prompt "Peaceful piano melody" --instrumental

# Cover from local file
listenhub music cover --audio ./original.mp3 --title "My Remix"

# Get task ID without waiting
ID=$(listenhub music generate --prompt "test" --no-wait --json | jq -r '.taskId')
listenhub music get "$ID" --json
```

### Podcast with reference material

```bash
listenhub podcast create \
  --query "Climate change solutions" \
  --mode deep \
  --source-url https://example.com/article \
  --lang en
```

### Image with local reference

```bash
listenhub image create \
  --prompt "A landscape painting in this style" \
  --reference ./sketch.jpg \
  --reference ./palette.png \
  --aspect-ratio 16:9 --size 4K
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

[MIT](LICENSE)
