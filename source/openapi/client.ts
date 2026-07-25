import {OpenAPIClient} from '@marswave/listenhub-sdk';
import process from 'node:process';
import {resolveOpenAPIBaseURL} from '../_shared/domain.js';
import {loadOpenAPIConfig} from './config.js';

export async function getOpenAPIOptions(): Promise<{apiKey: string; baseURL?: string}> {
	const envKey = process.env['LISTENHUB_API_KEY'];
	// 只在用户钉死了域时才传 baseURL。传了 SDK 就完全按它发，自动选域会被关掉。
	const baseURL = resolveOpenAPIBaseURL();
	if (envKey) {
		return {apiKey: envKey, ...(baseURL ? {baseURL} : {})};
	}

	const config = await loadOpenAPIConfig();
	if (config?.apiKey) {
		return {apiKey: config.apiKey, ...(baseURL ? {baseURL} : {})};
	}

	throw new Error(
		'No API Key configured. Set LISTENHUB_API_KEY env var or run `listenhub openapi config set-key`.',
	);
}

export async function getOpenAPIClient(): Promise<OpenAPIClient> {
	return new OpenAPIClient(await getOpenAPIOptions());
}
