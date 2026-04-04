# ListenHub CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI tool (`listenhub`) that wraps `@marswave/listenhub-sdk` with OAuth auth, content creation (podcast/tts/explainer/slides/image), speaker management, and polling.

**Architecture:** Commander.js flat command structure following coli CLI patterns. Each command is a module with `_cli.ts` (registration) + implementation file. Shared utilities handle auth, polling, output formatting, and speaker resolution. SDK handles all HTTP/error/retry logic.

**Tech Stack:** TypeScript, ESM, Commander.js, `@marswave/listenhub-sdk`, ora (spinner), open (browser), xo (lint)

**Spec:** `docs/superpowers/specs/2026-04-04-listenhub-cli-design.md`

**Reference codebase:** `~/coding/marswave/coli/` — follow its patterns for CLI structure, xo config, tsconfig, package.json

---

## File Structure

```
listenhub-cli/
├── source/
│   ├── cli.ts                      # Entry point: register all commands, parse
│   ├── _shared/
│   │   ├── client.ts               # getClient(): load creds → refresh if needed → return ListenHubClient
│   │   ├── credentials.ts          # load/save/delete credentials (atomic write, 0600, auto-refresh)
│   │   ├── output.ts               # formatError(), printJson(), printTable(), printDetail()
│   │   ├── polling.ts              # pollUntilDone(): generic creation polling with ora spinner
│   │   ├── sources.ts              # buildSources(): --source-url/--source-text → ContentSource[]
│   │   ├── speaker-resolver.ts     # resolveSpeakers(): name→innerId, defaults per language
│   │   └── language.ts             # inferLanguage(): detect zh/ja/en from text content
│   ├── auth/
│   │   ├── _cli.ts                 # auth login/logout/status command registration
│   │   ├── auth.ts                 # runLogin(), runLogout(), runStatus() implementations
│   │   └── login-server.ts         # startCallbackServer(): local HTTP server for OAuth
│   ├── podcast/
│   │   ├── _cli.ts                 # podcast create/list command registration
│   │   └── podcast.ts              # createPodcast(), listPodcasts()
│   ├── tts/
│   │   ├── _cli.ts                 # tts create/list command registration
│   │   └── tts.ts                  # createTts(), listTts()
│   ├── explainer/
│   │   ├── _cli.ts                 # explainer create/list command registration
│   │   └── explainer.ts            # createExplainer(), listExplainerVideos()
│   ├── slides/
│   │   ├── _cli.ts                 # slides create/list command registration
│   │   └── slides.ts               # createSlides(), listSlides()
│   ├── image/
│   │   ├── _cli.ts                 # image create/list/get command registration
│   │   └── image.ts                # createImage(), listImages(), getImage()
│   ├── speakers/
│   │   ├── _cli.ts                 # speakers list command registration
│   │   └── speakers.ts             # listSpeakers()
│   └── creation/
│       ├── _cli.ts                 # creation get/delete command registration
│       └── creation.ts             # getCreation(), deleteCreations()
├── package.json
├── tsconfig.json
└── xo.config.mjs
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `xo.config.mjs`
- Create: `.gitignore`
- Create: `source/cli.ts`

- [ ] **Step 1: Create package.json**

```json
{
	"name": "@marswave/listenhub-cli",
	"version": "0.1.0",
	"description": "Command-line interface for ListenHub",
	"repository": "marswaveai/listenhub-cli",
	"type": "module",
	"bin": {
		"listenhub": "distribution/source/cli.js"
	},
	"exports": "./distribution/source/cli.js",
	"files": [
		"distribution"
	],
	"license": "MIT",
	"scripts": {
		"prepublishOnly": "node --run build",
		"clean": "del-cli distribution",
		"dev": "node --run clean && tsc --watch",
		"build": "node --run clean && tsc && chmod +x distribution/source/cli.js",
		"pretest": "node --run build",
		"test": "xo"
	},
	"dependencies": {
		"@marswave/listenhub-sdk": "^0.0.2",
		"commander": "^14.0.3",
		"open": "^10.0.0",
		"ora": "^8.0.0"
	},
	"devDependencies": {
		"@sindresorhus/tsconfig": "^8.1.0",
		"@types/node": "^25.5.0",
		"del-cli": "^7.0.0",
		"typescript": "^6.0.2",
		"xo": "^2.0.2"
	},
	"engines": {
		"node": ">=20"
	}
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
	"extends": "@sindresorhus/tsconfig",
	"compilerOptions": {
		"rootDir": ".",
		"outDir": "distribution",
		"types": ["node"]
	},
	"include": ["source"]
}
```

- [ ] **Step 3: Create xo.config.mjs**

Copy from coli verbatim:

```javascript
const xoConfig = [
	{
		prettier: true,
		rules: {
			'@typescript-eslint/only-throw-error': 'off',
			'sort-imports': [
				'error',
				{
					ignoreCase: false,
					ignoreDeclarationSort: true,
					ignoreMemberSort: false,
					memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
					allowSeparatedGroups: false,
				},
			],
			'import-x/no-named-as-default': 'off',
			'import-x/extensions': 'off',
			'import-x/order': [
				'error',
				{
					groups: ['builtin', 'external', 'parent', 'sibling', 'index'],
					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},
					warnOnUnassignedImports: true,
					'newlines-between': 'never',
				},
			],
		},
	},
];

