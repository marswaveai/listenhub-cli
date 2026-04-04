import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {
	type ImageCreateOptions,
	type ImageListOptions,
	createImage,
	getImage,
	listImages,
} from './image.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

export function register(program: Command) {
	const cmd = program.command('image').description('AI image generation');

	cmd
		.command('create')
		.description('Create an AI image')
		.requiredOption('--prompt <text>', 'Image description')
		.option('--model <model>', 'Model name')
		.option('--lang <lang>', 'Prompt language hint')
		.option('--aspect-ratio <ratio>', 'Aspect ratio', '1:1')
		.option('--size <size>', 'Image size: 1K, 2K, 4K', '2K')
		.option(
			'--reference-url <url>',
			'Reference image URL (repeatable)',
			collect,
			[],
		)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 120)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: ImageCreateOptions) => {
			try {
				const client = await getClient();
				await createImage(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('list')
		.description('List AI images')
		.option('--page <n>', 'Page number', Number, 1)
		.option('--page-size <n>', 'Items per page', Number, 20)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: ImageListOptions) => {
			try {
				const client = await getClient();
				await listImages(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('get <id>')
		.description('Get image details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (id: string, options: {json: boolean}) => {
			try {
				const client = await getClient();
				await getImage(client, id, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
