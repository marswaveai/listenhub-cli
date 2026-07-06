import {OpenAPIClient} from '@marswave/listenhub-sdk';
import process from 'node:process';
import {loadOpenAPIConfig} from './config.js';

const DEFAULT_OPENAPI_BASE_URL = 'https://api.marswave.ai/openapi';

export async function getOpenAPIOptions(): Promise<{apiKey: string; baseURL: string}> {
	const envKey = process.env['LISTENHUB_API_KEY'];
	const baseURL = process.env['LISTENHUB_OPENAPI_URL'] || DEFAULT_OPENAPI_BASE_URL;
	if (envKey) {
		return {apiKey: envKey, baseURL};
	}

	const config = await loadOpenAPIConfig();
	if (config?.apiKey) {
		return {apiKey: config.apiKey, baseURL};
	}

	throw new Error(
		'No API Key configured. Set LISTENHUB_API_KEY env var or run `listenhub openapi config set-key`.',
	);
}

export async function getOpenAPIClient(): Promise<OpenAPIClient> {
	return new OpenAPIClient(await getOpenAPIOptions());
}