export default xoConfig;
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
distribution/
*.tsbuildinfo
```

- [ ] **Step 5: Create minimal source/cli.ts**

```typescript
#!/usr/bin/env node
import {Command} from 'commander';

const program = new Command();
program.name('listenhub').description('ListenHub CLI').version('0.1.0');

program.parse();
```

- [ ] **Step 6: Install dependencies and verify build**

Run: `cd ~/coding/marswave/listenhub-cli && npm install && npm run build`
Expected: Clean build, `distribution/source/cli.js` exists

- [ ] **Step 7: Verify CLI runs**

Run: `node distribution/source/cli.js --version`
Expected: `0.1.0`

- [ ] **Step 8: Run lint**

Run: `npm test`
Expected: xo passes

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json xo.config.mjs .gitignore source/cli.ts package-lock.json
git commit -m "chore: scaffold project with Commander.js, TypeScript, xo"
```

---

## Task 2: Credential Storage (`_shared/credentials.ts`)

**Files:**
- Create: `source/_shared/credentials.ts`

This is the foundation for auth — all commands need it.

- [ ] **Step 1: Implement credentials.ts**

```typescript
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {StoredCredentials} from '@marswave/listenhub-sdk';

function getConfigDir(): string {
	const xdg = process.env['XDG_CONFIG_HOME'];
	return path.join(xdg ?? path.join(os.homedir(), '.config'), 'listenhub');
}

function getCredentialsPath(): string {
	return path.join(getConfigDir(), 'credentials.json');
}

export async function loadCredentials(): Promise<StoredCredentials | undefined> {
	const filePath = getCredentialsPath();
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(raw) as StoredCredentials;
	} catch {
		return undefined;
	}
}

export async function saveCredentials(creds: StoredCredentials): Promise<void> {
	const dir = getConfigDir();
	fs.mkdirSync(dir, {recursive: true});

	const filePath = getCredentialsPath();
	const tmpPath = `${filePath}.tmp.${process.pid}`;

	fs.writeFileSync(tmpPath, JSON.stringify(creds, null, '\t'), {mode: 0o600});
	fs.renameSync(tmpPath, filePath);
}

export async function deleteCredentials(): Promise<void> {
	const filePath = getCredentialsPath();
	try {
		fs.unlinkSync(filePath);
	} catch {
		// Already gone, that's fine
	}
}
```

- [ ] **Step 2: Run lint**

Run: `npm test`
Expected: passes

- [ ] **Step 3: Commit**

```bash
git add source/_shared/credentials.ts
git commit -m "feat: add credential storage with atomic write and 0600 permissions"
```

---

## Task 3: Client Factory (`_shared/client.ts`)

**Files:**
- Create: `source/_shared/client.ts`

- [ ] **Step 1: Implement client.ts**

```typescript
import {ListenHubClient} from '@marswave/listenhub-sdk';
import {CliAuthError} from './output.js';
import {loadCredentials, saveCredentials} from './credentials.js';

const REFRESH_BUFFER_MS = 60_000;

export async function getClient(): Promise<ListenHubClient> {
	let creds = await loadCredentials();
	if (!creds) {
		throw new CliAuthError('Not logged in. Run `listenhub auth login` first.');
	}

	if (creds.expiresAt - Date.now() < REFRESH_BUFFER_MS) {
		const tempClient = new ListenHubClient({accessToken: creds.accessToken});
		const tokens = await tempClient.refresh({refreshToken: creds.refreshToken});
		creds = {
			...creds,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			expiresAt: Date.now() + (tokens.expiresIn * 1000),
		};
		await saveCredentials(creds);
	}

	return new ListenHubClient({accessToken: creds.accessToken});
}
```

- [ ] **Step 2: Run lint**

Run: `npm test`

- [ ] **Step 3: Commit**

```bash
git add source/_shared/client.ts
git commit -m "feat: add authenticated client factory with auto-refresh"
```

---

## Task 4: Output Helpers (`_shared/output.ts`)

**Files:**
- Create: `source/_shared/output.ts`

- [ ] **Step 1: Implement output.ts**

