import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('isNewerVersion', () => {
	it('detects a higher patch/minor/major', async () => {
		const {isNewerVersion} = await import('../source/_shared/update-check.js');
		expect(isNewerVersion('0.0.15', '0.0.16')).toBe(true);
		expect(isNewerVersion('0.0.15', '0.1.0')).toBe(true);
		expect(isNewerVersion('0.0.15', '1.0.0')).toBe(true);
	});

	it('returns false for equal or older', async () => {
		const {isNewerVersion} = await import('../source/_shared/update-check.js');
		expect(isNewerVersion('0.0.15', '0.0.15')).toBe(false);
		expect(isNewerVersion('0.1.0', '0.0.16')).toBe(false);
		expect(isNewerVersion('1.0.0', '0.9.9')).toBe(false);
	});

	it('ignores a leading v and prerelease tags', async () => {
		const {isNewerVersion} = await import('../source/_shared/update-check.js');
		expect(isNewerVersion('0.0.15', 'v0.0.16')).toBe(true);
		// Prerelease core equals current release core → not treated as newer.
		expect(isNewerVersion('0.0.16', '0.0.16-beta.1')).toBe(false);
	});

	it('returns false on unparseable input (never throws)', async () => {
		const {isNewerVersion} = await import('../source/_shared/update-check.js');
		expect(isNewerVersion('0.0.15', 'not-a-version')).toBe(false);
		expect(isNewerVersion('garbage', '1.0.0')).toBe(false);
	});
});

describe('checkForUpdate', () => {
	let tmpDir: string;
	let stderr: string;
	const originalIsTTY = process.stderr.isTTY;

	function setTTY(value: boolean): void {
		// isTTY is undefined under the test runner, so define it directly rather
		// than spy on a getter that may not exist.
		Object.defineProperty(process.stderr, 'isTTY', {
			value,
			configurable: true,
			writable: true,
		});
	}

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-cli-upd-'));
		vi.stubEnv('XDG_CONFIG_HOME', tmpDir);
		vi.stubEnv('NO_UPDATE_NOTIFIER', '');
		vi.stubEnv('CI', '');
		stderr = '';
		vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
			stderr += String(chunk);
			return true;
		});
		// Force the TTY guard open so the notice path is exercised in tests.
		setTTY(true);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
		Object.defineProperty(process.stderr, 'isTTY', {
			value: originalIsTTY,
			configurable: true,
			writable: true,
		});
		fs.rmSync(tmpDir, {recursive: true, force: true});
	});

	function cachePath(): string {
		return path.join(tmpDir, 'listenhub', 'update-check.json');
	}

	it('notifies and caches when the registry reports a newer version', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({version: '9.9.9'}), {status: 200}));
		const {checkForUpdate} = await import('../source/_shared/update-check.js');

		await checkForUpdate(1000);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(stderr).toContain('Update available');
		expect(stderr).toContain('9.9.9');
		expect(stderr).toContain('npm install -g @marswave/listenhub-cli@latest');
		// Cache written with the fetched version.
		const cache = JSON.parse(fs.readFileSync(cachePath(), 'utf8')) as {
			lastCheck: number;
			latestVersion: string;
		};
		expect(cache.latestVersion).toBe('9.9.9');
		expect(cache.lastCheck).toBe(1000);
	});

	it('stays silent when the registry version is not newer', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({version: '0.0.0'}), {status: 200}),
		);
		const {checkForUpdate} = await import('../source/_shared/update-check.js');

		await checkForUpdate(1000);
		expect(stderr).toBe('');
	});

	it('uses a fresh cache without hitting the network', async () => {
		fs.mkdirSync(path.join(tmpDir, 'listenhub'), {recursive: true});
		fs.writeFileSync(cachePath(), JSON.stringify({lastCheck: 5000, latestVersion: '9.9.9'}));
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		const {checkForUpdate} = await import('../source/_shared/update-check.js');

		// now within 24h of lastCheck → no fetch, but still notifies from cache.
		await checkForUpdate(5000 + 60_000);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(stderr).toContain('9.9.9');
	});

	it('refetches when the cache is older than a day', async () => {
		fs.mkdirSync(path.join(tmpDir, 'listenhub'), {recursive: true});
		fs.writeFileSync(cachePath(), JSON.stringify({lastCheck: 0, latestVersion: '0.0.0'}));
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({version: '9.9.9'}), {status: 200}));
		const {checkForUpdate} = await import('../source/_shared/update-check.js');

		const dayPlus = 25 * 60 * 60 * 1000;
		await checkForUpdate(dayPlus);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(stderr).toContain('9.9.9');
	});

	it('is silent and does not fetch when muted by NO_UPDATE_NOTIFIER', async () => {
		vi.stubEnv('NO_UPDATE_NOTIFIER', '1');
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		const {checkForUpdate} = await import('../source/_shared/update-check.js');

		await checkForUpdate(1000);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(stderr).toBe('');
	});

	it('is silent and does not fetch under CI', async () => {
		vi.stubEnv('CI', 'true');
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		const {checkForUpdate} = await import('../source/_shared/update-check.js');

		await checkForUpdate(1000);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(stderr).toBe('');
	});

	it('is silent when stderr is not a TTY', async () => {
		setTTY(false);
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		const {checkForUpdate} = await import('../source/_shared/update-check.js');

		await checkForUpdate(1000);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(stderr).toBe('');
	});

	it('fails open (silent, no throw) when the registry request rejects', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
		const {checkForUpdate} = await import('../source/_shared/update-check.js');

		await expect(checkForUpdate(1000)).resolves.toBeUndefined();
		expect(stderr).toBe('');
	});

	it('fails open when the registry returns a non-OK status', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', {status: 500}));
		const {checkForUpdate} = await import('../source/_shared/update-check.js');

		await checkForUpdate(1000);
		expect(stderr).toBe('');
		// No cache written on failure.
		expect(fs.existsSync(cachePath())).toBe(false);
	});
});
