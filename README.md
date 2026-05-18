# ListenHub CLI

Command-line interface for [ListenHub](https://listenhub.ai) — create podcasts, text-to-speech, explainer videos, storybooks, AI images, music, and videos from your terminal.

[中文文档](README.zh-CN.md)

Built on [`@marswave/listenhub-sdk`](https://github.com/marswaveai/listenhub-sdk).

## Install

```bash
npm install -g @marswave/listenhub-cli
```

Requires Node.js >= 20.

## Two Ways to Authenticate

|               | OAuth Login                                                   | OpenAPI Key                                                               |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Setup         | `listenhub auth login` (opens browser)                        | Set `LISTENHUB_API_KEY` env var or run `listenhub openapi config set-key` |
| Commands      | `listenhub podcast`, `listenhub tts`, `listenhub music`, etc. | `listenhub openapi podcast`, `listenhub openapi tts`, etc.                |
| Best for      | Interactive use, account management                           | Scripts, CI/CD, programmatic access                                       |
| Token storage | `~/.config/listenhub/credentials.json`                        | `~/.config/listenhub/openapi.json` or env var                             |

Both methods provide access to the same underlying APIs. Choose whichever fits your workflow.

## Quick Start — OAuth

```bash
# Log in via browser
listenhub auth login

# Create a podcast
listenhub podcast create --query "AI agent trends in 2026" --mode quick

# Generate music
listenhub music generate --prompt "Chill lo-fi beats" --style "lo-fi" --title "Study Session"

# Text-to-speech
listenhub tts create --text "Hello, world" --lang en

# Generate an AI image
listenhub image create --prompt "a dragon in watercolor style" --reference ./sketch.png
```

## Quick Start — OpenAPI Key

```bash
# Set your API key (one-time)
export LISTENHUB_API_KEY="lh_sk_..."
# Or interactively:
listenhub openapi config set-key

# List speakers
listenhub openapi speakers list --language zh

# Text-to-speech (binary audio output)
listenhub openapi tts --text "Hello world" --voice <speaker-id> --output hello.mp3

# Create a podcast
listenhub openapi podcast create \
  --source-text "Quantum computing is changing cryptography" \
  --speaker-id <speaker-id> --no-wait -j

# Check subscription credits
listenhub openapi subscription -j
```

---

## OAuth Commands

### Auth

| Command                 | Description               |
| ----------------------- | ------------------------- |
| `listenhub auth login`  | Log in via browser OAuth  |
| `listenhub auth logout` | Log out and revoke tokens |
| `listenhub auth status` | Show current login status |

### Music

| Command                    | Description                         |
| -------------------------- | ----------------------------------- |
| `listenhub music generate` | Generate music from a text prompt   |
| `listenhub music cover`    | Create a cover from reference audio |
| `listenhub music list`     | List music tasks                    |
| `listenhub music get <id>` | Get music task details              |

### Content Creation

| Command                      | Description                 |
| ---------------------------- | --------------------------- |
| `listenhub podcast create`   | Create a podcast episode    |
| `listenhub podcast list`     | List podcast episodes       |
| `listenhub tts create`       | Create text-to-speech audio |
| `listenhub tts list`         | List TTS creations          |
| `listenhub explainer create` | Create an explainer video   |
| `listenhub explainer list`   | List explainer videos       |
| `listenhub slides create`    | Create a slide deck         |
| `listenhub slides list`      | List slide decks            |

### Images

| Command                    | Description          |
| -------------------------- | -------------------- |
| `listenhub image create`   | Generate an AI image |
| `listenhub image list`     | List AI images       |
| `listenhub image get <id>` | Get image details    |

### Video Generation

| Command                    | Description                    |
| -------------------------- | ------------------------------ |
| `listenhub video create`   | Create a video generation task |
| `listenhub video list`     | List video tasks               |
| `listenhub video get <id>` | Get video task details         |
| `listenhub video estimate` | Estimate credit cost           |

### Lyrics

| Command                         | Description                    |
| ------------------------------- | ------------------------------ |
| `listenhub lyrics extract <id>` | Extract lyrics from a creation |

### Other

| Command                             | Description             |
| ----------------------------------- | ----------------------- |
| `listenhub speakers list`           | List available speakers |
| `listenhub creation get <id>`       | Get creation details    |
| `listenhub creation delete <id...>` | Delete creations        |

---

## OpenAPI Key Commands

All commands below are under `listenhub openapi`.

### Config

| Command                  | Description               |
| ------------------------ | ------------------------- |
| `openapi config set-key` | Set API key interactively |
| `openapi config show`    | Show current key status   |
| `openapi config clear`   | Remove stored key         |

### Speakers

| Command                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `openapi speakers list` | List available speakers (filterable by `--language`) |

### TTS & Speech

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `openapi tts`          | Text-to-speech, saves audio file locally |
| `openapi audio-speech` | TTS (OpenAI-compatible endpoint)         |
| `openapi speech`       | Create speech, returns audio URL         |

### Flow Speech

| Command                                | Description                       |
| -------------------------------------- | --------------------------------- |
| `openapi flow-speech create`           | Create flow speech from URLs/text |
| `openapi flow-speech get <id>`         | Get flow speech details           |
| `openapi flow-speech tts`              | Create flow speech from scripts   |
| `openapi flow-speech text-stream <id>` | Stream generated text (SSE)       |

### Podcast

| Command                               | Description                      |
| ------------------------------------- | -------------------------------- |
| `openapi podcast create`              | Create a podcast episode         |
| `openapi podcast get <id>`            | Get podcast details              |
| `openapi podcast text-content`        | Generate text only (no audio)    |
| `openapi podcast generate-audio <id>` | Generate audio for existing text |
| `openapi podcast text-stream <id>`    | Stream generated text (SSE)      |

### Storybook

| Command                                 | Description                  |
| --------------------------------------- | ---------------------------- |
| `openapi storybook create`              | Create a storybook/explainer |
| `openapi storybook get <id>`            | Get storybook details        |
| `openapi storybook generate-video <id>` | Generate video for storybook |

### Image

| Command                | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `openapi image create` | Generate an AI image (supports local file + URL references) |

### Video

| Command                  | Description                  |
| ------------------------ | ---------------------------- |
| `openapi video create`   | Create video generation task |
| `openapi video get <id>` | Get video task details       |
| `openapi video list`     | List video tasks             |
| `openapi video estimate` | Estimate credit cost         |

### Content

| Command                    | Description                |
| -------------------------- | -------------------------- |
| `openapi content extract`  | Extract content from a URL |
| `openapi content get <id>` | Get extraction result      |

### Subscription

| Command                | Description                |
| ---------------------- | -------------------------- |
| `openapi subscription` | Show credits and plan info |

---

## Common Options

All commands support:

- `--json` / `-j` — Output JSON instead of human-readable text
- `--help` / `-h` — Show help

Creation commands also support:

- `--no-wait` — Return the ID immediately without polling
- `--timeout <seconds>` — Polling timeout (default varies by command)

## Local File Support

OAuth commands (`music cover`, `image create`, `video create`) auto-detect local paths, validate format/size, and upload to cloud storage before calling the API.

OpenAPI `image create` supports local file references via base64 encoding (no size limit enforced by CLI).

```bash
# OAuth: local audio for cover (mp3, wav, flac, m4a, ogg, aac; max 20MB)
listenhub music cover --audio ./song.mp3

# OAuth: local image reference (jpg, png, webp, gif; max 10MB)
listenhub image create --prompt "inspired by this" --reference ./photo.jpg

# OpenAPI: local image reference (base64 encoded)
listenhub openapi image create --prompt "in this style" --reference ./sketch.png --provider google

# URLs are passed through directly in both modes
listenhub openapi video create --prompt "same style" --reference-video https://example.com/clip.mp4 --input-video-duration 5
```

## Examples

### OpenAPI: Podcast workflow (text → audio)

```bash
# Step 1: Generate text content
listenhub openapi podcast text-content \
  --source-url https://example.com/article \
  --speaker-id voice-clone-xxx \
  --no-wait -j
# Returns: {"episodeId": "abc123"}

# Step 2: Check status
listenhub openapi podcast get abc123 -j

# Step 3: Generate audio from text
listenhub openapi podcast generate-audio abc123

# Step 4: Stream the script
listenhub openapi podcast text-stream abc123 --event script
```

### OpenAPI: Video generation

```bash
# Text-to-video
listenhub openapi video create --prompt "A cat playing piano" --no-wait -j

# With first frame
listenhub openapi video create --prompt "Camera zooms out" \
  --first-frame https://example.com/frame.png

# Estimate credits before creating
listenhub openapi video estimate --model doubao-seedance-2-pro --resolution 1080p --duration 10
```

### OAuth: Music generation

```bash
# Generate with style
listenhub music generate --prompt "Upbeat electronic dance" --style "EDM" --title "Night Drive"

# Instrumental only
listenhub music generate --prompt "Peaceful piano melody" --instrumental

# Cover from local file
listenhub music cover --audio ./original.mp3 --title "My Remix"
```

### JSON output for scripting

```bash
# Get ID without waiting, then poll
ID=$(listenhub openapi flow-speech create \
  --source-text "Some article content" \
  --speaker-id voice-xxx \
  --no-wait -j | jq -r '.episodeId')

listenhub openapi flow-speech get "$ID" -j
```

## Development

```bash
git clone https://github.com/marswaveai/listenhub-cli.git
cd listenhub-cli
pnpm install
pnpm run dev    # TypeScript watch mode
pnpm run build  # Build for distribution
pnpm test       # Run tests
pnpm run lint   # Lint
```

## License

[MIT](LICENSE)
