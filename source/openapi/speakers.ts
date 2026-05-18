import type {Command} from 'commander';
import type {OpenAPIClient} from '@marswave/listenhub-sdk';
import {handleError, printJson, printTable} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';

async function listSpeakers(
	client: OpenAPIClient,
	options: {language?: string; json: boolean},
): Promise<void> {
	const {items} = await client.listSpeakers({
		language: options.language,
	});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['Name', 'ID', 'Gender', 'Language'];
	const rows = items.map((s) => [s.name, s.speakerId, s.gender, s.language]);
	printTable(headers, rows);
}

export function register(openapi: Command) {
	const speakers = openapi.command('speakers').description('Speaker management');

	speakers
		.command('list')
		.description('List available speakers')
		.option('--language <lang>', 'Filter by language')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {language?: string; json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				await listSpeakers(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
