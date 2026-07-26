import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

/**
 * `auto` 交给 SDK 自己选域（默认域连不上时自动切备选域并落盘）；`app` / `default`
 * 是用户钉死的选择，会被翻译成显式 Base URL 传给 SDK，SDK 就不再自动切换。
 */
export type DomainChoice = 'app' | 'default' | 'auto';

// ponytail: 这张表和 SDK src/domain-selection.ts 的候选域表重复，换域时两边一起改。
// 升级路径：SDK 发版后改为从 SDK 导出的映射读取。
const BASE_URLS: Record<Exclude<DomainChoice, 'auto'>, {api: string; openapi: string}> = {
	app: {
		api: 'https://api.listenhub.app/api',
		openapi: 'https://api.listenhub.app/openapi',
	},
	default: {
		api: 'https://api.listenhub.ai/api',
		openapi: 'https://api.marswave.ai/openapi',
	},
};

export const DOMAIN_CHOICES: DomainChoice[] = ['app', 'default', 'auto'];

interface CliConfig {
	domain?: DomainChoice;
}

function getConfigDir(): string {
	const xdg = process.env['XDG_CONFIG_HOME'];
	return path.join(xdg ?? path.join(os.homedir(), '.config'), 'listenhub');
}

function getConfigPath(): string {
	return path.join(getConfigDir(), 'config.json');
}

/** SDK 自动选域的落盘结果，只用于 `config show` 展示，读不到就当没有。 */
export function readDiscoveredDomains(): Record<string, string> {
	try {
		const raw = fs.readFileSync(path.join(getConfigDir(), 'domain.json'), 'utf8');
		const parsed = JSON.parse(raw) as {discovered?: Record<string, string>};
		return parsed.discovered ?? {};
	} catch {
		return {};
	}
}

export function loadDomainChoice(): DomainChoice {
	try {
		const raw = fs.readFileSync(getConfigPath(), 'utf8');
		const config = JSON.parse(raw) as CliConfig;
		return config.domain ?? 'auto';
	} catch {
		return 'auto';
	}
}

export function saveDomainChoice(choice: DomainChoice): void {
	const dir = getConfigDir();
	fs.mkdirSync(dir, {recursive: true});

	let config: CliConfig = {};
	try {
		config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')) as CliConfig;
	} catch {
		// 没有配置文件就从空开始
	}

	if (choice === 'auto') {
		delete config.domain;
	} else {
		config.domain = choice;
	}

	const filePath = getConfigPath();
	const tmpPath = `${filePath}.tmp.${process.pid}`;
	fs.writeFileSync(tmpPath, JSON.stringify(config, null, '\t'));
	fs.renameSync(tmpPath, filePath);
}

/**
 * 返回 undefined 表示不传 baseURL——让 SDK 读自己的环境变量并做自动选域。
 * 钉死了域才返回具体 Base URL，此时 SDK 完全按它发，不再切换。
 */
export function resolveApiBaseURL(): string | undefined {
	const choice = loadDomainChoice();
	return choice === 'auto' ? undefined : BASE_URLS[choice].api;
}

export function resolveOpenAPIBaseURL(): string | undefined {
	const choice = loadDomainChoice();
	return choice === 'auto' ? undefined : BASE_URLS[choice].openapi;
}

export interface EffectiveBaseURL {
	url: string;
	source: 'env' | 'pinned' | 'auto-selected' | 'default';
}

function resolveEffective(
	envValue: string | undefined,
	pinned: string | undefined,
	factory: string,
	discovered: Record<string, string>,
): EffectiveBaseURL {
	if (envValue) return {url: envValue, source: 'env'};
	if (pinned) return {url: pinned, source: 'pinned'};

	const factoryUrl = new URL(factory);
	const selected = discovered[factoryUrl.host];
	if (selected) {
		factoryUrl.host = selected;
		return {url: factoryUrl.toString().replace(/\/$/, ''), source: 'auto-selected'};
	}

	return {url: factory, source: 'default'};
}

/** `config show` 要回答的是「这条命令实际会打到哪」，所以得把 SDK 已选定的域算进来。 */
export function effectiveBaseURLs(): {api: EffectiveBaseURL; openapi: EffectiveBaseURL} {
	const discovered = readDiscoveredDomains();
	return {
		api: resolveEffective(
			process.env['LISTENHUB_API_URL'],
			resolveApiBaseURL(),
			BASE_URLS.default.api,
			discovered,
		),
		openapi: resolveEffective(
			process.env['LISTENHUB_OPENAPI_URL'],
			resolveOpenAPIBaseURL(),
			BASE_URLS.default.openapi,
			discovered,
		),
	};
}
