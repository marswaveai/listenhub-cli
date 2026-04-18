import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {
	type LyricsGenerateOptions,
	type LyricsListOptions,
	createGenerate,
	getTask,
	listTasks,
} from './lyrics.js';

export function register(program: Command) {
	const cmd = program.command('lyrics').description('Lyrics generation');

	cmd
		.command('generate')
		.description('Generate lyrics from a text prompt')
		.requiredOption('--prompt <text>', 'Lyrics description (max 200 chars)')
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 120)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: LyricsGenerateOptions) => {
			try {
				const client = await getClient();
				await createGenerate(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('list')
		.description('List lyrics tasks')
		.option('--page <n>', 'Page number', Number, 1)
		.option('--page-size <n>', 'Items per page', Number, 20)
		.option('--status <status>', 'Filter by status (pending, generating, success, failed)')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: LyricsListOptions) => {
			try {
				const client = await getClient();
				await listTasks(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('get <taskId>')
		.description('Get lyrics task details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: {json: boolean}) => {
			try {
				const client = await getClient();
				await getTask(client, taskId, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
