# OpenAPI Key CLI Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `listenhub openapi` subcommand group for API Key–based access to all ListenHub OpenAPI endpoints.

**Architecture:** New `source/openapi/` module with its own config storage, client factory, and command files — fully isolated from OAuth commands. Shares `_shared/output.ts` for error/output formatting. Adds a generic `pollOpenAPI()` helper for async task polling.

**Tech Stack:** TypeScript ESM, Commander.js, `@marswave/listenhub-sdk` (OpenAPIClient), ora (spinner), vitest (tests)

---

## File Map

| File | Responsibility |
|------|---------------|
| `source/openapi/_cli.ts` | Thin dispatcher: creates `openapi` Command, calls each module's `register(openapi)` |
| `source/openapi/client.ts` | `getOpenAPIClient()`: load key → instantiate SDK OpenAPIClient |
| `source/openapi/config.ts` | `loadOpenAPIConfig` / `saveOpenAPIConfig` / `deleteOpenAPIConfig` |
| `source/openapi/config-cmd.ts` | `config set-key` / `show` / `clear` — exports `register(openapi)` |
| `source/openapi/polling.ts` | Generic `pollOpenAPI()` helper for all async OpenAPI tasks |
| `source/openapi/speakers.ts` | `speakers list` — exports `register(openapi)` |
| `source/openapi/tts.ts` | `tts` + `audio-speech` + `speech` — exports `register(openapi)` |
| `source/openapi/flow-speech.ts` | `flow-speech create/get/tts/text-stream` — exports `register(openapi)` |
| `source/openapi/podcast.ts` | `podcast create/get/text-content/generate-audio/text-stream` — exports `register(openapi)` |
| `source/openapi/storybook.ts` | `storybook create/get/generate-video` — exports `register(openapi)` |
| `source/openapi/image.ts` | `image create` (with base64 reference) — exports `register(openapi)` |
| `source/openapi/video.ts` | `video create/get/list/estimate` — exports `register(openapi)` |
| `source/openapi/content.ts` | `content extract/get` — exports `register(openapi)` |
| `source/openapi/subscription.ts` | `subscription` — exports `register(openapi)` |
| `source/cli.ts` | Modified: add `registerOpenApi(program)` |
| `tests/openapi/config.test.ts` | Unit tests for config read/write/validate |
| `tests/openapi/client.test.ts` | Unit tests for client factory |
| `tests/openapi/polling.test.ts` | Unit tests for generic poller |
| `tests/openapi/commands.test.ts` | Integration tests: mock OpenAPIClient, verify command arg mapping & output |

## Architecture Note: Self-Registering Modules

Each command module exports its own `register(openapi: Command)` function that adds subcommands directly.
`_cli.ts` is written **once** in Task 6 and never touched again — it just calls all `register*` functions.
This means Tasks 7–14 each touch **only their own file** (+ their test), eliminating merge conflicts for parallel work.

## Validation Pattern: Repeatable Required Options

Commander's `requiredOption(..., collect, [])` does NOT enforce non-empty arrays (the default `[]` counts as "present").
All commands that need at least one value for repeatable options (e.g. `--speaker-id`) MUST validate non-empty in the action handler before calling the implementation function:

```ts
if (options.speakerId.length === 0) {
  throw new Error('At least one --speaker-id is required');
}
```

Use `.option(...)` (not `.requiredOption(...)`) for repeatable fields, and validate explicitly.

---

### Task 1: Upgrade SDK & Setup

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Upgrade `@marswave/listenhub-sdk` to latest**

```bash
cd ~/coding/marswave/listenhub-cli/.worktrees/listenhub-cli--134
pnpm add @marswave/listenhub-sdk@latest
```

Verify `OpenAPIClient` is exported:
```bash
node -e "import('@marswave/listenhub-sdk').then(m => console.log(typeof m.OpenAPIClient))"
```
Expected: `function`

- [ ] **Step 2: Verify existing tests still pass**

```bash
pnpm run ready
```
Expected: PASS (lint + tests)

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: upgrade listenhub-sdk to latest (OpenAPIClient support)"
```

---

### Task 2: Config Module (Storage Layer)

**Files:**
- Create: `source/openapi/config.ts`
- Create: `tests/openapi/config.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/openapi/config.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
	deleteOpenAPIConfig,
	loadOpenAPIConfig,
	saveOpenAPIConfig,
	validateApiKey,
} from '../../source/openapi/config.js';

describe('validateApiKey', () => {
	it('accepts valid key format', () => {
		expect(validateApiKey('lh_sk_abc123_secret456')).toBe(true);
	});

	it('rejects key without lh_sk_ prefix', () => {
		expect(validateApiKey('sk_abc123_secret456')).toBe(false);
	});

	it('rejects empty string', () => {
		expect(validateApiKey('')).toBe(false);
	});
});

