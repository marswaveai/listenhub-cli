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
