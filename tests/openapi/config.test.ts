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
