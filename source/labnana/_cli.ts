import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {type VideoCreateOptions, createVideo} from '../video/video.js';
import {
	type LabnanaImageCreateOptions,
	type LabnanaImageListOptions,
	createLabnanaImage,
	getLabnanaImage,
	listLabnanaImages,
} from './image.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

export function register(program: Command) {
	const cmd = program
		.command('labnana')
		.description('Labnana (labnana.com) image and video generation');

	const image = cmd.command('image').description('Labnana image generation');

	image
		.command('create')
		.description('Create Labnana image(s)')
		.requiredOption('--prompt <text>', 'Image description')
		.option('--model <model>', 'Model name')
		.option('--lang <lang>', 'Prompt language hint')
		.option('--aspect-ratio <ratio>', 'Aspect ratio', '1:1')
		.option('--size <size>', 'Image size: 1K, 2K, 4K', '2K')
		.option('--quality <quality>', 'Quality: low, medium, high')
		.option(
			'--reference <path-or-url>',
			'Reference image, local file or URL (repeatable, max 14)',
			collect,
			[],
		)
		.option(
			'-n, --n <count>',
			'Generate n images as one batch (parallel requests sharing a batchId, max 10)',
			Number,
			1,
		)
		.option('--public', 'Generate as public (subscription required)', false)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 120)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: LabnanaImageCreateOptions) => {
			try {
				const client = await getClient();
				await createLabnanaImage(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	image
		.command('list')
		.description('List Labnana images')
		.option('--page <n>', 'Page number', Number, 1)
		.option('--page-size <n>', 'Items per page', Number, 20)
		.option('--scope <scope>', 'me or public', 'me')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: LabnanaImageListOptions) => {
			try {
				const client = await getClient();
				await listLabnanaImages(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	image
		.command('get <id>')
		.description('Get Labnana image details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (id: string, options: {json: boolean}) => {
			try {
				const client = await getClient();
				await getLabnanaImage(client, id, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	const video = cmd.command('video').description('Labnana video generation');

	video
		.command('create')
		.description('Create a Labnana video generation task')
		.requiredOption('--prompt <text>', 'Video description')
		.option(
			'--model <model>',
			'Model: happyhorse, doubao-seedance-2-pro, doubao-seedance-2-fast',
			'happyhorse',
		)
		.option('--resolution <res>', 'Resolution: 480p, 720p, 1080p')
		.option('--ratio <ratio>', 'Aspect ratio: 16:9, 4:3, 1:1, 3:4, 9:16, 21:9, 4:5, 5:4')
		.option('--duration <seconds>', 'Video duration in seconds (3-15)', Number)
		.option('--first-frame <path-or-url>', 'First frame image')
		.option('--first-frame-meta <meta>', 'First frame metadata WIDTHxHEIGHT[:SIZE]')
		.option('--last-frame <path-or-url>', 'Last frame image (requires --first-frame)')
		.option('--last-frame-meta <meta>', 'Last frame metadata WIDTHxHEIGHT[:SIZE]')
		.option('--reference-image <path-or-url>', 'Reference image (repeatable, max 9)', collect, [])
		.option(
			'--reference-image-meta <meta>',
			'Reference image metadata WIDTHxHEIGHT[:SIZE] (repeatable, same order)',
			collect,
			[],
		)
		.option('--reference-video <path-or-url>', 'Reference video (repeatable, max 3)', collect, [])
		.option(
			'--reference-video-meta <meta>',
			'Reference video metadata WIDTHxHEIGHT[:DURATION[:FPS[:SIZE]]] (repeatable, same order)',
			collect,
			[],
		)
		.option('--reference-audio <path-or-url>', 'Reference audio (repeatable, max 3)', collect, [])
		.option(
			'--input-video-duration <seconds>',
			'Reference video duration (2-15, required with --reference-video)',
			Number,
		)
		.option('--no-generate-audio', 'Disable audio generation')
		.option('--audio-setting <mode>', 'Audio handling for video-edit: auto, origin')
		.option('--seed <number>', 'Random seed (-1 to 4294967295)', Number)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 1200)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoCreateOptions) => {
			try {
				const client = await getClient();
				await createVideo(client, options, 'labnana');
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
