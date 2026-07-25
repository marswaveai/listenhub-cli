import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
	effectiveBaseURLs,
	loadDomainChoice,
	readDiscoveredDomains,
	resolveApiBaseURL,
	resolveOpenAPIBaseURL,
	saveDomainChoice,
} from '../source/_shared/domain.js';

describe('domain config', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-cli-domain-'));
		vi.stubEnv('XDG_CONFIG_HOME', tmpDir);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		fs.rmSync(tmpDir, {recursive: true, force: true});
	});

	it('defaults to auto, which passes no Base URL so the SDK can select', () => {
		expect(loadDomainChoice()).toBe('auto');
		expect(resolveApiBaseURL()).toBeUndefined();
		expect(resolveOpenAPIBaseURL()).toBeUndefined();
	});

	it('pins both Base URLs when set to app', () => {
		saveDomainChoice('app');

		expect(loadDomainChoice()).toBe('app');
		expect(resolveApiBaseURL()).toBe('https://api.listenhub.app/api');
		expect(resolveOpenAPIBaseURL()).toBe('https://api.listenhub.app/openapi');
	});

	it('pins the factory domains when set to default', () => {
		saveDomainChoice('default');

		expect(resolveApiBaseURL()).toBe('https://api.listenhub.ai/api');
		expect(resolveOpenAPIBaseURL()).toBe('https://api.marswave.ai/openapi');
	});

	it('returns to auto selection when cleared', () => {
		saveDomainChoice('app');
		saveDomainChoice('auto');

		expect(loadDomainChoice()).toBe('auto');
		expect(resolveApiBaseURL()).toBeUndefined();
	});

	it('keeps unrelated config keys when changing the domain', () => {
		const dir = path.join(tmpDir, 'listenhub');
		fs.mkdirSync(dir, {recursive: true});
		fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({somethingElse: 1}));

		saveDomainChoice('app');

		const config = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')) as Record<
			string,
			unknown
		>;
		expect(config['somethingElse']).toBe(1);
		expect(config['domain']).toBe('app');
	});

	it('reads what the SDK auto-selected, and tolerates a missing file', () => {
		expect(readDiscoveredDomains()).toEqual({});

		const dir = path.join(tmpDir, 'listenhub');
		fs.mkdirSync(dir, {recursive: true});
		fs.writeFileSync(
			path.join(dir, 'domain.json'),
			JSON.stringify({discovered: {'api.listenhub.ai': 'api.listenhub.app'}}),
		);

		expect(readDiscoveredDomains()).toEqual({'api.listenhub.ai': 'api.listenhub.app'});
	});

	it('tolerates a corrupt config file instead of crashing the command', () => {
		const dir = path.join(tmpDir, 'listenhub');
		fs.mkdirSync(dir, {recursive: true});
		fs.writeFileSync(path.join(dir, 'config.json'), 'not json');

		expect(loadDomainChoice()).toBe('auto');
	});
});

describe('effective Base URLs', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-cli-effective-'));
		vi.stubEnv('XDG_CONFIG_HOME', tmpDir);
		vi.stubEnv('LISTENHUB_API_URL', '');
		vi.stubEnv('LISTENHUB_OPENAPI_URL', '');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		fs.rmSync(tmpDir, {recursive: true, force: true});
	});

	function writeDiscovered(discovered: Record<string, string>): void {
		const dir = path.join(tmpDir, 'listenhub');
		fs.mkdirSync(dir, {recursive: true});
		fs.writeFileSync(path.join(dir, 'domain.json'), JSON.stringify({discovered}));
	}

	it('reports the factory defaults when nothing is set', () => {
		const {api, openapi} = effectiveBaseURLs();
		expect(api).toEqual({url: 'https://api.listenhub.ai/api', source: 'default'});
		expect(openapi).toEqual({url: 'https://api.marswave.ai/openapi', source: 'default'});
	});

	it('reports what the SDK auto-selected, not the factory default', () => {
		writeDiscovered({'api.marswave.ai': 'api.listenhub.app'});
		const {api, openapi} = effectiveBaseURLs();
		expect(api.source).toBe('default');
		expect(openapi).toEqual({url: 'https://api.listenhub.app/openapi', source: 'auto-selected'});
	});

	it('reports a pinned domain ahead of any auto selection', () => {
		writeDiscovered({'api.marswave.ai': 'api.listenhub.app'});
		saveDomainChoice('default');
		const {openapi} = effectiveBaseURLs();
		expect(openapi).toEqual({url: 'https://api.marswave.ai/openapi', source: 'pinned'});
	});

	it('reports the environment variable ahead of everything else', () => {
		vi.stubEnv('LISTENHUB_OPENAPI_URL', 'https://staging.example.com/openapi');
		saveDomainChoice('app');
		const {openapi} = effectiveBaseURLs();
		expect(openapi).toEqual({url: 'https://staging.example.com/openapi', source: 'env'});
	});
});