```typescript
import process from 'node:process';
import {ListenHubError} from '@marswave/listenhub-sdk';

export function printJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}

export function printDetail(label: string, rows: Array<[string, string | number | undefined]>): void {
	console.log(`✓ ${label}\n`);
	for (const [key, value] of rows) {
		if (value !== undefined) {
			console.log(`  ${key.padEnd(10)} ${String(value)}`);
		}
	}
}

export function printTable(headers: string[], rows: string[][]): void {
	const widths = headers.map((h, i) =>
		Math.max(h.length, ...rows.map(r => (r[i] ?? '').length)),
	);
	console.log('  ' + headers.map((h, i) => h.padEnd(widths[i]!)).join('  '));
	for (const row of rows) {
		console.log('  ' + row.map((c, i) => c.padEnd(widths[i]!)).join('  '));
	}
}

export class CliTimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CliTimeoutError';
	}
}

export class CliAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CliAuthError';
	}
}

export function handleError(error: unknown, json: boolean): never {
	if (json) {
		const msg = error instanceof ListenHubError
			? {error: error.message, code: error.code, requestId: error.requestId}
			: {error: error instanceof Error ? error.message : String(error), code: 'UNKNOWN'};
		console.error(JSON.stringify(msg, null, 2));
	} else {
		const msg = error instanceof Error ? error.message : String(error);
		console.error(`✗ Error: ${msg}`);
	}

	if (error instanceof CliAuthError || (error instanceof ListenHubError && (error.status === 401 || error.status === 403))) {
		process.exit(2);
	}

	if (error instanceof CliTimeoutError) {
		process.exit(3);
	}

	process.exit(1);
}
```

- [ ] **Step 2: Run lint**

Run: `npm test`

- [ ] **Step 3: Commit**

```bash
git add source/_shared/output.ts
git commit -m "feat: add output formatting helpers (json, table, detail, error)"
```

---

## Task 5: Polling (`_shared/polling.ts`)

**Files:**
- Create: `source/_shared/polling.ts`

- [ ] **Step 1: Implement polling.ts**

```typescript
import type {AIImageItem, EpisodeDetail, ListenHubClient} from '@marswave/listenhub-sdk';
import ora from 'ora';
import {CliTimeoutError} from './output.js';

const POLL_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_S = 300;

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

export async function pollUntilDone(
	client: ListenHubClient,
	episodeId: string,
	options: {timeout?: number; label?: string; json?: boolean},
): Promise<EpisodeDetail> {
	const timeoutS = options.timeout ?? DEFAULT_TIMEOUT_S;
	const maxAttempts = Math.ceil(timeoutS / (POLL_INTERVAL_MS / 1000));
	const spinner = options.json ? undefined : ora({text: `${options.label ?? 'Creating'}... (1/${maxAttempts})`}).start();

	for (let i = 0; i < maxAttempts; i++) {
		if (i > 0) {
			await sleep(POLL_INTERVAL_MS); // eslint-disable-line no-await-in-loop
		}

		const detail = await client.getCreation(episodeId); // eslint-disable-line no-await-in-loop
		if (detail.processStatus === 'success') {
			spinner?.succeed(`${options.label ?? 'Created'} successfully`);
			return detail;
		}

		if (detail.processStatus === 'fail') {
			spinner?.fail('Creation failed');
			throw new Error(`Creation failed (code: ${detail.failCode})`);
		}

		spinner?.text = `${options.label ?? 'Creating'}... (${i + 2}/${maxAttempts})`;
	}

	spinner?.fail('Timed out');
	throw new CliTimeoutError(`Timed out after ${timeoutS}s`);
}

export async function pollImageUntilDone(
	client: ListenHubClient,
	imageId: string,
	options: {timeout?: number; json?: boolean},
): Promise<AIImageItem> {
	const timeoutS = options.timeout ?? 120;
	const maxAttempts = Math.ceil(timeoutS / (POLL_INTERVAL_MS / 1000));
	const spinner = options.json ? undefined : ora({text: `Creating image... (1/${maxAttempts})`}).start();

	for (let i = 0; i < maxAttempts; i++) {
		if (i > 0) {
			await sleep(POLL_INTERVAL_MS); // eslint-disable-line no-await-in-loop
		}

		const item = await client.getAIImage(imageId); // eslint-disable-line no-await-in-loop
		if (item.status === 'success') {
			spinner?.succeed('Image created successfully');
			return item;
		}

		if (item.status === 'fail') {
			spinner?.fail('Image creation failed');
			throw new Error('Image creation failed');
		}

		spinner?.text = `Creating image... (${i + 2}/${maxAttempts})`;
	}

	spinner?.fail('Timed out');
	throw new CliTimeoutError(`Timed out after ${timeoutS}s`);
}
```

- [ ] **Step 2: Run lint**

Run: `npm test`

- [ ] **Step 3: Commit**

```bash
git add source/_shared/polling.ts
git commit -m "feat: add creation polling with ora spinner"
```

---

## Task 6: Source Builder & Language Detection (`_shared/sources.ts`, `_shared/language.ts`)

**Files:**
- Create: `source/_shared/sources.ts`
- Create: `source/_shared/language.ts`

- [ ] **Step 1: Implement sources.ts**

```typescript
import type {ContentSource} from '@marswave/listenhub-sdk';

export function buildSources(urls?: string[], texts?: string[]): ContentSource[] {
	const sources: ContentSource[] = [];
	for (const uri of urls ?? []) {
		sources.push({type: 'url', uri});
	}

	for (const content of texts ?? []) {
		sources.push({type: 'text', content});
	}

	return sources;
}
```

- [ ] **Step 2: Implement language.ts**

```typescript
import type {Language} from '@marswave/listenhub-sdk';

const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/;

export function inferLanguage(text?: string): Language {
	if (!text) return 'en';
	if (KANA_RE.test(text)) return 'ja';
	if (CJK_RE.test(text)) return 'zh';
	return 'en';
}
```

