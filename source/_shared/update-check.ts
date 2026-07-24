import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const PACKAGE_NAME = '@marswave/listenhub-cli';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
// The CLI's audience includes users on networks that cannot reach many hosts
// (the whole reason api.listenhub.app exists). The registry probe must never
// slow down or block a command, so it runs on a tight budget and fails silent.
const FETCH_TIMEOUT_MS = 1500;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

interface UpdateCache {
	lastCheck: number;
	latestVersion: string;
}

function getConfigDir(): string {
	const xdg = process.env['XDG_CONFIG_HOME'];
	return path.join(xdg ?? path.join(os.homedir(), '.config'), 'listenhub');
}

function getCachePath(): string {
	return path.join(getConfigDir(), 'update-check.json');
}

export function getCurrentVersion(): string {
	// Read the real installed version from the shipped package.json rather than a
	// hardcoded string, so the comparison reflects what npm actually installed.
	// The bundle ships as dist/cli.mjs, so package.json is one level up; when
	// running from source (tests) it is two levels up from source/_shared/.
	const require = createRequire(import.meta.url);
	for (const candidate of ['../package.json', '../../package.json']) {
		try {
			const pkg = require(candidate) as {name?: string; version?: string};
			if (pkg.name === PACKAGE_NAME && typeof pkg.version === 'string') {
				return pkg.version;
			}
		} catch {}
	}

	throw new Error('unable to resolve package version');
}

/** Returns true when `latest` is a higher semver than `current`. Non-throwing. */
export function isNewerVersion(current: string, latest: string): boolean {
	const parse = (v: string): number[] =>
		v
			.trim()
			.replace(/^v/, '')
			.split('-')[0]! // drop prerelease tag; we only compare release cores
			.split('.')
			.map((n) => Number.parseInt(n, 10));

	const a = parse(current);
	const b = parse(latest);
	if (a.some(Number.isNaN) || b.some(Number.isNaN)) return false;

	for (let i = 0; i < 3; i++) {
		const ai = a[i] ?? 0;
		const bi = b[i] ?? 0;
		if (bi > ai) return true;
		if (bi < ai) return false;
	}

	return false;
}

function readCache(): UpdateCache | undefined {
	try {
		const raw = fs.readFileSync(getCachePath(), 'utf8');
		const parsed = JSON.parse(raw) as UpdateCache;
		if (typeof parsed.lastCheck === 'number' && typeof parsed.latestVersion === 'string') {
			return parsed;
		}
	} catch {}

	return undefined;
}

function writeCache(cache: UpdateCache): void {
	try {
		const dir = getConfigDir();
		fs.mkdirSync(dir, {recursive: true});
		const filePath = getCachePath();
		const tmpPath = `${filePath}.tmp.${process.pid}`;
		fs.writeFileSync(tmpPath, JSON.stringify(cache), {mode: 0o600});
		fs.renameSync(tmpPath, filePath);
	} catch {
		// Cache is an optimization; a read-only home directory must not break the CLI.
	}
}

async function fetchLatestVersion(now: number): Promise<string | undefined> {
	const controller = new AbortController();
	const timer = setTimeout(() => {
		controller.abort();
	}, FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(REGISTRY_URL, {
			signal: controller.signal,
			headers: {accept: 'application/json'},
		});
		if (!res.ok) return undefined;
		const body = (await res.json()) as {version?: string};
		if (typeof body.version !== 'string') return undefined;
		writeCache({lastCheck: now, latestVersion: body.version});
		return body.version;
	} catch {
		// DNS/TLS/proxy failure, timeout, or bad JSON — silently give up (fail-open).
		return undefined;
	} finally {
		clearTimeout(timer);
	}
}

function notify(current: string, latest: string): void {
	// Write to stderr so `--json` stdout stays machine-parseable.
	process.stderr.write(
		`\nUpdate available: ${current} → ${latest}\n` +
			`Run \`npm install -g ${PACKAGE_NAME}@latest\` to upgrade.\n\n`,
	);
}

/**
 * Best-effort "a newer version is available" notice. Never throws, never blocks
 * a command, and stays silent on any failure. Skipped in CI, when muted via
 * `NO_UPDATE_NOTIFIER`, and when stderr is not a TTY (piped/redirected output).
 */
export async function checkForUpdate(now = Date.now()): Promise<void> {
	try {
		if (process.env['NO_UPDATE_NOTIFIER'] || process.env['CI']) return;
		if (!process.stderr.isTTY) return;

		const current = getCurrentVersion();

		const cache = readCache();
		if (cache && now - cache.lastCheck < CHECK_INTERVAL_MS) {
			// Fresh cache — reuse it, no network call.
			if (isNewerVersion(current, cache.latestVersion)) {
				notify(current, cache.latestVersion);
			}

			return;
		}

		const latest = await fetchLatestVersion(now);
		if (latest && isNewerVersion(current, latest)) {
			notify(current, latest);
		}
	} catch {
		// Any unexpected failure must not surface to the user.
	}
}
