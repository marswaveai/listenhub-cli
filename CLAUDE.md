# ListenHub CLI

CLI wrapping `@marswave/listenhub-sdk`. Commander.js flat command structure.

## Structure

```
source/
├── cli.ts              # Entry point, registers all commands
├── _shared/            # Shared utilities
│   ├── client.ts       # Authenticated client factory (auto-refresh, single-flight)
│   ├── credentials.ts  # Token storage (~/.config/listenhub/, atomic write, 0600)
│   ├── output.ts       # Print helpers, error handling, exit codes
│   ├── polling.ts      # Episode + image + music polling with ora spinner
│   ├── upload.ts       # resolveFileOrUrl: local file → GCS upload → URL, or URL pass-through
│   ├── sources.ts      # --source-url/--source-text → ContentSource[]
│   ├── speaker-resolver.ts  # Speaker name → speakerInnerId resolution
│   └── language.ts     # CJK/Kana detection for auto language inference
├── auth/               # OAuth login/logout/status
├── podcast/            # podcast create/list
├── tts/                # tts create/list
├── explainer/          # explainer create/list (template type: 'storybook')
├── slides/             # slides create/list (mode fixed: 'slides', skipAudio default)
├── music/              # music generate/cover/list/get
├── image/              # image create/list/get (--reference supports local files + URLs)
├── speakers/           # speakers list
└── creation/           # creation get/delete
```

Each command module: `_cli.ts` (Commander registration) + implementation file.

## Key Patterns

- Auth: OAuth only, no API key. Tokens at `$XDG_CONFIG_HOME/listenhub/credentials.json`
- Output: `--json` for machine output, human-readable default. Errors to stderr
- Polling: 10s interval, configurable `--timeout`. `--no-wait` skips polling
- File upload: `resolveFileOrUrl()` auto-detects local path vs URL; validates extension/size, uploads to GCS via presigned URL, returns storage.googleapis.com URL for server re-signing
- Exit codes: 0=success, 1=error, 2=auth (`CliAuthError`), 3=timeout (`CliTimeoutError`)
- SDK: all HTTP through `@marswave/listenhub-sdk`, except GCS PUT (native fetch)

## Build

```bash
npm run dev     # tsc --watch
npm run build   # tsc + chmod +x
npm test        # xo lint
```

ESM only. TypeScript strict mode via `@sindresorhus/tsconfig`.
