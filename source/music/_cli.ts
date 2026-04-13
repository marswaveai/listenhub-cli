import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {
	type MusicCoverOptions,
	type MusicExtendOptions,
	type MusicGenerateOptions,
	type MusicListOptions,
	createCover,
	createExtend,
	createGenerate,
	getTask,
	listTasks,
} from './music.js';

export function register(program: Command) {
	const cmd = program.command('music').description('Music generation');

	cmd
		.command('generate')
		.description('Generate music from a text prompt')
		.requiredOption('--prompt <text>', 'Music description')
		.option('--style <text>', 'Music style/mood')
		.option('--title <text>', 'Track title')
		.option('--instrumental', 'Instrumental only, no vocals', false)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicGenerateOptions) => {
			try {
				const client = await getClient();
				await createGenerate(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('cover')
		.description('Create a cover from reference audio')
		.requiredOption('--audio <path-or-url>', 'Reference audio file or URL')
		.option('--prompt <text>', 'Music description')
		.option('--style <text>', 'Music style/mood')
		.option('--title <text>', 'Track title')
		.option('--instrumental', 'Instrumental only, no vocals', false)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicCoverOptions) => {
			try {
				const client = await getClient();
				await createCover(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('extend')
		.description('Extend music from reference audio')
		.requiredOption('--audio <path-or-url>', 'Reference audio file or URL')
		.requiredOption(
			'--model <version>',
			'Model version (V4, V4_5, V4_5PLUS, V4_5ALL, V5, V5_5)',
		)
		.requiredOption(
			'--continue-at <seconds>',
			'Start extending from this time point',
			Number,
		)
		.option('--prompt <text>', 'Lyrics or description')
		.option('--style <text>', 'Music style/mood')
		.option('--title <text>', 'Track title')
		.option('--instrumental', 'Instrumental only, no vocals', false)
		.option('--negative-tags <text>', 'Styles to exclude')
		.option('--vocal-gender <gender>', 'Vocal gender (m or f)')
		.option('--style-weight <weight>', 'Style guidance weight (0-1)', Number)
		.option(
			'--weirdness <weight>',
			'Creativity/weirdness constraint (0-1)',
			Number,
		)
		.option(
			'--audio-weight <weight>',
			'Input audio influence weight (0-1)',
			Number,
		)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicExtendOptions) => {
			try {
				const client = await getClient();
				await createExtend(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('list')
		.description('List music tasks')
		.option('--page <n>', 'Page number', Number, 1)
		.option('--page-size <n>', 'Items per page', Number, 20)
		.option(
			'--status <status>',
			'Filter by status (pending, generating, uploading, success, failed)',
		)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicListOptions) => {
			try {
				const client = await getClient();
				await listTasks(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('get <taskId>')
		.description('Get music task details')
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
