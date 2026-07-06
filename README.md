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

| Command                        | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| `listenhub music generate`     | Generate music from a text prompt                      |
| `listenhub music cover`        | Create a cover from reference audio                    |
| `listenhub music extend`       | Extend music from reference audio                      |
| `listenhub music remix`        | Remix an existing song with new lyrics                 |
| `listenhub music instrumental` | Generate a standalone instrumental                     |
| `listenhub music soundtrack`   | Generate music from an image or video                  |
| `listenhub music track`        | Generate a single instrument/vocal track               |
| `listenhub music recognize`    | Recognize lyrics (with timestamps) from audio          |
| `listenhub music describe`     | Analyze audio (description, tags, genres, instruments) |
| `listenhub music stem`         | Separate audio into stems (download URLs)              |
| `listenhub music list`         | List music tasks                                       |
| `listenhub music get <id>`     | Get music task details                                 |

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

| Command                          | Description                  |
| -------------------------------- | ---------------------------- |
| `listenhub image create`         | Generate an AI image         |
| `listenhub image list`           | List AI images               |
| `listenhub image get <id>`       | Get image details            |
| `listenhub image delete <id...>` | Delete one or more AI images |

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

| Command                           | Description                                   |
| --------------------------------- | --------------------------------------------- |
| `openapi video create`            | Create video generation task                  |
| `openapi video get <id>`          | Get video task details                        |
| `openapi video list`              | List video tasks                              |
| `openapi video estimate`          | Estimate credit cost                          |
| `openapi video pixverse generate` | Create a PixVerse video task (atomic + agent) |
| `openapi video pixverse estimate` | Estimate PixVerse credit cost                 |

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
OpenAPI `video create` supports local image/video/audio paths via a presigned upload URL. For Seedance, local image references automatically include width/height metadata; remote image URLs and all reference videos still need explicit metadata.

```bash
# OAuth: local audio for cover (mp3, wav, flac, m4a, ogg, aac; max 20MB)
listenhub music cover --audio ./song.mp3

# OAuth: local image reference (jpg, png, webp, gif; max 10MB)
listenhub image create --prompt "inspired by this" --reference ./photo.jpg

# OpenAPI: local image reference (base64 encoded)
listenhub openapi image create --prompt "in this style" --reference ./sketch.png --provider google

# OpenAPI Seedance: local image references auto-populate width/height metadata
listenhub openapi video create --prompt "same style" --first-frame ./frame.png

# Remote URLs and reference videos need dimensions to avoid server-side 32004 validation errors
listenhub openapi video create --prompt "same style" \
  --reference-video https://example.com/clip.mp4 \
  --reference-video-meta 1280x720:5:30:8000000 \
  --input-video-duration 5
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

# With local first frame (auto-upload + auto metadata)
listenhub openapi video create --prompt "Camera zooms out" \
  --first-frame ./frame.png

# With remote first frame
listenhub openapi video create --prompt "Camera zooms out" \
  --first-frame https://example.com/frame.png \
  --first-frame-meta 1080x1920:3600000

# Estimate credits before creating
listenhub openapi video estimate --model doubao-seedance-2-pro --resolution 1080p --duration 10
```

### OpenAPI: PixVerse video generation

PixVerse covers atomic capabilities (`text_to_video`, `image_to_video`, `transition`, `multi_transition`, `fusion`, `restyle`, `mimic`, `lip_sync`) and the marketing `agent` (`ad_master` / `promo_mix`). `--capability` is required. `--language en` (default) uses the international service; `--language zh` uses the China service. Image/video/audio assets accept an optional `:duration` suffix (`url:seconds`). For rarely-used nested fields use the `--pixverse-json` escape hatch.

```bash
# Text-to-video
listenhub openapi video pixverse generate --capability text_to_video \
  --prompt "A cat playing piano" --quality 720p --aspect-ratio 16:9 --duration 5 --no-wait -j

# Image-to-video (assets accept url:duration)
listenhub openapi video pixverse generate --capability image_to_video \
  --image https://example.com/photo.jpg --prompt "Camera slowly zooms in"

# Lip-sync TTS, reusing a prior succeeded PixVerse task
listenhub openapi video pixverse generate --capability lip_sync \
  --source-task-id 6a2016607ebd26d050c585ca \
  --lip-sync-tts --lip-sync-speaker-id speaker-1 --lip-sync-content "Hello world"

# Marketing agent (promo_mix needs >=4 product images)
listenhub openapi video pixverse generate --capability agent --agent-type promo_mix \
  --quality 1080p --duration 30 \
  --image https://example.com/p1.jpg --image https://example.com/p2.jpg \
  --image https://example.com/p3.jpg --image https://example.com/p4.jpg

# Escape hatch for nested pixverse fields
listenhub openapi video pixverse generate --capability fusion \
  --prompt "@hero stands in @bg" \
  --pixverse-json '{"imageReferences":[{"type":"subject","imageUrl":"https://example.com/hero.png","refName":"hero"},{"type":"background","imageUrl":"https://example.com/bg.png","refName":"bg"}]}'

# Estimate credits
listenhub openapi video pixverse estimate --capability text_to_video --quality 720p --duration 5
listenhub openapi video pixverse estimate --capability agent --agent-type ad_master --duration 30
```

### OAuth: Music generation

```bash
# Generate with style
listenhub music generate --prompt "Upbeat electronic dance" --style "EDM" --title "Night Drive"

# Instrumental only
listenhub music generate --prompt "Peaceful piano melody" --instrumental

# Cover from local file
listenhub music cover --audio ./original.mp3 --title "My Remix"

# Remix an existing song with new lyrics (file, --audio-url, or --provider-song-id)
listenhub music remix ./original.mp3 --lyrics "New verse..." --prompt "Lo-fi hip hop"

# Standalone instrumental (--prompt XOR --reference-audio)
listenhub music instrumental --prompt "Cinematic orchestral build-up" --model mureka-8

# Soundtrack from an image or video (--image XOR --video)
listenhub music soundtrack --image ./cover.png --prompt "Dreamy synthwave"

# Single instrument/vocal track (--audio XOR --provider-song-id)
listenhub music track ./song.mp3 --generate-type Drums --prompt "Punchy breakbeat"
listenhub music track --provider-song-id abc123 --generate-type Vocals \
  --prompt "Soulful chorus" --lyrics "Hold on..." --vocal-gender female

# Sync analysis commands (print immediately)
listenhub music recognize --audio ./song.mp3
listenhub music describe --audio ./song.mp3
listenhub music stem --audio ./song.mp3 --model audio-separation-2
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
