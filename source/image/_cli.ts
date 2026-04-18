import {type Command, Option} from 'commander';
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
			'--reference <path-or-url>',
			'Reference image, local file or URL (repeatable, max 5)',
			collect,
			[],
		)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 120)
		.option('-j, --json', 'Output JSON', false)
		.addOption(
			new Option('--reference-url <url>', '')
				.hideHelp()
				.argParser((value: string, previous: string[]) => [...previous, value])
				.default([]),
		)
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
