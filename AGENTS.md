# ListenHub CLI

CLI wrapping `@marswave/listenhub-sdk`. Commander.js flat command structure.

## Coding Guardrails

- Think before coding: restate the goal, surface assumptions and trade-offs, and ask when requirements are ambiguous.
- Keep it simple: choose the smallest working change; avoid speculative abstractions, configurability, or broad rewrites.
- Make surgical edits: touch only the files and lines required, follow local style, and leave unrelated cleanup alone.
- Verify against the goal: define the relevant checks up front, run the focused validation, and keep iterating until the stated goal is satisfied.
- Comment discipline: comment only what the code cannot say — invariants, trade-offs, external constraints, hard-won gotchas. Delete comments that restate the code or argue the change is correct. Mark deliberate simplifications with a `ponytail:` comment noting the ceiling and upgrade path.

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
│   ├── language.ts     # CJK/Kana detection for auto language inference
│   └── image-dimensions / mp4-duration / video-*.ts  # media metadata helpers
├── auth/               # OAuth login/logout/status
├── podcast/            # podcast create/list
├── tts/                # tts create/list
├── explainer/          # explainer create/list (template type: 'storybook')
├── slides/             # slides create/list (mode fixed: 'slides', skipAudio default)
├── music/              # music generate/cover/list/get
├── image/              # image create/list/get (--reference supports local files + URLs)
├── lyrics/             # lyrics generate/list/get
├── video/              # video create/estimate/list/get
├── speakers/           # speakers list
├── creation/           # creation get/delete
└── openapi/            # `openapi` command group: API-key–based commands (config, tts, podcast, storybook, image, video, music, content, subscription, ...)
```

Each command module: `_cli.ts` (Commander registration) + implementation file.

## Key Patterns

- Auth: OAuth for user commands, tokens at `$XDG_CONFIG_HOME/listenhub/credentials.json`; the `openapi` command group uses `lh_sk_` API keys (`$XDG_CONFIG_HOME/listenhub/openapi.json` or env)
- Output: `--json` for machine output, human-readable default. Errors to stderr
- Polling: 10s interval, configurable `--timeout`. `--no-wait` skips polling
- File upload: `resolveFileOrUrl()` auto-detects local path vs URL; validates extension/size, uploads to GCS via presigned URL, returns storage.googleapis.com URL for server re-signing
- Exit codes: 0=success, 1=error, 2=auth (`CliAuthError`), 3=timeout (`CliTimeoutError`)
- SDK: all HTTP through `@marswave/listenhub-sdk`, except GCS PUT (native fetch)

## Build

```bash
pnpm dev     # vp pack --watch
pnpm build   # vp pack
pnpm test    # vp test run
pnpm ready   # vp check && vp test run — run before PR
```

ESM only. TypeScript strict mode via `@sindresorhus/tsconfig`.