- [ ] **Step 3: Run lint**

Run: `npm test`

- [ ] **Step 4: Commit**

```bash
git add source/_shared/sources.ts source/_shared/language.ts
git commit -m "feat: add source builder and language detection utilities"
```

---

## Task 7: Speaker Resolver (`_shared/speaker-resolver.ts`)

**Files:**
- Create: `source/_shared/speaker-resolver.ts`

- [ ] **Step 1: Implement speaker-resolver.ts**

```typescript
import type {Language, ListenHubClient} from '@marswave/listenhub-sdk';

// Default speaker innerIds per language (confirmed from skills shared/speaker-selection.md)
// These will be verified against the API at implementation time
const DEFAULT_SPEAKERS: Record<Language, string[]> = {
	zh: ['zhiyu', 'zhichen'],
	en: ['alloy', 'echo'],
	ja: ['nanami', 'keita'],
};

export async function resolveSpeakers(
	client: ListenHubClient,
	options: {
		speakerNames?: string[];
		speakerIds?: string[];
		language: Language;
		count?: number;
	},
): Promise<string[]> {
	// Direct IDs bypass resolution
	if (options.speakerIds?.length) {
		return options.speakerIds;
	}

	// No speaker specified → use defaults
	if (!options.speakerNames?.length) {
		const defaults = DEFAULT_SPEAKERS[options.language] ?? DEFAULT_SPEAKERS.en;
		const count = options.count ?? defaults.length;
		return defaults.slice(0, count);
	}

	// Resolve names via API
	const {items} = await client.listSpeakers({language: options.language});
	const resolved: string[] = [];

	for (const name of options.speakerNames) {
		const match = items.find(
			s => s.name.toLowerCase() === name.toLowerCase(),
		);
		if (!match) {
			const available = items.map(s => s.name).join(', ');
			throw new Error(
				`Speaker "${name}" not found. Available: ${available}`,
			);
		}

		resolved.push(match.speakerInnerId);
	}

	return resolved;
}
```

- [ ] **Step 2: Run lint**

Run: `npm test`

- [ ] **Step 3: Commit**

```bash
git add source/_shared/speaker-resolver.ts
git commit -m "feat: add speaker name resolver with defaults per language"
```

---

## Task 8: Auth Commands (`auth/`)

**Files:**
- Create: `source/auth/_cli.ts`
- Create: `source/auth/auth.ts`
- Create: `source/auth/login-server.ts`
- Modify: `source/cli.ts`

- [ ] **Step 1: Implement login-server.ts**

```typescript
import http from 'node:http';
import type {AddressInfo} from 'node:net';

type CallbackResult = {code: string};

export async function startCallbackServer(): Promise<{
	port: number;
	waitForCode: () => Promise<CallbackResult>;
	close: () => void;
}> {
	let resolveCode: (result: CallbackResult) => void;
	const codePromise = new Promise<CallbackResult>(resolve => {
		resolveCode = resolve;
	});

	const server = http.createServer((req, res) => {
		const url = new URL(req.url!, `http://localhost`);
		const code = url.searchParams.get('code');

		if (code) {
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end('<html><body><h1>Login successful!</h1><p>You can close this tab.</p></body></html>');
			resolveCode({code});
		} else {
			res.writeHead(400, {'Content-Type': 'text/plain'});
			res.end('Missing code parameter');
		}
	});

	await new Promise<void>(resolve => {
		server.listen(0, '127.0.0.1', resolve);
	});

	const {port} = server.address() as AddressInfo;

	return {
		port,
		waitForCode: () => codePromise,
		close() {
			server.close();
		},
	};
}
```

- [ ] **Step 2: Implement auth.ts**

```typescript
import open from 'open';
import {ListenHubClient} from '@marswave/listenhub-sdk';
import {deleteCredentials, loadCredentials, saveCredentials} from '../_shared/credentials.js';
import {startCallbackServer} from './login-server.js';

export async function runLogin(): Promise<void> {
	const server = await startCallbackServer();
	try {
		const client = new ListenHubClient();
		const {sessionId, authUrl} = await client.connectInit({callbackPort: server.port});

		console.error(`Opening browser for login...`);
		await open(authUrl);

		const {code} = await server.waitForCode();
		const tokens = await client.connectToken({sessionId, code});

		await saveCredentials({
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			expiresAt: Date.now() + (tokens.expiresIn * 1000),
		});

		// Fetch username to confirm
		const authedClient = new ListenHubClient({accessToken: tokens.accessToken});
		const user = await authedClient.getCurrentUser();
		console.log(`✓ Logged in as ${user.nickname || user.email || 'user'}`);
	} finally {
		server.close();
	}
}

export async function runLogout(): Promise<void> {
	const creds = await loadCredentials();
	if (creds?.refreshToken) {
		try {
			const client = new ListenHubClient({accessToken: creds.accessToken});
			await client.revoke({refreshToken: creds.refreshToken});
		} catch {
			console.error('Warning: remote revoke failed, local credentials cleared');
		}
	}

	await deleteCredentials();
	console.log('✓ Logged out');
}

