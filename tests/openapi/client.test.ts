import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const mockOpenAPIClient = vi.fn();
vi.mock('@marswave/listenhub-sdk', () => ({
	OpenAPIClient: mockOpenAPIClient,
}));

describe('getOpenAPIClient', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-cli-test-'));
		vi.stubEnv('XDG_CONFIG_HOME', tmpDir);
		vi.stubEnv('LISTENHUB_API_KEY', '');
		mockOpenAPIClient.mockClear();
		mockOpenAPIClient.mockImplementation(function (this: {apiKey: string}, opts: {apiKey: string}) {
			this.apiKey = opts.apiKey;
		});
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		fs.rmSync(tmpDir, {recursive: true, force: true});
	});

	it('throws when no key is configured', async () => {
		const {getOpenAPIClient} = await import('../../source/openapi/client.js');
		await expect(getOpenAPIClient()).rejects.toThrow(/API Key/);
	});

	it('uses LISTENHUB_API_KEY env var and passes it to OpenAPIClient', async () => {
		vi.stubEnv('LISTENHUB_API_KEY', 'lh_sk_env_secret');
		const {getOpenAPIClient} = await import('../../source/openapi/client.js');
		await getOpenAPIClient();
		expect(mockOpenAPIClient).toHaveBeenCalledWith({apiKey: 'lh_sk_env_secret'});
	});

	it('uses config file when env var is absent and passes file key', async () => {
		const dir = path.join(tmpDir, 'listenhub');
		fs.mkdirSync(dir, {recursive: true});
		fs.writeFileSync(
			path.join(dir, 'openapi.json'),
			JSON.stringify({apiKey: 'lh_sk_file_secret'}),
			{mode: 0o600},
		);
		const {getOpenAPIClient} = await import('../../source/openapi/client.js');
		await getOpenAPIClient();
		expect(mockOpenAPIClient).toHaveBeenCalledWith({apiKey: 'lh_sk_file_secret'});
	});

	it('env var takes priority over config file', async () => {
		vi.stubEnv('LISTENHUB_API_KEY', 'lh_sk_env_priority');
		const dir = path.join(tmpDir, 'listenhub');
		fs.mkdirSync(dir, {recursive: true});
		fs.writeFileSync(path.join(dir, 'openapi.json'), JSON.stringify({apiKey: 'lh_sk_file_lower'}), {
			mode: 0o600,
		});
		const {getOpenAPIClient} = await import('../../source/openapi/client.js');
		await getOpenAPIClient();
		expect(mockOpenAPIClient).toHaveBeenCalledWith({apiKey: 'lh_sk_env_priority'});
	});
});
