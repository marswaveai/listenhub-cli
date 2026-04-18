import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {listSpeakers} from './speakers.js';

export function register(program: Command) {
	const cmd = program.command('speakers').description('Manage speakers');

	cmd
		.command('list')
		.description('List available speakers')
		.option('--lang <lang>', 'Filter by language (en, zh, ja)')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {lang?: string; json: boolean}) => {
			try {
				const client = await getClient();
				await listSpeakers(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