describe('config persistence', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-cli-test-'));
		vi.stubEnv('XDG_CONFIG_HOME', tmpDir);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		fs.rmSync(tmpDir, {recursive: true, force: true});
	});

	it('returns undefined when no config exists', async () => {
		const config = await loadOpenAPIConfig();
		expect(config).toBeUndefined();
	});

	it('saves and loads config', async () => {
		await saveOpenAPIConfig({apiKey: 'lh_sk_test_key'});
		const config = await loadOpenAPIConfig();
		expect(config).toEqual({apiKey: 'lh_sk_test_key'});
	});

	it('creates file with 0600 permissions', async () => {
		await saveOpenAPIConfig({apiKey: 'lh_sk_test_key'});
		const filePath = path.join(tmpDir, 'listenhub', 'openapi.json');
		const stat = fs.statSync(filePath);
		expect(stat.mode & 0o777).toBe(0o600);
	});

	it('deletes config', async () => {
		await saveOpenAPIConfig({apiKey: 'lh_sk_test_key'});
		await deleteOpenAPIConfig();
		const config = await loadOpenAPIConfig();
		expect(config).toBeUndefined();
	});

	it('delete is idempotent', async () => {
		await deleteOpenAPIConfig();
		// Should not throw
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test run tests/openapi/config.test.ts
```
Expected: FAIL (module not found)

- [ ] **Step 3: Implement config module**

Create `source/openapi/config.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

export interface OpenAPIConfig {
	apiKey: string;
}

function getConfigDir(): string {
	const xdg = process.env['XDG_CONFIG_HOME'];
	return path.join(xdg ?? path.join(os.homedir(), '.config'), 'listenhub');
}

function getConfigPath(): string {
	return path.join(getConfigDir(), 'openapi.json');
}

export function validateApiKey(key: string): boolean {
	return key.startsWith('lh_sk_') && key.length > 6;
}

export async function loadOpenAPIConfig(): Promise<OpenAPIConfig | undefined> {
	const filePath = getConfigPath();
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(raw) as OpenAPIConfig;
	} catch {
		return undefined;
	}
}

export async function saveOpenAPIConfig(config: OpenAPIConfig): Promise<void> {
	const dir = getConfigDir();
	fs.mkdirSync(dir, {recursive: true});

	const filePath = getConfigPath();
	const tmpPath = `${filePath}.tmp.${process.pid}`;

	fs.writeFileSync(tmpPath, JSON.stringify(config, null, '\t'), {mode: 0o600});
	fs.renameSync(tmpPath, filePath);
}

export async function deleteOpenAPIConfig(): Promise<void> {
	const filePath = getConfigPath();
	try {
		fs.unlinkSync(filePath);
	} catch (error) {
		if (
			error instanceof Error &&
			'code' in error &&
			(error as NodeJS.ErrnoException).code === 'ENOENT'
		) {
			return;
		}

		throw error;
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test run tests/openapi/config.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add source/openapi/config.ts tests/openapi/config.test.ts
git commit -m "feat(openapi): add config storage module with key validation"
```

---

### Task 3: Client Factory

**Files:**
- Create: `source/openapi/client.ts`
- Create: `tests/openapi/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/openapi/client.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {getOpenAPIClient} from '../../source/openapi/client.js';

describe('getOpenAPIClient', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-cli-test-'));
		vi.stubEnv('XDG_CONFIG_HOME', tmpDir);
		vi.stubEnv('LISTENHUB_API_KEY', '');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		fs.rmSync(tmpDir, {recursive: true, force: true});
	});

	it('throws when no key is configured', async () => {
		await expect(getOpenAPIClient()).rejects.toThrow(/API Key/);
	});

	it('uses LISTENHUB_API_KEY env var', async () => {
		vi.stubEnv('LISTENHUB_API_KEY', 'lh_sk_env_secret');
		const client = await getOpenAPIClient();
		expect(client).toBeDefined();
	});

	it('uses config file when env var is absent', async () => {
		const dir = path.join(tmpDir, 'listenhub');
		fs.mkdirSync(dir, {recursive: true});
		fs.writeFileSync(
			path.join(dir, 'openapi.json'),
			JSON.stringify({apiKey: 'lh_sk_file_secret'}),
			{mode: 0o600},
		);
		const client = await getOpenAPIClient();
		expect(client).toBeDefined();
	});

	it('env var takes priority over config file', async () => {
		vi.stubEnv('LISTENHUB_API_KEY', 'lh_sk_env_priority');
		const dir = path.join(tmpDir, 'listenhub');
		fs.mkdirSync(dir, {recursive: true});
		fs.writeFileSync(
			path.join(dir, 'openapi.json'),
			JSON.stringify({apiKey: 'lh_sk_file_lower'}),
			{mode: 0o600},
		);
		const client = await getOpenAPIClient();
		expect(client).toBeDefined();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test run tests/openapi/client.test.ts
```
Expected: FAIL (module not found)

- [ ] **Step 3: Implement client factory**

Create `source/openapi/client.ts`:

```ts
import {OpenAPIClient} from '@marswave/listenhub-sdk';
import process from 'node:process';
import {loadOpenAPIConfig} from './config.js';

export async function getOpenAPIClient(): Promise<OpenAPIClient> {
	const envKey = process.env['LISTENHUB_API_KEY'];
	if (envKey) {
		return new OpenAPIClient({apiKey: envKey});
	}

	const config = await loadOpenAPIConfig();
	if (config?.apiKey) {
		return new OpenAPIClient({apiKey: config.apiKey});
	}

	throw new Error(
		'No API Key configured. Set LISTENHUB_API_KEY env var or run `listenhub openapi config set-key`.',
	);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test run tests/openapi/client.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add source/openapi/client.ts tests/openapi/client.test.ts
git commit -m "feat(openapi): add client factory with env/file key resolution"
```

---

### Task 4: Generic OpenAPI Polling Helper

**Files:**
- Create: `source/openapi/polling.ts`
- Create: `tests/openapi/polling.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/openapi/polling.test.ts`:

```ts
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {pollOpenAPI} from '../../source/openapi/polling.js';

vi.mock('ora', () => ({
	default: () => ({start: () => ({text: '', succeed: vi.fn(), fail: vi.fn()})}),
}));

describe('pollOpenAPI', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('resolves when isDone returns true', async () => {
		const getStatus = vi.fn().mockResolvedValue({processStatus: 'success', audioUrl: 'x'});
		const promise = pollOpenAPI({
			getStatus,
			isDone: (r: {processStatus: string}) => r.processStatus === 'success',
			isFailed: (r: {processStatus: string}) => r.processStatus === 'failed',
			options: {timeout: 60, json: true},
		});

		const result = await promise;
		expect(result).toEqual({processStatus: 'success', audioUrl: 'x'});
		expect(getStatus).toHaveBeenCalledTimes(1);
	});

	it('throws on failure', async () => {
		const getStatus = vi.fn().mockResolvedValue({processStatus: 'failed', message: 'bad', failCode: 42});
		const promise = pollOpenAPI({
			getStatus,
			isDone: (r: {processStatus: string}) => r.processStatus === 'success',
			isFailed: (r: {processStatus: string}) => r.processStatus === 'failed',
			getErrorMessage: (r: {message?: string; failCode?: number}) =>
				`${r.message ?? 'Unknown'} (code: ${String(r.failCode ?? 0)})`,
			options: {timeout: 60, json: true},
		});

		await expect(promise).rejects.toThrow('bad (code: 42)');
	});

	it('throws CliTimeoutError when timeout exceeded', async () => {
		let callCount = 0;
		const getStatus = vi.fn().mockImplementation(async () => {
			callCount++;
			return {processStatus: 'processing'};
		});

		const promise = pollOpenAPI({
			getStatus,
			isDone: (r: {processStatus: string}) => r.processStatus === 'success',
			isFailed: (r: {processStatus: string}) => r.processStatus === 'failed',
			options: {timeout: 20, json: true},
		});

		await expect(promise).rejects.toThrow(/Timed out/);
		expect(callCount).toBe(2); // 20s / 10s interval = 2 attempts
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test run tests/openapi/polling.test.ts
```
Expected: FAIL (module not found)

- [ ] **Step 3: Implement generic poller**

Create `source/openapi/polling.ts`:

```ts
import ora from 'ora';
import {CliTimeoutError} from '../_shared/output.js';

const pollIntervalMs = 10_000;
const defaultTimeoutS = 300;

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export interface PollOptions {
	timeout?: number;
	label?: string;
	json?: boolean;
}

export interface PollConfig<T> {
	getStatus: () => Promise<T>;
	isDone: (result: T) => boolean;
	isFailed: (result: T) => boolean;
	getErrorMessage?: (result: T) => string;
	options: PollOptions;
}

export async function pollOpenAPI<T>(config: PollConfig<T>): Promise<T> {
	const {getStatus, isDone, isFailed, getErrorMessage, options} = config;
	const timeoutS = options.timeout ?? defaultTimeoutS;
	const maxAttempts = Math.ceil(timeoutS / (pollIntervalMs / 1000));
	const label = options.label ?? 'Processing';

	const spinner = options.json
		? undefined
		: ora({text: `${label}... (1/${maxAttempts})`}).start();

	for (let i = 0; i < maxAttempts; i++) {
		if (i > 0) {
			await sleep(pollIntervalMs); // eslint-disable-line no-await-in-loop
		}

		const result = await getStatus(); // eslint-disable-line no-await-in-loop

		if (isDone(result)) {
			spinner?.succeed(`${label} complete`);
			return result;
		}

		if (isFailed(result)) {
			const msg = getErrorMessage?.(result) ?? 'Task failed';
			spinner?.fail(msg);
			throw new Error(msg);
		}

		if (spinner) {
			spinner.text = `${label}... (${String(i + 2)}/${maxAttempts})`;
		}
	}

	spinner?.fail('Timed out');
	throw new CliTimeoutError(`Timed out after ${timeoutS}s`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test run tests/openapi/polling.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add source/openapi/polling.ts tests/openapi/polling.test.ts
git commit -m "feat(openapi): add generic polling helper for async tasks"
```

---

### Task 5: (Merged into Task 6)

Config command implementation is now part of Task 6 (CLI Registration) since `config-cmd.ts` exports its own `register()`.

---

### Task 6: CLI Registration (Entry Point)

**Files:**
- Create: `source/openapi/_cli.ts`
- Modify: `source/cli.ts`

- [ ] **Step 1: Create the openapi CLI registration (thin dispatcher)**

Create `source/openapi/_cli.ts`:

```ts
import type {Command} from 'commander';
import {register as registerConfig} from './config-cmd.js';

export function register(program: Command) {
	const openapi = program.command('openapi').description('OpenAPI Key–based commands');
	registerConfig(openapi);
	// Additional register*() calls will be added by subsequent tasks
}
```

- [ ] **Step 2: Create config-cmd with register export**

Create `source/openapi/config-cmd.ts`:

```ts
import type {Command} from 'commander';
import process from 'node:process';
import readline from 'node:readline/promises';
import {handleError} from '../_shared/output.js';
import {deleteOpenAPIConfig, loadOpenAPIConfig, saveOpenAPIConfig, validateApiKey} from './config.js';

async function runSetKey(): Promise<void> {
	const rl = readline.createInterface({input: process.stdin, output: process.stderr});
	try {
		const key = await rl.question('Enter your API Key (lh_sk_...): ');
		const trimmed = key.trim();

		if (!validateApiKey(trimmed)) {
			console.error('✗ Invalid API Key format. Must start with "lh_sk_".');
			process.exit(1); // eslint-disable-line unicorn/no-process-exit
		}

		await saveOpenAPIConfig({apiKey: trimmed});
		const keyId = trimmed.split('_').slice(0, 3).join('_');
		console.log(`✓ API Key saved (${keyId}_***)`);
	} finally {
		rl.close();
	}
}

async function runShow(json: boolean): Promise<void> {
	const envKey = process.env['LISTENHUB_API_KEY'];
	if (envKey) {
		const keyId = envKey.split('_').slice(0, 3).join('_');
		if (json) {
			console.log(JSON.stringify({source: 'env', keyId}, null, 2));
		} else {
			console.log(`✓ API Key configured (source: env)`);
			console.log(`  Key ID: ${keyId}_***`);
		}

		return;
	}

	const config = await loadOpenAPIConfig();
	if (config?.apiKey) {
		const keyId = config.apiKey.split('_').slice(0, 3).join('_');
		if (json) {
			console.log(JSON.stringify({source: 'file', keyId}, null, 2));
		} else {
			console.log(`✓ API Key configured (source: file)`);
			console.log(`  Key ID: ${keyId}_***`);
		}

		return;
	}

	if (json) {
		console.log(JSON.stringify({source: null}, null, 2));
	} else {
		console.log('No API Key configured. Run `listenhub openapi config set-key` or set LISTENHUB_API_KEY.');
	}

	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

async function runClear(): Promise<void> {
	await deleteOpenAPIConfig();
	console.log('✓ API Key cleared');
}

export function register(openapi: Command) {
	const config = openapi.command('config').description('Manage API Key configuration');

	config
		.command('set-key')
		.description('Set your API Key interactively')
		.action(async () => {
			try {
				await runSetKey();
			} catch (error) {
				handleError(error, false);
			}
		});

	config
		.command('show')
		.description('Show current API Key status')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {json: boolean}) => {
			try {
				await runShow(options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	config
		.command('clear')
		.description('Remove stored API Key')
		.action(async () => {
			try {
				await runClear();
			} catch (error) {
				handleError(error, false);
			}
		});
}
```

- [ ] **Step 3: Register in main cli.ts**

Add to `source/cli.ts` after the last existing `register` import:

```ts
import {register as registerOpenApi} from './openapi/_cli.js';
```

Add after the last `register*(program)` call:

```ts
registerOpenApi(program);
```

- [ ] **Step 4: Build and verify config commands work**

```bash
pnpm run lint && pnpm run build
node dist/cli.mjs openapi config show
```
Expected: "No API Key configured" message, exit 1

- [ ] **Step 5: Commit**

```bash
git add source/openapi/_cli.ts source/openapi/config-cmd.ts source/cli.ts
git commit -m "feat(openapi): register openapi subcommand group with config commands"
```

---

### Task 7: Speakers Command

**Files:**
- Create: `source/openapi/speakers.ts`
- Modify: `source/openapi/_cli.ts` (one-line import + call)

- [ ] **Step 1: Implement speakers module with self-registration**

Create `source/openapi/speakers.ts`:

```ts
import type {Command} from 'commander';
import type {OpenAPIClient} from '@marswave/listenhub-sdk';
import {handleError, printJson, printTable} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';

async function listSpeakers(
	client: OpenAPIClient,
	options: {language?: string; json: boolean},
): Promise<void> {
	const {items} = await client.listSpeakers({
		language: options.language,
	});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['Name', 'ID', 'Gender', 'Language'];
	const rows = items.map((s) => [s.name, s.speakerId, s.gender, s.language]);
	printTable(headers, rows);
}

export function register(openapi: Command) {
	const speakers = openapi.command('speakers').description('Speaker management');

	speakers
		.command('list')
		.description('List available speakers')
		.option('--language <lang>', 'Filter by language')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {language?: string; json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				await listSpeakers(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
```

- [ ] **Step 2: Add to `_cli.ts` dispatcher**

Add import and call in `source/openapi/_cli.ts`:

```ts
import {register as registerSpeakers} from './speakers.js';
// inside register():
registerSpeakers(openapi);
```

- [ ] **Step 3: Build and lint**

```bash
pnpm run lint && pnpm run build
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add source/openapi/speakers.ts source/openapi/_cli.ts
git commit -m "feat(openapi): add speakers list command"
```

---

### Task 8: TTS & Speech Commands

**Files:**
- Create: `source/openapi/tts.ts`
- Modify: `source/openapi/_cli.ts` (one-line import + call)

- [ ] **Step 1: Implement TTS module with self-registration**

Create `source/openapi/tts.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import type {Command} from 'commander';
import type {OpenAPIClient} from '@marswave/listenhub-sdk';
import {handleError, printJson} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';

type TtsOptions = {
	text: string;
	voice: string;
	output: string;
	format: string;
};

type SpeechOptions = {
	script: string;
	speakerId: string;
	json: boolean;
};

async function runTts(client: OpenAPIClient, options: TtsOptions): Promise<void> {
	const response = await client.tts({
		input: options.text,
		voice: options.voice,
		response_format: options.format as 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | undefined,
	});

	const outputPath = path.resolve(options.output);
	const body = response.body;
	if (!body) {
		throw new Error('Empty response body');
	}

	const writeStream = fs.createWriteStream(outputPath);
	await pipeline(Readable.fromWeb(body as ReadableStream), writeStream);

	const stat = fs.statSync(outputPath);
	console.log(`✓ Audio saved: ${outputPath} (${formatBytes(stat.size)})`);
}

async function runAudioSpeech(client: OpenAPIClient, options: TtsOptions): Promise<void> {
	const response = await client.audioSpeech({
		input: options.text,
		voice: options.voice,
		response_format: options.format as 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | undefined,
	});

	const outputPath = path.resolve(options.output);
	const body = response.body;
	if (!body) {
		throw new Error('Empty response body');
	}

	const writeStream = fs.createWriteStream(outputPath);
	await pipeline(Readable.fromWeb(body as ReadableStream), writeStream);

	const stat = fs.statSync(outputPath);
	console.log(`✓ Audio saved: ${outputPath} (${formatBytes(stat.size)})`);
}

async function runSpeech(client: OpenAPIClient, options: SpeechOptions): Promise<void> {
	const result = await client.speech({
		scripts: [{content: options.script, speakerId: options.speakerId}],
	});

	if (options.json) {
		printJson(result);
		return;
	}

	console.log(`✓ Speech created`);
	console.log(`  Audio:    ${result.audioUrl}`);
	console.log(`  Duration: ${String(result.audioDuration)}s`);
	console.log(`  Credits:  ${String(result.credits)}`);
	if (result.subtitlesUrl) {
		console.log(`  Subs:     ${result.subtitlesUrl}`);
	}
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${String(bytes)}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function register(openapi: Command) {
	openapi
		.command('tts')
		.description('Text-to-speech (binary audio output)')
		.requiredOption('--text <text>', 'Text to convert')
		.requiredOption('--voice <speakerId>', 'Speaker ID')
		.requiredOption('--output <file>', 'Output file path')
		.option('--format <format>', 'Audio format: mp3, opus, aac, flac, wav, pcm', 'mp3')
		.action(async (options: TtsOptions) => {
			try {
				const client = await getOpenAPIClient();
				await runTts(client, options);
			} catch (error) {
				handleError(error, false);
			}
		});

	openapi
		.command('audio-speech')
		.description('Text-to-speech (OpenAI /v1/audio/speech compatible)')
		.requiredOption('--text <text>', 'Text to convert')
		.requiredOption('--voice <speakerId>', 'Speaker ID')
		.requiredOption('--output <file>', 'Output file path')
		.option('--format <format>', 'Audio format: mp3, opus, aac, flac, wav, pcm', 'mp3')
		.action(async (options: TtsOptions) => {
			try {
				const client = await getOpenAPIClient();
				await runAudioSpeech(client, options);
			} catch (error) {
				handleError(error, false);
			}
		});

	openapi
		.command('speech')
		.description('Create speech (returns audio URL)')
		.requiredOption('--script <content>', 'Script text')
		.requiredOption('--speaker-id <id>', 'Speaker ID')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: SpeechOptions) => {
			try {
				const client = await getOpenAPIClient();
				await runSpeech(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
```

- [ ] **Step 2: Add to `_cli.ts` dispatcher**

```ts
import {register as registerTts} from './tts.js';
// inside register():
registerTts(openapi);
```

- [ ] **Step 3: Build and lint**

```bash
pnpm run lint && pnpm run build
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add source/openapi/tts.ts source/openapi/_cli.ts
git commit -m "feat(openapi): add tts, audio-speech, and speech commands"
```

---

### Task 9: Flow Speech Commands

**Files:**
- Create: `source/openapi/flow-speech.ts`
- Modify: `source/openapi/_cli.ts` (one-line import + call)

- [ ] **Step 1: Implement flow-speech module with self-registration**

Create `source/openapi/flow-speech.ts`:

```ts
import type {Command} from 'commander';
import type {OpenAPIClient, OpenAPIFlowSpeechDetail} from '@marswave/listenhub-sdk';
import {handleError, printDetail, printJson} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

type FlowSpeechCreateOptions = {
	sourceUrl: string[];
	sourceText: string[];
	speakerId: string[];
	mode: string;
	lang?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

type FlowSpeechTtsOptions = {
	script: string[];
	speakerId: string[];
	title?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

async function createFlowSpeech(
	client: OpenAPIClient,
	options: FlowSpeechCreateOptions,
): Promise<void> {
	if (options.speakerId.length === 0) {
		throw new Error('At least one --speaker-id is required');
	}

	if (options.sourceUrl.length === 0 && options.sourceText.length === 0) {
		throw new Error('At least one --source-url or --source-text is required');
	}

	const sources = [
		...options.sourceUrl.map((uri) => ({type: 'url' as const, uri})),
		...options.sourceText.map((content) => ({type: 'text' as const, content})),
	];

	const speakers = options.speakerId.map((id) => ({speakerId: id}));

	const {episodeId} = await client.createFlowSpeech({
		sources,
		speakers,
		mode: options.mode as 'smart' | 'direct',
		language: options.lang,
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`✓ Flow speech submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollOpenAPI<OpenAPIFlowSpeechDetail>({
		getStatus: () => client.getFlowSpeech(episodeId),
		isDone: (r) => r.processStatus === 'success',
		isFailed: (r) => r.processStatus === 'failed',
		getErrorMessage: (r) => `Creation failed: ${r.message ?? 'Unknown'} (code: ${String(r.failCode ?? 0)})`,
		options: {timeout: options.timeout, label: 'Creating flow speech', json: options.json},
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Flow speech created', [
			['ID:', detail.episodeId],
			['Title:', detail.title],
			['Audio:', detail.audioUrl],
		]);
	}
}

async function getFlowSpeech(
	client: OpenAPIClient,
	episodeId: string,
	json: boolean,
): Promise<void> {
	const detail = await client.getFlowSpeech(episodeId);

	if (json) {
		printJson(detail);
		return;
	}

	printDetail('Flow speech details', [
		['ID:', detail.episodeId],
		['Status:', detail.processStatus],
		['Title:', detail.title],
		['Audio:', detail.audioUrl],
		['Created:', detail.createdAt ? new Date(detail.createdAt).toISOString() : undefined],
	]);
}

async function createFlowSpeechTts(
	client: OpenAPIClient,
	options: FlowSpeechTtsOptions,
): Promise<void> {
	if (options.speakerId.length === 0) {
		throw new Error('At least one --speaker-id is required');
	}

	if (options.script.length === 0) {
		throw new Error('At least one --script is required');
	}

	const scripts = options.script.map((content, i) => ({
		content,
		speakerId: options.speakerId[i] ?? options.speakerId[0]!,
	}));

	const {episodeId} = await client.createFlowSpeechTTS({
		scripts,
		title: options.title,
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`✓ Flow speech TTS submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollOpenAPI<OpenAPIFlowSpeechDetail>({
		getStatus: () => client.getFlowSpeech(episodeId),
		isDone: (r) => r.processStatus === 'success',
		isFailed: (r) => r.processStatus === 'failed',
		getErrorMessage: (r) => `Creation failed: ${r.message ?? 'Unknown'} (code: ${String(r.failCode ?? 0)})`,
		options: {timeout: options.timeout, label: 'Creating TTS', json: options.json},
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Flow speech TTS created', [
			['ID:', detail.episodeId],
			['Audio:', detail.audioUrl],
		]);
	}
}

async function streamFlowSpeechText(
	client: OpenAPIClient,
	episodeId: string,
	event: 'script' | 'outline',
): Promise<void> {
	const response = await client.getFlowSpeechTextStream(episodeId, event);
	const body = response.body;
	if (!body) {
		throw new Error('Empty response body');
	}

	const reader = body.getReader();
	const decoder = new TextDecoder();
	let done = false;
	while (!done) {
		const chunk = await reader.read(); // eslint-disable-line no-await-in-loop
		done = chunk.done;
		if (chunk.value) {
			process.stdout.write(decoder.decode(chunk.value, {stream: !done}));
		}
	}
}

export function register(openapi: Command) {
	const flowSpeech = openapi.command('flow-speech').description('Flow speech generation');

	flowSpeech
		.command('create')
		.description('Create a flow speech episode')
		.option('--source-url <url>', 'Source URL (repeatable)', collect, [])
		.option('--source-text <text>', 'Source text (repeatable)', collect, [])
		.option('--speaker-id <id>', 'Speaker ID (repeatable)', collect, [])
		.option('--mode <mode>', 'Mode: smart, direct', 'smart')
		.option('--lang <lang>', 'Language')
		.option('--no-wait', 'Return immediately')
		.option('--timeout <seconds>', 'Polling timeout', Number, 300)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: FlowSpeechCreateOptions) => {
			try {
				const client = await getOpenAPIClient();
				await createFlowSpeech(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	flowSpeech
		.command('get <episodeId>')
		.description('Get flow speech details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (episodeId: string, options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				await getFlowSpeech(client, episodeId, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	flowSpeech
		.command('tts')
		.description('Create flow speech from scripts')
		.option('--script <content>', 'Script content (repeatable)', collect, [])
		.option('--speaker-id <id>', 'Speaker ID (repeatable)', collect, [])
		.option('--title <title>', 'Episode title')
		.option('--no-wait', 'Return immediately')
		.option('--timeout <seconds>', 'Polling timeout', Number, 300)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: FlowSpeechTtsOptions) => {
			try {
				const client = await getOpenAPIClient();
				await createFlowSpeechTts(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	flowSpeech
		.command('text-stream <episodeId>')
		.description('Stream generated text (SSE)')
		.requiredOption('--event <event>', 'Event type: script, outline')
		.action(async (episodeId: string, options: {event: string}) => {
			try {
				const client = await getOpenAPIClient();
				await streamFlowSpeechText(client, episodeId, options.event as 'script' | 'outline');
			} catch (error) {
				handleError(error, false);
			}
		});
}
```

- [ ] **Step 2: Add to `_cli.ts` dispatcher**

```ts
import {register as registerFlowSpeech} from './flow-speech.js';
// inside register():
registerFlowSpeech(openapi);
```

- [ ] **Step 3: Build and lint**

```bash
pnpm run lint && pnpm run build
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add source/openapi/flow-speech.ts source/openapi/_cli.ts
git commit -m "feat(openapi): add flow-speech create/get/tts/text-stream commands"
```

---

### Task 10: Podcast Commands

**Files:**
- Create: `source/openapi/podcast.ts`
- Modify: `source/openapi/_cli.ts` (one-line import + call)

**Pattern:** Self-registering module — exports `register(openapi: Command)`. Uses `.option()` (not `.requiredOption()`) for repeatable fields, validates non-empty in implementation. Add `registerPodcast(openapi)` call in `_cli.ts`.

- [ ] **Step 1: Implement podcast module with self-registration**

Create `source/openapi/podcast.ts`:

```ts
import type {Command} from 'commander';
import type {OpenAPIClient, OpenAPIPodcastDetail} from '@marswave/listenhub-sdk';
import {handleError, printDetail, printJson} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

type PodcastCreateOptions = {
	query?: string;
	sourceUrl: string[];
	sourceText: string[];
	speakerId: string[];
	mode?: string;
	lang?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

type PodcastTextContentOptions = {
	query?: string;
	sourceUrl: string[];
	sourceText: string[];
	speakerId: string[];
	mode?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

async function createPodcast(
	client: OpenAPIClient,
	options: PodcastCreateOptions,
): Promise<void> {
	if (options.speakerId.length === 0) {
		throw new Error('At least one --speaker-id is required');
	}

	const sources = [
		...options.sourceUrl.map((content) => ({type: 'url' as const, content})),
		...options.sourceText.map((content) => ({type: 'text' as const, content})),
	];

	const speakers = options.speakerId.map((id) => ({speakerId: id}));

	const {episodeId} = await client.createPodcast({
		query: options.query,
		sources: sources.length > 0 ? sources : undefined,
		speakers,
		mode: options.mode,
		language: options.lang,
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`✓ Podcast submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollOpenAPI<OpenAPIPodcastDetail>({
		getStatus: () => client.getPodcast(episodeId),
		isDone: (r) => r.processStatus === 'success',
		isFailed: (r) => r.processStatus === 'failed',
		getErrorMessage: (r) => `Creation failed: ${r.message ?? 'Unknown'} (code: ${String(r.failCode ?? 0)})`,
		options: {timeout: options.timeout, label: 'Creating podcast', json: options.json},
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Podcast created', [
			['ID:', detail.episodeId],
			['Title:', detail.title],
			['Audio:', detail.audioUrl],
			['Credits:', detail.credits],
		]);
	}
}

async function getPodcast(
	client: OpenAPIClient,
	episodeId: string,
	json: boolean,
): Promise<void> {
	const detail = await client.getPodcast(episodeId);

	if (json) {
		printJson(detail);
		return;
	}

	printDetail('Podcast details', [
		['ID:', detail.episodeId],
		['Status:', detail.processStatus],
		['Title:', detail.title],
		['Audio:', detail.audioUrl],
		['Credits:', detail.credits],
		['Created:', detail.createdAt ? new Date(detail.createdAt).toISOString() : undefined],
	]);
}

async function createTextContent(
	client: OpenAPIClient,
	options: PodcastTextContentOptions,
): Promise<void> {
	if (options.speakerId.length === 0) {
		throw new Error('At least one --speaker-id is required');
	}

	if (!options.query && options.sourceUrl.length === 0 && options.sourceText.length === 0) {
		throw new Error('At least one of --query, --source-url, or --source-text is required');
	}

	const sources = [
		...options.sourceUrl.map((content) => ({type: 'url' as const, content})),
		...options.sourceText.map((content) => ({type: 'text' as const, content})),
	];

	const speakers = options.speakerId.map((id) => ({speakerId: id}));

	const {episodeId} = await client.createPodcastTextContent({
		query: options.query,
		sources: sources.length > 0 ? sources : undefined,
		speakers,
		mode: options.mode,
		language: undefined,
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`✓ Text content submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollOpenAPI<OpenAPIPodcastDetail>({
		getStatus: () => client.getPodcast(episodeId),
		isDone: (r) => r.contentStatus === 'text-success',
		isFailed: (r) => r.contentStatus === 'text-fail',
		getErrorMessage: (r) => `Text generation failed: ${r.message ?? 'Unknown'} (code: ${String(r.failCode ?? 0)})`,
		options: {timeout: options.timeout, label: 'Generating text', json: options.json},
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Text content ready', [
			['ID:', detail.episodeId],
			['Title:', detail.title],
		]);
	}
}

async function generateAudio(
	client: OpenAPIClient,
	episodeId: string,
	options: {wait: boolean; timeout: number; json: boolean},
): Promise<void> {
	await client.generatePodcastAudio(episodeId);

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId, status: 'submitted'});
		} else {
			console.log(`✓ Audio generation submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollOpenAPI<OpenAPIPodcastDetail>({
		getStatus: () => client.getPodcast(episodeId),
		isDone: (r) => r.contentStatus === 'audio-success',
		isFailed: (r) => r.contentStatus === 'audio-fail',
		getErrorMessage: (r) => `Audio generation failed: ${r.message ?? 'Unknown'} (code: ${String(r.failCode ?? 0)})`,
		options: {timeout: options.timeout, label: 'Generating audio', json: options.json},
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Audio generated', [
			['ID:', detail.episodeId],
			['Audio:', detail.audioUrl],
			['Credits:', detail.credits],
		]);
	}
}

async function streamPodcastText(
	client: OpenAPIClient,
	episodeId: string,
	event: 'script' | 'outline',
): Promise<void> {
	const response = await client.getPodcastTextStream(episodeId, event);
	const body = response.body;
	if (!body) {
		throw new Error('Empty response body');
	}

	const reader = body.getReader();
	const decoder = new TextDecoder();
	let done = false;
	while (!done) {
		const chunk = await reader.read(); // eslint-disable-line no-await-in-loop
		done = chunk.done;
		if (chunk.value) {
			process.stdout.write(decoder.decode(chunk.value, {stream: !done}));
		}
	}
}

export function register(openapi: Command) {
	const podcast = openapi.command('podcast').description('Podcast generation');

	podcast
		.command('create')
		.description('Create a podcast episode')
		.option('--query <text>', 'Topic text')
		.option('--source-url <url>', 'Source URL (repeatable)', collect, [])
		.option('--source-text <text>', 'Source text (repeatable)', collect, [])
		.option('--speaker-id <id>', 'Speaker ID (repeatable)', collect, [])
		.option('--mode <mode>', 'Generation mode')
		.option('--lang <lang>', 'Language')
		.option('--no-wait', 'Return immediately')
		.option('--timeout <seconds>', 'Polling timeout', Number, 300)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: PodcastCreateOptions) => {
			try {
				const client = await getOpenAPIClient();
				await createPodcast(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	podcast
		.command('get <episodeId>')
		.description('Get podcast details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (episodeId: string, options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				await getPodcast(client, episodeId, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	podcast
		.command('text-content')
		.description('Generate podcast text only (no audio)')
		.option('--query <text>', 'Topic text')
		.option('--source-url <url>', 'Source URL (repeatable)', collect, [])
		.option('--source-text <text>', 'Source text (repeatable)', collect, [])
		.option('--speaker-id <id>', 'Speaker ID (repeatable)', collect, [])
		.option('--mode <mode>', 'Generation mode')
		.option('--no-wait', 'Return immediately')
		.option('--timeout <seconds>', 'Polling timeout', Number, 300)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: PodcastTextContentOptions) => {
			try {
				const client = await getOpenAPIClient();
				await createTextContent(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	podcast
		.command('generate-audio <episodeId>')
		.description('Generate audio for existing text content')
		.option('--no-wait', 'Return immediately')
		.option('--timeout <seconds>', 'Polling timeout', Number, 300)
		.option('-j, --json', 'Output JSON', false)
		.action(async (episodeId: string, options: {wait: boolean; timeout: number; json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				await generateAudio(client, episodeId, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	podcast
		.command('text-stream <episodeId>')
		.description('Stream generated text (SSE)')
		.requiredOption('--event <event>', 'Event type: script, outline')
		.action(async (episodeId: string, options: {event: string}) => {
			try {
				const client = await getOpenAPIClient();
				await streamPodcastText(client, episodeId, options.event as 'script' | 'outline');
			} catch (error) {
				handleError(error, false);
			}
		});
}
```

- [ ] **Step 2: Add to `_cli.ts` dispatcher**

```ts
import {register as registerPodcast} from './podcast.js';
// inside register():
registerPodcast(openapi);
```

- [ ] **Step 3: Build and lint**

```bash
pnpm run lint && pnpm run build
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add source/openapi/podcast.ts source/openapi/_cli.ts
git commit -m "feat(openapi): add podcast create/get/text-content/generate-audio/text-stream commands"
```

---

### Task 11: Storybook Commands

**Files:**
- Create: `source/openapi/storybook.ts`
- Modify: `source/openapi/_cli.ts` (one-line import + call)

**Pattern:** Self-registering module. Exports `register(openapi: Command)`. Uses `.option()` for repeatable `--speaker-id` with non-empty validation in implementation. Add `registerStorybook(openapi)` call in `_cli.ts`.

- [ ] **Step 1: Implement storybook module**

Create `source/openapi/storybook.ts`:

```ts
import type {OpenAPIClient, OpenAPIStorybookDetail} from '@marswave/listenhub-sdk';
import {printDetail, printJson} from '../_shared/output.js';
import {pollOpenAPI} from './polling.js';

export type StorybookCreateOptions = {
	sourceUrl?: string[];
	sourceText?: string[];
	speakerId?: string[];
	skipAudio: boolean;
	style?: string;
	mode: string;
	lang?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export async function createStorybook(
	client: OpenAPIClient,
	options: StorybookCreateOptions,
): Promise<void> {
	const sources = [
		...(options.sourceUrl ?? []).map((content) => ({type: 'url' as const, content})),
		...(options.sourceText ?? []).map((content) => ({type: 'text' as const, content})),
	];

	const speakers = (options.speakerId ?? []).map((id) => ({speakerId: id}));

	const {episodeId} = await client.createStorybook({
		sources,
		speakers: speakers.length > 0 ? speakers : undefined,
		skipAudio: options.skipAudio || undefined,
		style: options.style,
		language: options.lang,
		mode: options.mode as 'info' | 'story' | 'slides',
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`✓ Storybook submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollOpenAPI<OpenAPIStorybookDetail>({
		getStatus: () => client.getStorybook(episodeId),
		isDone: (r) => r.processStatus === 'success',
		isFailed: (r) => r.processStatus === 'failed',
		getErrorMessage: (r) => `Creation failed: ${r.message ?? 'Unknown'} (code: ${String(r.failCode ?? 0)})`,
		options: {timeout: options.timeout, label: 'Creating storybook', json: options.json},
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Storybook created', [
			['ID:', detail.episodeId],
			['Title:', detail.title],
			['Audio:', detail.audioUrl],
			['Video:', detail.videoUrl],
			['Credits:', detail.credits],
		]);
	}
}

export async function getStorybook(
	client: OpenAPIClient,
	episodeId: string,
	json: boolean,
): Promise<void> {
	const detail = await client.getStorybook(episodeId);

	if (json) {
		printJson(detail);
		return;
	}

	printDetail('Storybook details', [
		['ID:', detail.episodeId],
		['Status:', detail.processStatus],
		['Mode:', detail.mode],
		['Title:', detail.title],
		['Audio:', detail.audioUrl],
		['Video:', detail.videoUrl],
		['Credits:', detail.credits],
		['Created:', detail.createdAt ? new Date(detail.createdAt).toISOString() : undefined],
	]);
}

export async function generateStorybookVideo(
	client: OpenAPIClient,
	episodeId: string,
	json: boolean,
): Promise<void> {
	const result = await client.generateStorybookVideo(episodeId);

	if (json) {
		printJson(result);
	} else {
		console.log(`✓ Video generation ${result.success ? 'started' : 'failed'}: ${episodeId}`);
	}
}
```

- [ ] **Step 2: Register storybook commands in `_cli.ts`**

Add import:

```ts
import {createStorybook, generateStorybookVideo, getStorybook} from './storybook.js';
```

Add command registrations:

```ts
	// --- Storybook ---
	const storybook = openapi.command('storybook').description('Storybook/explainer generation');

	storybook
		.command('create')
		.description('Create a storybook episode')
		.option('--source-url <url>', 'Source URL (repeatable)', collect, [])
		.option('--source-text <text>', 'Source text (repeatable)', collect, [])
		.option('--speaker-id <id>', 'Speaker ID (repeatable)', collect, [])
		.option('--skip-audio', 'Skip audio generation', false)
		.option('--style <style>', 'Visual style')
		.option('--mode <mode>', 'Mode: info, story, slides', 'info')
		.option('--lang <lang>', 'Language')
		.option('--no-wait', 'Return immediately')
		.option('--timeout <seconds>', 'Polling timeout', Number, 300)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: StorybookCreateOptions) => {
			try {
				const client = await getOpenAPIClient();
				await createStorybook(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	storybook
		.command('get <episodeId>')
		.description('Get storybook details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (episodeId: string, options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				await getStorybook(client, episodeId, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	storybook
		.command('generate-video <episodeId>')
		.description('Generate video for existing storybook')
		.option('-j, --json', 'Output JSON', false)
		.action(async (episodeId: string, options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				await generateStorybookVideo(client, episodeId, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});
```

- [ ] **Step 3: Build and lint**

```bash
pnpm run lint && pnpm run build
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add source/openapi/storybook.ts source/openapi/_cli.ts
git commit -m "feat(openapi): add storybook create/get/generate-video commands"
```

---

### Task 12: Image Command

**Files:**
- Create: `source/openapi/image.ts`
- Modify: `source/openapi/_cli.ts` (one-line import + call)

**Pattern:** Self-registering module. Exports `register(openapi: Command)`. Add `registerImage(openapi)` call in `_cli.ts`.

- [ ] **Step 1: Implement image module**

Create `source/openapi/image.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import type {OpenAPIClient} from '@marswave/listenhub-sdk';
import {printJson} from '../_shared/output.js';

export type ImageCreateOptions = {
	prompt: string;
	provider: string;
	model?: string;
	size?: string;
	ratio?: string;
	reference: string[];
	json: boolean;
};

const mimeTypes: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.bmp': 'image/bmp',
};

function isUrl(value: string): boolean {
	return value.startsWith('http://') || value.startsWith('https://');
}

function resolveReference(ref: string): {fileData?: {fileUri: string; mimeType: string}; inlineData?: {data: string; mimeType: string}} {
	if (isUrl(ref)) {
		const ext = path.extname(new URL(ref).pathname).toLowerCase();
		const mimeType = mimeTypes[ext] ?? 'image/png';
		return {fileData: {fileUri: ref, mimeType}};
	}

	const filePath = path.resolve(ref);
	const ext = path.extname(filePath).toLowerCase();
	const mimeType = mimeTypes[ext];
	if (!mimeType) {
		throw new Error(`Unsupported image format: ${ext}. Supported: ${Object.keys(mimeTypes).join(', ')}`);
	}

	const data = fs.readFileSync(filePath).toString('base64');
	return {inlineData: {data, mimeType}};
}

export async function createImage(
	client: OpenAPIClient,
	options: ImageCreateOptions,
): Promise<void> {
	const referenceImages = options.reference.map((ref) => resolveReference(ref));

	const result = await client.createImage({
		provider: options.provider,
		model: options.model,
		prompt: options.prompt,
		referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
		imageConfig: {
			...(options.size && {imageSize: options.size as '1K' | '2K' | '4K'}),
			...(options.ratio && {aspectRatio: options.ratio as '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9'}),
		},
	});

	if (options.json) {
		printJson(result);
	} else {
		console.log('✓ Image created');
		console.log(`  ${JSON.stringify(result, null, 2)}`);
	}
}
```

- [ ] **Step 2: Register image command in `_cli.ts`**

Add import:

```ts
import {createImage} from './image.js';
```

Add command registration:

```ts
	// --- Image ---
	const image = openapi.command('image').description('AI image generation');

	image
		.command('create')
		.description('Create an AI image')
		.requiredOption('--prompt <text>', 'Image description')
		.requiredOption('--provider <provider>', 'Provider name')
		.option('--model <model>', 'Model name')
		.option('--size <size>', 'Image size: 1K, 2K, 4K')
		.option('--ratio <ratio>', 'Aspect ratio: 16:9, 4:3, 1:1, 3:4, 9:16, 21:9')
		.option('--reference <path-or-url>', 'Reference image (repeatable)', collect, [])
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: ImageCreateOptions) => {
			try {
				const client = await getOpenAPIClient();
				await createImage(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
```

- [ ] **Step 3: Build and lint**

```bash
pnpm run lint && pnpm run build
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add source/openapi/image.ts source/openapi/_cli.ts
git commit -m "feat(openapi): add image create command with base64 reference support"
```

---

### Task 13: Video Commands

**Files:**
- Create: `source/openapi/video.ts`
- Modify: `source/openapi/_cli.ts` (one-line import + call)

**Pattern:** Self-registering module. Exports `register(openapi: Command)`. Add `registerVideo(openapi)` call in `_cli.ts`. Video only accepts URLs (no local file upload), so no `resolveFileOrUrl()` needed.

- [ ] **Step 1: Implement video module**

Create `source/openapi/video.ts`:

```ts
import type {
	OpenAPIClient,
	OpenAPICreateVideoGenerationParams,
	OpenAPIVideoGenerationTaskDetail,
	OpenAPIVideoGenerationTaskStatus,
} from '@marswave/listenhub-sdk';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollOpenAPI} from './polling.js';

export type VideoCreateOptions = {
	prompt: string;
	firstFrame?: string;
	lastFrame?: string;
	referenceImage: string[];
	referenceVideo: string[];
	referenceAudio: string[];
	inputVideoDuration?: number;
	model?: string;
	resolution?: string;
	ratio?: string;
	duration?: number;
	generateAudio: boolean;
	seed?: number;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export type VideoListOptions = {
	page: number;
	pageSize: number;
	status?: string;
	json: boolean;
};

export type VideoEstimateOptions = {
	model: string;
	resolution: string;
	duration: number;
	ratio?: string;
	hasVideoInput: boolean;
	inputVideoDuration?: number;
	json: boolean;
};

function validateCreateOptions(options: VideoCreateOptions): void {
	if (options.duration !== undefined && (options.duration < 4 || options.duration > 15)) {
		throw new Error('Duration must be between 4 and 15 seconds');
	}

	if (options.seed !== undefined && (options.seed < -1 || options.seed > 4_294_967_295)) {
		throw new Error('Seed must be between -1 and 4294967295');
	}

	if (options.lastFrame && !options.firstFrame) {
		throw new Error('--last-frame requires --first-frame');
	}

	const hasFrameMode = Boolean(options.firstFrame || options.lastFrame);
	const hasReferenceMode =
		options.referenceImage.length > 0 ||
		options.referenceVideo.length > 0 ||
		options.referenceAudio.length > 0;

	if (hasFrameMode && hasReferenceMode) {
		throw new Error(
			'Cannot mix frame mode (--first-frame/--last-frame) with reference mode (--reference-image/--reference-video/--reference-audio)',
		);
	}

	if (options.referenceVideo.length > 0 && options.inputVideoDuration === undefined) {
		throw new Error('--input-video-duration is required when using --reference-video');
	}

	if (options.inputVideoDuration !== undefined && options.referenceVideo.length === 0) {
		throw new Error('--input-video-duration requires --reference-video');
	}

	if (
		options.inputVideoDuration !== undefined &&
		(options.inputVideoDuration < 2 || options.inputVideoDuration > 15)
	) {
		throw new Error('Input video duration must be between 2 and 15 seconds');
	}

	if (
		options.referenceAudio.length > 0 &&
		options.referenceImage.length === 0 &&
		options.referenceVideo.length === 0
	) {
		throw new Error('--reference-audio requires --reference-image or --reference-video');
	}

	if (options.referenceImage.length > 9) {
		throw new Error('Too many reference images (max 9)');
	}

	if (options.referenceVideo.length > 3) {
		throw new Error('Too many reference videos (max 3)');
	}

	if (options.referenceAudio.length > 3) {
		throw new Error('Too many reference audios (max 3)');
	}
}

export async function createVideo(
	client: OpenAPIClient,
	options: VideoCreateOptions,
): Promise<void> {
	validateCreateOptions(options);

	const content: OpenAPICreateVideoGenerationParams['content'] = [
		{type: 'text', text: options.prompt},
	];

	if (options.firstFrame) {
		content.push({type: 'image_url', image_url: {url: options.firstFrame}, role: 'first_frame'});
	}

	if (options.lastFrame) {
		content.push({type: 'image_url', image_url: {url: options.lastFrame}, role: 'last_frame'});
	}

	for (const url of options.referenceImage) {
		content.push({type: 'image_url', image_url: {url}, role: 'reference_image'});
	}

	for (const url of options.referenceVideo) {
		content.push({type: 'video_url', video_url: {url}, role: 'reference_video'});
	}

	for (const url of options.referenceAudio) {
		content.push({type: 'audio_url', audio_url: {url}, role: 'reference_audio'});
	}

	const params: OpenAPICreateVideoGenerationParams = {
		content,
		...(options.model && {model: options.model as 'doubao-seedance-2-pro' | 'doubao-seedance-2-fast'}),
		...(options.resolution && {resolution: options.resolution as '480p' | '720p' | '1080p'}),
		...(options.ratio && {ratio: options.ratio as '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9'}),
		...(options.duration !== undefined && {duration: options.duration}),
		...(!options.generateAudio && {generateAudio: false}),
		...(options.seed !== undefined && {seed: options.seed}),
		...(options.inputVideoDuration !== undefined && {inputVideoDuration: options.inputVideoDuration}),
	};

	const {taskId} = await client.createVideoGeneration(params);

	if (!options.wait) {
		if (options.json) {
			printJson({taskId});
		} else {
			console.log(`✓ Video task submitted: ${taskId}`);
		}

		return;
	}

	const task = await pollOpenAPI<OpenAPIVideoGenerationTaskDetail>({
		getStatus: () => client.getVideoGenerationTask(taskId),
		isDone: (r) => r.status === 'success',
		isFailed: (r) => r.status === 'failed',
		getErrorMessage: () => 'Video creation failed',
		options: {timeout: options.timeout, label: 'Generating video', json: options.json},
	});

	if (options.json) {
		printJson(task);
	} else {
		printDetail('Video created', [
			['ID:', task.id],
			['Video:', task.videoUrl],
			['Duration:', task.duration ? `${String(task.duration)}s` : undefined],
			['Resolution:', task.resolution],
			['Ratio:', task.ratio],
			['Seed:', task.seed],
			['Credits:', task.creditCharged],
		]);
	}
}

export async function getVideo(
	client: OpenAPIClient,
	taskId: string,
	json: boolean,
): Promise<void> {
	const task = await client.getVideoGenerationTask(taskId);

	if (json) {
		printJson(task);
		return;
	}

	printDetail('Video task details', [
		['ID:', task.id],
		['Status:', task.status],
		['Model:', task.model],
		['Video:', task.videoUrl],
		['Duration:', task.duration ? `${String(task.duration)}s` : undefined],
		['Resolution:', task.resolution],
		['Ratio:', task.ratio],
		['Seed:', task.seed],
		['Credits:', task.creditCharged],
		['Created:', new Date(task.createdAt).toISOString()],
	]);
}

export async function listVideos(
	client: OpenAPIClient,
	options: VideoListOptions,
): Promise<void> {
	const {items} = await client.listVideoGenerationTasks({
		page: options.page,
		pageSize: options.pageSize,
		...(options.status && {status: options.status as OpenAPIVideoGenerationTaskStatus}),
	});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['ID', 'Model', 'Status', 'Duration', 'Created'];
	const rows = items.map((item) => [
		item.id,
		item.model,
		item.status,
		item.params.duration ? `${String(item.params.duration)}s` : '-',
		new Date(item.createdAt).toISOString().slice(0, 10),
	]);
	printTable(headers, rows);
}

export async function estimateCredits(
	client: OpenAPIClient,
	options: VideoEstimateOptions,
): Promise<void> {
	if (options.hasVideoInput && options.inputVideoDuration === undefined) {
		throw new Error('--input-video-duration is required when using --has-video-input');
	}

	const result = await client.estimateVideoCredits({
		model: options.model as 'doubao-seedance-2-pro' | 'doubao-seedance-2-fast',
		resolution: options.resolution as '480p' | '720p' | '1080p',
		duration: options.duration,
		...(options.ratio && {ratio: options.ratio as '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9'}),
		...(options.hasVideoInput && {hasVideoInput: true}),
		...(options.inputVideoDuration !== undefined && {inputVideoDuration: options.inputVideoDuration}),
	});

	if (options.json) {
		printJson(result);
		return;
	}

	printDetail('Credit estimate', [
		['Tokens:', result.tokens],
		['Credits:', result.credits],
	]);
}
```

- [ ] **Step 2: Register video commands in `_cli.ts`**

Add import:

```ts
import {createVideo, estimateCredits, getVideo, listVideos} from './video.js';
```

Add command registrations:

```ts
	// --- Video ---
	const video = openapi.command('video').description('Video generation');

	video
		.command('create')
		.description('Create a video generation task')
		.requiredOption('--prompt <text>', 'Video description')
		.option('--first-frame <url>', 'First frame image URL')
		.option('--last-frame <url>', 'Last frame image URL')
		.option('--reference-image <url>', 'Reference image URL (repeatable)', collect, [])
		.option('--reference-video <url>', 'Reference video URL (repeatable)', collect, [])
		.option('--reference-audio <url>', 'Reference audio URL (repeatable)', collect, [])
		.option('--input-video-duration <seconds>', 'Reference video duration', Number)
		.option('--model <model>', 'Model: doubao-seedance-2-pro, doubao-seedance-2-fast')
		.option('--resolution <res>', 'Resolution: 480p, 720p, 1080p')
		.option('--ratio <ratio>', 'Aspect ratio')
		.option('--duration <seconds>', 'Video duration (4-15)', Number)
		.option('--no-generate-audio', 'Disable audio generation')
		.option('--seed <number>', 'Random seed', Number)
		.option('--no-wait', 'Return immediately')
		.option('--timeout <seconds>', 'Polling timeout', Number, 1200)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoCreateOptions) => {
			try {
				const client = await getOpenAPIClient();
				await createVideo(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	video
		.command('get <taskId>')
		.description('Get video task details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				await getVideo(client, taskId, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	video
		.command('list')
		.description('List video tasks')
		.option('--page <n>', 'Page number', Number, 1)
		.option('--page-size <n>', 'Items per page', Number, 20)
		.option('--status <status>', 'Filter by status')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoListOptions) => {
			try {
				const client = await getOpenAPIClient();
				await listVideos(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	video
		.command('estimate')
		.description('Estimate video generation credits')
		.requiredOption('--model <model>', 'Model name')
		.requiredOption('--resolution <res>', 'Resolution')
		.requiredOption('--duration <seconds>', 'Duration', Number)
		.option('--ratio <ratio>', 'Aspect ratio')
		.option('--has-video-input', 'Has video input', false)
		.option('--input-video-duration <seconds>', 'Input video duration', Number)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoEstimateOptions) => {
			try {
				const client = await getOpenAPIClient();
				await estimateCredits(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
```

- [ ] **Step 3: Build and lint**

```bash
pnpm run lint && pnpm run build
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add source/openapi/video.ts source/openapi/_cli.ts
git commit -m "feat(openapi): add video create/get/list/estimate commands"
```

---

### Task 14: Content Extract & Subscription Commands

**Files:**
- Create: `source/openapi/content.ts`
- Create: `source/openapi/subscription.ts`
- Modify: `source/openapi/_cli.ts` (two imports + calls)

**Pattern:** Self-registering modules. Each exports `register(openapi: Command)`. Add `registerContent(openapi)` and `registerSubscription(openapi)` calls in `_cli.ts`.

- [ ] **Step 1: Implement content module**

Create `source/openapi/content.ts`:

```ts
import type {OpenAPIClient, OpenAPIContentExtractDetail} from '@marswave/listenhub-sdk';
import {printDetail, printJson} from '../_shared/output.js';
import {pollOpenAPI} from './polling.js';

export type ContentExtractOptions = {
	url: string;
	summarize: boolean;
	maxLength?: number;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export async function extractContent(
	client: OpenAPIClient,
	options: ContentExtractOptions,
): Promise<void> {
	const {taskId} = await client.createContentExtract({
		source: {type: 'url', uri: options.url},
		options: {
			...(options.summarize && {summarize: true}),
			...(options.maxLength !== undefined && {maxLength: options.maxLength}),
		},
	});

	if (!options.wait) {
		if (options.json) {
			printJson({taskId});
		} else {
			console.log(`✓ Content extraction submitted: ${taskId}`);
		}

		return;
	}

	const detail = await pollOpenAPI<OpenAPIContentExtractDetail>({
		getStatus: () => client.getContentExtract(taskId),
		isDone: (r) => r.status === 'completed',
		isFailed: (r) => r.status === 'failed',
		getErrorMessage: (r) => `Extraction failed: ${r.message ?? 'Unknown'} (code: ${String(r.failCode ?? 0)})`,
		options: {timeout: options.timeout, label: 'Extracting content', json: options.json},
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Content extracted', [
			['ID:', detail.taskId],
			['Credits:', detail.credits],
		]);
		if (detail.data?.content) {
			console.log(`\n${detail.data.content}`);
		}
	}
}

export async function getContentExtract(
	client: OpenAPIClient,
	taskId: string,
	json: boolean,
): Promise<void> {
	const detail = await client.getContentExtract(taskId);

	if (json) {
		printJson(detail);
		return;
	}

	printDetail('Content extract details', [
		['ID:', detail.taskId],
		['Status:', detail.status],
		['Credits:', detail.credits],
	]);
	if (detail.data?.content) {
		console.log(`\n${detail.data.content}`);
	}
}
```

- [ ] **Step 2: Implement subscription module**

Create `source/openapi/subscription.ts`:

```ts
import type {OpenAPIClient} from '@marswave/listenhub-sdk';
import {printDetail, printJson} from '../_shared/output.js';

export async function showSubscription(
	client: OpenAPIClient,
	json: boolean,
): Promise<void> {
	const info = await client.getSubscription();

	if (json) {
		printJson(info);
		return;
	}

	printDetail('Subscription', [
		['Credits:', info.totalAvailableCredits],
		['Monthly:', info.usageAvailableMonthlyCredits !== undefined
			? `${String(info.usageAvailableMonthlyCredits)}/${String(info.usageTotalMonthlyCredits)}`
			: undefined],
		['Permanent:', info.usageAvailablePermanentCredits],
		['Plan:', info.subscriptionPlan?.name],
		['Expires:', info.subscriptionExpiresAt
			? new Date(info.subscriptionExpiresAt).toISOString().slice(0, 10)
			: undefined],
	]);
}
```

- [ ] **Step 3: Register both in `_cli.ts`**

Add imports:

```ts
import {extractContent, getContentExtract} from './content.js';
import {showSubscription} from './subscription.js';
```

Add command registrations:

```ts
	// --- Content Extract ---
	const content = openapi.command('content').description('Content extraction');

	content
		.command('extract')
		.description('Extract content from a URL')
		.requiredOption('--url <url>', 'URL to extract from')
		.option('--summarize', 'Summarize extracted content', false)
		.option('--max-length <n>', 'Max content length', Number)
		.option('--no-wait', 'Return immediately')
		.option('--timeout <seconds>', 'Polling timeout', Number, 300)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: ContentExtractOptions) => {
			try {
				const client = await getOpenAPIClient();
				await extractContent(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	content
		.command('get <taskId>')
		.description('Get content extraction result')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				await getContentExtract(client, taskId, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	// --- Subscription ---
	openapi
		.command('subscription')
		.description('Show subscription and credits info')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				await showSubscription(client, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});
```

- [ ] **Step 4: Build and lint**

```bash
pnpm run lint && pnpm run build
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add source/openapi/content.ts source/openapi/subscription.ts source/openapi/_cli.ts
git commit -m "feat(openapi): add content extract/get and subscription commands"
```

---

### Task 15: Integration Tests & Final Verification

**Files:**
- Create: `tests/openapi/commands.test.ts`
- All `source/openapi/` files (verified)

- [ ] **Step 1: Write integration tests (mocked OpenAPIClient)**

Create `tests/openapi/commands.test.ts`:

```ts
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// Mock the client factory to return a mock OpenAPIClient
const mockClient = {
	listSpeakers: vi.fn(),
	speech: vi.fn(),
	createFlowSpeech: vi.fn(),
	getFlowSpeech: vi.fn(),
	createPodcast: vi.fn(),
	getPodcast: vi.fn(),
	createPodcastTextContent: vi.fn(),
	generatePodcastAudio: vi.fn(),
	createStorybook: vi.fn(),
	getStorybook: vi.fn(),
	createImage: vi.fn(),
	createVideoGeneration: vi.fn(),
	getVideoGenerationTask: vi.fn(),
	listVideoGenerationTasks: vi.fn(),
	estimateVideoCredits: vi.fn(),
	createContentExtract: vi.fn(),
	getContentExtract: vi.fn(),
	getSubscription: vi.fn(),
};

vi.mock('../../source/openapi/client.js', () => ({
	getOpenAPIClient: vi.fn().mockResolvedValue(mockClient),
}));

vi.mock('ora', () => ({
	default: () => ({start: () => ({text: '', succeed: vi.fn(), fail: vi.fn()})}),
}));

describe('openapi speakers list', () => {
	it('passes language filter to SDK', async () => {
		mockClient.listSpeakers.mockResolvedValue({items: [{name: 'Alice', speakerId: 'sp1', gender: 'female', language: 'en'}]});
		const {listSpeakers} = await import('../../source/openapi/speakers.js');
		// Note: import the internal function, not the register
		// Test that correct params are passed
		expect(mockClient.listSpeakers).toBeDefined();
	});
});

describe('openapi speech', () => {
	it('passes script and speakerId to SDK', async () => {
		mockClient.speech.mockResolvedValue({audioUrl: 'https://x', audioDuration: 10, credits: 5});
		// Verify param mapping
		expect(mockClient.speech).toBeDefined();
	});
});

describe('openapi podcast create', () => {
	it('rejects empty speaker-id', async () => {
		const {default: podcast} = await import('../../source/openapi/podcast.js');
		// Validation should throw before SDK call
		expect(mockClient.createPodcast).toBeDefined();
	});
});

describe('openapi video create', () => {
	it('rejects mixing frame mode and reference mode', async () => {
		// Validation logic test
		expect(true).toBe(true);
	});

	it('passes content array correctly', async () => {
		mockClient.createVideoGeneration.mockResolvedValue({taskId: 'v1'});
		expect(mockClient.createVideoGeneration).toBeDefined();
	});
});

describe('openapi content extract', () => {
	it('passes url and options to SDK', async () => {
		mockClient.createContentExtract.mockResolvedValue({taskId: 't1'});
		expect(mockClient.createContentExtract).toBeDefined();
	});
});

describe('openapi subscription', () => {
	it('returns subscription info', async () => {
		mockClient.getSubscription.mockResolvedValue({totalAvailableCredits: 100});
		expect(mockClient.getSubscription).toBeDefined();
	});
});
```

Note: This is a scaffold. The implementing agent should expand each test to actually call the implementation functions with mock clients and verify:
1. Correct SDK method is called with expected params
2. Output format matches spec (JSON mode vs human readable)
3. Validation errors throw before SDK call
4. Polling conditions are checked correctly

- [ ] **Step 2: Run tests**

```bash
pnpm test run
```
Expected: ALL PASS

- [ ] **Step 3: Full build + lint + type check (explicit)**

```bash
pnpm run lint && pnpm run build && pnpm test run
```
Expected: ALL PASS. This is the definitive pre-PR gate — do NOT use `pnpm run ready` alone as it may not include `build`.

- [ ] **Step 4: Verify CLI help output**

```bash
node dist/cli.mjs openapi --help
node dist/cli.mjs openapi flow-speech --help
node dist/cli.mjs openapi podcast --help
node dist/cli.mjs openapi video --help
```

Verify all commands appear with correct descriptions.

- [ ] **Step 5: Smoke test with real API Key (manual)**

```bash
export LISTENHUB_API_KEY="lh_sk_..."
node dist/cli.mjs openapi subscription -j
node dist/cli.mjs openapi speakers list --language zh
```

Expected: Valid JSON response or formatted table.

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "test(openapi): add integration tests for command arg mapping"
```

- [ ] **Step 7: Push branch**

```bash
git push origin ralph/listenhub-cli--134
```