export async function runStatus(json: boolean): Promise<void> {
	const creds = await loadCredentials();
	if (!creds) {
		if (json) {
			console.log(JSON.stringify({loggedIn: false}));
		} else {
			console.log('Not logged in');
		}

		process.exit(1);
	}

	try {
		const client = new ListenHubClient({accessToken: creds.accessToken});
		const user = await client.getCurrentUser();
		const expiresAt = new Date(creds.expiresAt).toISOString();

		if (json) {
			console.log(JSON.stringify({loggedIn: true, user: user.nickname, email: user.email, expiresAt}, null, 2));
		} else {
			console.log(`✓ Logged in as ${user.nickname || 'user'}`);
			console.log(`  Email:      ${user.email}`);
			console.log(`  Expires at: ${expiresAt}`);
		}
	} catch {
		if (json) {
			console.log(JSON.stringify({loggedIn: false, error: 'Token expired or invalid'}));
		} else {
			console.log('Not logged in (token expired or invalid)');
		}

		process.exit(1);
	}
}
```

- [ ] **Step 3: Implement auth/_cli.ts**

```typescript
import type {Command} from 'commander';
import {handleError} from '../_shared/output.js';
import {runLogin, runLogout, runStatus} from './auth.js';

export function register(program: Command) {
	const auth = program.command('auth').description('Manage authentication');

	auth
		.command('login')
		.description('Log in via browser OAuth')
		.action(async () => {
			try {
				await runLogin();
			} catch (error) {
				handleError(error, false);
			}
		});

	auth
		.command('logout')
		.description('Log out and revoke tokens')
		.action(async () => {
			try {
				await runLogout();
			} catch (error) {
				handleError(error, false);
			}
		});

	auth
		.command('status')
		.description('Show current login status')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {json: boolean}) => {
			try {
				await runStatus(options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
```

- [ ] **Step 4: Update source/cli.ts to register auth**

```typescript
#!/usr/bin/env node
import {Command} from 'commander';
import {register as registerAuth} from './auth/_cli.js';

const program = new Command();
program.name('listenhub').description('ListenHub CLI').version('0.1.0');

registerAuth(program);

program.parse();
```

- [ ] **Step 5: Run lint**

Run: `npm test`

- [ ] **Step 6: Commit**

```bash
git add source/auth/ source/_shared/credentials.ts source/cli.ts
git commit -m "feat: add auth login/logout/status with OAuth and credential storage"
```

---

## Task 9: Speakers Command (`speakers/`)

**Files:**
- Create: `source/speakers/_cli.ts`
- Create: `source/speakers/speakers.ts`
- Modify: `source/cli.ts`

- [ ] **Step 1: Implement speakers.ts**

```typescript
import type {ListenHubClient} from '@marswave/listenhub-sdk';
import {printJson, printTable} from '../_shared/output.js';

export async function listSpeakers(
	client: ListenHubClient,
	options: {lang?: string; json: boolean},
): Promise<void> {
	const {items} = await client.listSpeakers({
		language: options.lang,
	});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['Name', 'ID', 'Gender', 'Personality'];
	const rows = items.map(s => [s.name, s.speakerInnerId, s.gender, s.personality]);
	printTable(headers, rows);
}
```

- [ ] **Step 2: Implement speakers/_cli.ts**

```typescript
import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {listSpeakers} from './speakers.js';

export function register(program: Command) {
	const cmd = program.command('speakers').description('Manage speakers');

	cmd
		.command('list')
		.description('List available speakers')
		.option('--lang <lang>', 'Filter by language (en, zh, ja)')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {lang?: string; json: boolean}) => {
			try {
				const client = await getClient();
				await listSpeakers(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
```

- [ ] **Step 3: Register in cli.ts**

Add `import {register as registerSpeakers} from './speakers/_cli.js';` and `registerSpeakers(program);`

- [ ] **Step 4: Run lint**

Run: `npm test`

- [ ] **Step 5: Commit**

```bash
git add source/speakers/ source/cli.ts
git commit -m "feat: add speakers list command"
```

---

## Task 10: Podcast Command (`podcast/`)

**Files:**
- Create: `source/podcast/_cli.ts`
- Create: `source/podcast/podcast.ts`
- Modify: `source/cli.ts`

This is the first content creation command. It establishes the pattern for all others.

- [ ] **Step 1: Implement podcast.ts**

```typescript
import type {ListenHubClient} from '@marswave/listenhub-sdk';
import {inferLanguage} from '../_shared/language.js';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollUntilDone} from '../_shared/polling.js';
import {buildSources} from '../_shared/sources.js';
import {resolveSpeakers} from '../_shared/speaker-resolver.js';

export type PodcastCreateOptions = {
	query?: string;
	sourceUrl?: string[];
	sourceText?: string[];
	mode: string;
	lang?: string;
	speaker?: string[];
	speakerId?: string[];
	wait: boolean;
	timeout: number;
	json: boolean;
};

export async function createPodcast(
	client: ListenHubClient,
	options: PodcastCreateOptions,
): Promise<void> {
	const lang = (options.lang ?? inferLanguage(options.query)) as 'en' | 'zh' | 'ja';
	const speakers = await resolveSpeakers(client, {
		speakerNames: options.speaker,
		speakerIds: options.speakerId,
		language: lang,
	});

	const {episodeId} = await client.createPodcast({
		type: speakers.length <= 1 ? 'podcast-solo' : 'podcast-duo',
		query: options.query,
		sources: buildSources(options.sourceUrl, options.sourceText),
		template: {
			type: 'podcast',
			mode: options.mode as 'quick' | 'deep' | 'debate',
			speakers,
			language: lang,
		},
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`✓ Podcast submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollUntilDone(client, episodeId, {
		timeout: options.timeout,
		label: 'Creating podcast',
		json: options.json,
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Podcast created', [
			['ID:', detail.id],
			['Title:', detail.topicDetail.title.data],
			['Status:', detail.processStatus],
		]);
	}
}

export type PodcastListOptions = {
	page: number;
	pageSize: number;
	json: boolean;
};

export async function listPodcasts(
	client: ListenHubClient,
	options: PodcastListOptions,
): Promise<void> {
	const {items} = await client.listPodcasts({page: options.page, pageSize: options.pageSize});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['ID', 'Title', 'Status', 'Created'];
	const rows = items.map(e => [
		e.id,
		e.title,
		e.processStatus,
		new Date(e.createdAt).toISOString().slice(0, 10),
	]);
	printTable(headers, rows);
}
```

- [ ] **Step 2: Implement podcast/_cli.ts**

```typescript
import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {createPodcast, listPodcasts} from './podcast.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

export function register(program: Command) {
	const cmd = program.command('podcast').description('Podcast generation');

	cmd
		.command('create')
		.description('Create a podcast episode')
		.option('--query <text>', 'Topic text')
		.option('--source-url <url>', 'Reference URL (repeatable)', collect, [])
		.option('--source-text <text>', 'Reference text (repeatable)', collect, [])
		.option('--mode <mode>', 'Generation mode: quick, deep, debate', 'quick')
		.option('--lang <lang>', 'Language: en, zh, ja (auto-detected if omitted)')
		.option('--speaker <name>', 'Speaker name (repeatable)', collect, [])
		.option('--speaker-id <id>', 'Speaker inner ID (repeatable)', collect, [])
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 300)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options) => {
			try {
				const client = await getClient();
				await createPodcast(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('list')
		.description('List podcast episodes')
		.option('--page <n>', 'Page number', Number, 1)
		.option('--page-size <n>', 'Items per page', Number, 20)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options) => {
			try {
				const client = await getClient();
				await listPodcasts(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
```

- [ ] **Step 3: Register in cli.ts**

Add `import {register as registerPodcast} from './podcast/_cli.js';` and `registerPodcast(program);`

- [ ] **Step 4: Run lint**

Run: `npm test`

- [ ] **Step 5: Commit**

```bash
git add source/podcast/ source/cli.ts
git commit -m "feat: add podcast create/list commands"
```

---

## Task 11: TTS Command (`tts/`)

**Files:**
- Create: `source/tts/_cli.ts`
- Create: `source/tts/tts.ts`
- Modify: `source/cli.ts`

Follows podcast pattern with `--text` as primary source.

- [ ] **Step 1: Implement tts.ts**

```typescript
import type {ListenHubClient} from '@marswave/listenhub-sdk';
import {inferLanguage} from '../_shared/language.js';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollUntilDone} from '../_shared/polling.js';
import {buildSources} from '../_shared/sources.js';
import {resolveSpeakers} from '../_shared/speaker-resolver.js';

export type TtsCreateOptions = {
	text?: string;
	sourceUrl?: string[];
	sourceText?: string[];
	mode: string;
	lang?: string;
	speaker?: string;
	speakerId?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export async function createTts(
	client: ListenHubClient,
	options: TtsCreateOptions,
): Promise<void> {
	const lang = (options.lang ?? inferLanguage(options.text)) as 'en' | 'zh' | 'ja';
	const speakers = await resolveSpeakers(client, {
		speakerNames: options.speaker ? [options.speaker] : undefined,
		speakerIds: options.speakerId ? [options.speakerId] : undefined,
		language: lang,
		count: 1,
	});

	const sources = options.text
		? [{type: 'text' as const, content: options.text}]
		: buildSources(options.sourceUrl, options.sourceText);

	const {episodeId} = await client.createTTS({
		sources,
		template: {
			type: 'flowspeech',
			mode: options.mode as 'smart' | 'direct',
			speakers,
			language: lang,
		},
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`✓ TTS submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollUntilDone(client, episodeId, {
		timeout: options.timeout,
		label: 'Creating TTS',
		json: options.json,
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('TTS created', [
			['ID:', detail.id],
			['Title:', detail.topicDetail.title.data],
			['Status:', detail.processStatus],
		]);
	}
}

export type TtsListOptions = {page: number; pageSize: number; json: boolean};

export async function listTts(
	client: ListenHubClient,
	options: TtsListOptions,
): Promise<void> {
	const {items} = await client.listTTS({page: options.page, pageSize: options.pageSize});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['ID', 'Title', 'Status', 'Created'];
	const rows = items.map(e => [e.id, e.title, e.processStatus, new Date(e.createdAt).toISOString().slice(0, 10)]);
	printTable(headers, rows);
}
```

- [ ] **Step 2: Implement tts/_cli.ts**

Same structure as podcast `_cli.ts` but with `--text` option, single `--speaker`/`--speaker-id` (not repeatable), `--mode` choices `smart|direct`, default mode `smart`.

- [ ] **Step 3: Register in cli.ts, lint, commit**

```bash
git add source/tts/ source/cli.ts
git commit -m "feat: add tts create/list commands"
```

---

## Task 12: Explainer Command (`explainer/`)

**Files:**
- Create: `source/explainer/_cli.ts`
- Create: `source/explainer/explainer.ts`
- Modify: `source/cli.ts`

- [ ] **Step 1: Implement explainer.ts**

```typescript
import type {ListenHubClient} from '@marswave/listenhub-sdk';
import {inferLanguage} from '../_shared/language.js';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollUntilDone} from '../_shared/polling.js';
import {buildSources} from '../_shared/sources.js';
import {resolveSpeakers} from '../_shared/speaker-resolver.js';

export type ExplainerCreateOptions = {
	query?: string;
	sourceUrl?: string[];
	sourceText?: string[];
	mode: string;
	lang?: string;
	speaker?: string;
	speakerId?: string;
	skipAudio: boolean;
	imageSize: string;
	aspectRatio: string;
	style?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export async function createExplainer(
	client: ListenHubClient,
	options: ExplainerCreateOptions,
): Promise<void> {
	const lang = (options.lang ?? inferLanguage(options.query)) as 'en' | 'zh' | 'ja';
	const speakers = await resolveSpeakers(client, {
		speakerNames: options.speaker ? [options.speaker] : undefined,
		speakerIds: options.speakerId ? [options.speakerId] : undefined,
		language: lang,
		count: 1,
	});

	const size = (options.imageSize ?? '2K') as '2K' | '4K';
	const aspectRatio = (options.aspectRatio ?? '16:9') as '16:9' | '9:16' | '1:1';

	const {episodeId} = await client.createExplainerVideo({
		query: options.query,
		sources: buildSources(options.sourceUrl, options.sourceText),
		style: options.style,
		skipAudio: options.skipAudio,
		imageConfig: {size, aspectRatio},
		template: {
			type: 'storybook',
			mode: options.mode as 'info' | 'story',
			speakers,
			language: lang,
			style: options.style,
			size,
			aspectRatio,
		},
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`✓ Explainer submitted: ${episodeId}`);
		}
		return;
	}

	const detail = await pollUntilDone(client, episodeId, {
		timeout: options.timeout,
		label: 'Creating explainer',
		json: options.json,
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Explainer created', [
			['ID:', detail.id],
			['Title:', detail.topicDetail.title.data],
			['Status:', detail.processStatus],
		]);
	}
}

export type ExplainerListOptions = {page: number; pageSize: number; json: boolean};

export async function listExplainerVideos(
	client: ListenHubClient,
	options: ExplainerListOptions,
): Promise<void> {
	const {items} = await client.listExplainerVideos({page: options.page, pageSize: options.pageSize});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['ID', 'Title', 'Status', 'Created'];
	const rows = items.map(e => [e.id, e.title, e.processStatus, new Date(e.createdAt).toISOString().slice(0, 10)]);
	printTable(headers, rows);
}
```

- [ ] **Step 2: Implement explainer/_cli.ts**

Options: `--query`, `--source-url`, `--source-text`, `--mode <info|story>`, `--lang`, `--speaker`, `--speaker-id`, `--skip-audio`, `--image-size <2K|4K>`, `--aspect-ratio <16:9|9:16|1:1>`, `--style`, `--no-wait`, `--timeout`, `--json`

- [ ] **Step 3: Register in cli.ts, lint, commit**

```bash
git add source/explainer/ source/cli.ts
git commit -m "feat: add explainer create/list commands"
```

---

## Task 13: Slides Command (`slides/`)

**Files:**
- Create: `source/slides/_cli.ts`
- Create: `source/slides/slides.ts`
- Modify: `source/cli.ts`

- [ ] **Step 1: Implement slides.ts**

Nearly identical to explainer, but:
- Template mode is fixed to `'slides'` (no `--mode` option)
- `skipAudio` defaults to `true` (user overrides with `--no-skip-audio`)
- See spec lines 316-336 for exact mapping

- [ ] **Step 2: Implement slides/_cli.ts**

Same as explainer `_cli.ts` minus `--mode` option.

- [ ] **Step 3: Register in cli.ts, lint, commit**

```bash
git add source/slides/ source/cli.ts
git commit -m "feat: add slides create/list commands"
```

---

## Task 14: Image Command (`image/`)

**Files:**
- Create: `source/image/_cli.ts`
- Create: `source/image/image.ts`
- Modify: `source/cli.ts`

- [ ] **Step 1: Implement image.ts**

Image uses different SDK methods and response types:
- `client.createAIImage()` → `{imageId}` (not episodeId)
- `client.listAIImages()` → `AIImageItem[]` (different fields from EpisodeItem)
- `client.getAIImage(id)` → `AIImageItem`
- Polling: check `item.status` field (not `processStatus`)
- Parameter mapping: `imageSize` (not `size`), `referenceImageUrls`, optional `model`/`language`
- See spec lines 358-368 for exact mapping

Implement `createImage()`, `listImages()`, `getImage()`.

- [ ] **Step 2: Implement image/_cli.ts**

Commands: `image create`, `image list`, `image get <id>`

Options for create: `--prompt` (required), `--model`, `--lang`, `--aspect-ratio`, `--size`, `--reference-url` (repeatable), `--no-wait`, `--timeout 120`, `--json`

- [ ] **Step 3: Register in cli.ts, lint, commit**

```bash
git add source/image/ source/cli.ts
git commit -m "feat: add image create/list/get commands"
```

---

## Task 15: Creation Command (`creation/`)

**Files:**
- Create: `source/creation/_cli.ts`
- Create: `source/creation/creation.ts`
- Modify: `source/cli.ts`

- [ ] **Step 1: Implement creation.ts**

```typescript
import type {ListenHubClient} from '@marswave/listenhub-sdk';
import {printDetail, printJson} from '../_shared/output.js';

export async function getCreation(
	client: ListenHubClient,
	episodeId: string,
	json: boolean,
): Promise<void> {
	const detail = await client.getCreation(episodeId);

	if (json) {
		printJson(detail);
		return;
	}

	printDetail('Creation details', [
		['ID:', detail.id],
		['Type:', detail.generationType],
		['Status:', detail.processStatus],
		['Language:', detail.language],
		['Created:', new Date(detail.createdAt).toISOString()],
	]);
}

export async function deleteCreations(
	client: ListenHubClient,
	ids: string[],
	json: boolean,
): Promise<void> {
	await client.deleteCreations({ids});

	if (json) {
		printJson({deleted: ids});
	} else {
		console.log(`✓ Deleted ${ids.length} creation(s)`);
	}
}
```

- [ ] **Step 2: Implement creation/_cli.ts**

Commands: `creation get <id>`, `creation delete <id...>`

- [ ] **Step 3: Register in cli.ts, lint, commit**

```bash
git add source/creation/ source/cli.ts
git commit -m "feat: add creation get/delete commands"
```

---

## Task 16: Final Integration & Smoke Test

**Files:**
- Modify: `source/cli.ts` (ensure all commands registered)

- [ ] **Step 1: Verify final cli.ts has all registrations**

```typescript
#!/usr/bin/env node
import {Command} from 'commander';
import {register as registerAuth} from './auth/_cli.js';
import {register as registerCreation} from './creation/_cli.js';
import {register as registerExplainer} from './explainer/_cli.js';
import {register as registerImage} from './image/_cli.js';
import {register as registerPodcast} from './podcast/_cli.js';
import {register as registerSlides} from './slides/_cli.js';
import {register as registerSpeakers} from './speakers/_cli.js';
import {register as registerTts} from './tts/_cli.js';

const program = new Command();
program.name('listenhub').description('ListenHub CLI').version('0.1.0');

registerAuth(program);
registerPodcast(program);
registerTts(program);
registerExplainer(program);
registerSlides(program);
registerImage(program);
registerSpeakers(program);
registerCreation(program);

program.parse();
```

- [ ] **Step 2: Full build + lint**

Run: `npm run build && npm test`
Expected: Clean build, lint passes

- [ ] **Step 3: Smoke test help output**

Run: `node distribution/source/cli.js --help`
Expected: All commands listed (auth, podcast, tts, explainer, slides, image, speakers, creation)

Run: `node distribution/source/cli.js podcast --help`
Expected: Subcommands listed (create, list)

Run: `node distribution/source/cli.js podcast create --help`
Expected: All options listed

- [ ] **Step 4: Smoke test auth flow**

Run: `node distribution/source/cli.js auth status`
Expected: "Not logged in" with exit code 1

Run: `node distribution/source/cli.js auth login`
Expected: Opens browser, completes OAuth, shows "Logged in as ..."

Run: `node distribution/source/cli.js auth status`
Expected: Shows user info

- [ ] **Step 5: Smoke test content creation**

Run: `node distribution/source/cli.js speakers list --lang zh`
Expected: Lists Chinese speakers

Run: `node distribution/source/cli.js podcast create --query "AI趋势" --mode quick --no-wait`
Expected: Returns episode ID

Run: `node distribution/source/cli.js creation get <id-from-above> --json`
Expected: JSON with processStatus

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete CLI integration with all commands"
```

- [ ] **Step 7: Link npm package for local testing**

Run: `npm link`
Expected: `listenhub` command available globally

Run: `listenhub --version`
Expected: `0.1.0`
