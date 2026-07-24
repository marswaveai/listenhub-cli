# Graph Report - listenhub-cli--436 (2026-07-16)

## Corpus Check

- 64 files · ~26,713 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 443 nodes · 998 edges · 17 communities (16 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.56)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `6a8e4f44`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- [[_COMMUNITY_output.ts|output.ts]]
- [[_COMMUNITY__cli.ts|_cli.ts]]
- [[_COMMUNITY_video.ts|video.ts]]
- [[_COMMUNITY_printJson|printJson]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_ListenHub CLI|ListenHub CLI]]
- [[_COMMUNITY_ListenHub CLI|ListenHub CLI]]
- [[_COMMUNITY_tts.ts|tts.ts]]
- [[_COMMUNITY_image-dimensions.ts|image-dimensions.ts]]
- [[_COMMUNITY_lyrics.ts|lyrics.ts]]
- [[_COMMUNITY_upload.ts|upload.ts]]
- [[_COMMUNITY__cli.ts|_cli.ts]]
- [[_COMMUNITY_ListenHub CLI|ListenHub CLI]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_client.test.ts|client.test.ts]]

## God Nodes (most connected - your core abstractions)

1. `printJson()` - 61 edges
2. `printDetail()` - 39 edges
3. `handleError()` - 25 edges
4. `printTable()` - 24 edges
5. `getOpenAPIClient()` - 16 edges
6. `scripts` - 12 edges
7. `getClient()` - 12 edges
8. `printMusicDetail()` - 12 edges
9. `ListenHub CLI` - 12 edges
10. `ListenHub CLI` - 12 edges

## Surprising Connections (you probably didn't know these)

- `createImage()` --calls--> `printJson()` [EXTRACTED]
  source/openapi/image.ts → source/\_shared/output.ts
- `runSpeech()` --calls--> `printJson()` [EXTRACTED]
  source/openapi/tts.ts → source/\_shared/output.ts
- `printFlowSpeechDetail()` --calls--> `printDetail()` [EXTRACTED]
  source/openapi/flow-speech.ts → source/\_shared/output.ts
- `printPodcastDetail()` --calls--> `printDetail()` [EXTRACTED]
  source/openapi/podcast.ts → source/\_shared/output.ts
- `printStorybookDetail()` --calls--> `printDetail()` [EXTRACTED]
  source/openapi/storybook.ts → source/\_shared/output.ts

## Import Cycles

- None detected.

## Communities (17 total, 1 thin omitted)

### Community 0 - "output.ts"

Cohesion: 0.08
Nodes (54): program, register(), deleteCreations(), getCreation(), collect(), register(), createExplainer(), ExplainerCreateOptions (+46 more)

### Community 1 - "\_cli.ts"

Cohesion: 0.05
Nodes (55): getOpenAPIClient(), getOpenAPIOptions(), register(), runClear(), runSetKey(), runShow(), deleteOpenAPIConfig(), getConfigDir() (+47 more)

### Community 2 - "video.ts"

Cohesion: 0.06
Nodes (53): collect(), getReferenceImages(), getReferenceVideos(), isHttpUrl(), OpenAPIEstimateVideoCreditsParamsWithMetadata, OpenAPIVideoGenerationParamsWithMetadata, pixVerseAgentTypes, pixVerseAspectRatios (+45 more)

### Community 3 - "printJson"

Cohesion: 0.13
Nodes (40): allowedMusicExtensions, audioExtensions, createCover(), createExtend(), createGenerate(), createInstrumental(), createRemix(), createSoundtrack() (+32 more)

### Community 4 - "package.json"

Cohesion: 0.05
Nodes (39): bin, listenhub, dependencies, commander, @marswave/listenhub-sdk, open, ora, description (+31 more)

### Community 5 - "ListenHub CLI"

Cohesion: 0.06
Nodes (34): Flow Speech, ListenHub CLI, OAuth 命令, OAuth：音乐生成, OpenAPI Key 命令, OpenAPI：PixVerse 视频生成, OpenAPI：播客工作流（文本 → 音频）, OpenAPI：视频生成 (+26 more)

### Community 6 - "ListenHub CLI"

Cohesion: 0.06
Nodes (34): Auth, Common Options, Config, Content, Content Creation, Development, Examples, Flow Speech (+26 more)

### Community 7 - "tts.ts"

Cohesion: 0.15
Nodes (15): collect(), createImage(), ImageCreateOptions, isUrl(), mimeTypes, register(), resolveReference(), formatBytes() (+7 more)

### Community 8 - "image-dimensions.ts"

Cohesion: 0.40
Nodes (12): byte(), ImageDimensions, matches(), parseGif(), parseJpeg(), parsePng(), parseWebp(), readImageDimensions() (+4 more)

### Community 9 - "lyrics.ts"

Cohesion: 0.30
Nodes (9): register(), createGenerate(), formatDateTime(), getTask(), listTasks(), LyricsGenerateOptions, LyricsListOptions, printLyricsDetail() (+1 more)

### Community 10 - "upload.ts"

Cohesion: 0.20
Nodes (9): allowedExtensions(), audioExtensions, categoryForType, FileAcceptType, FileUploadClient, imageExtensions, maxSizeBytes, mimeTypes (+1 more)

### Community 11 - "\_cli.ts"

Cohesion: 0.36
Nodes (6): runLogin(), runLogout(), runStatus(), register(), CallbackResult, startCallbackServer()

### Community 12 - "ListenHub CLI"

Cohesion: 0.33
Nodes (5): Build, Coding Guardrails, Key Patterns, ListenHub CLI, Structure

### Community 13 - "tsconfig.json"

Cohesion: 0.33
Nodes (5): compilerOptions, rootDir, types, extends, include

## Knowledge Gaps

- **163 isolated node(s):** `name`, `version`, `description`, `license`, `type` (+158 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `printJson()` connect `printJson` to `output.ts`, `_cli.ts`, `video.ts`, `tts.ts`, `lyrics.ts`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `printDetail()` connect `output.ts` to `_cli.ts`, `video.ts`, `printJson`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `handleError()` connect `output.ts` to `_cli.ts`, `video.ts`, `printJson`, `tts.ts`, `lyrics.ts`, `_cli.ts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _163 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `output.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07859649122807018 - nodes in this community are weakly interconnected._
- **Should `_cli.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05146242132543503 - nodes in this community are weakly interconnected._
- **Should `video.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.060814383923849816 - nodes in this community are weakly interconnected._
