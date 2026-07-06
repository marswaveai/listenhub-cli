# 327 Review Round 1

## Scope

- Fix AI Video reference-media metadata drift for CLI create and estimate commands.

## Evidence

- `pnpm ready`: PASS, 5 files / 38 tests.
- `pnpm build`: PASS.
- `git diff --check`: PASS.

## Local Review

- Goal fit: `video create`, `openapi video create`, and `openapi video estimate` can now send top-level `referenceImages` / `referenceVideos` metadata.
- Regression coverage: OpenAPI command tests cover first-frame metadata, reference-video metadata, and estimate metadata.
- Risk: CLI uses local extension types so this PR builds against currently published `@marswave/listenhub-sdk@0.0.16`; after the SDK PR publishes, the local extension can be removed in a dependency bump.

## Gate Status

- Judgment: Needs More Evidence.
- Reason: independent reviewer isolation was not run because the available multi-agent tool requires explicit user authorization for subagents. This record is a local self-review only; PR requires human review.
