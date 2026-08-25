import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {VIDEO_MODEL_HELP, VIDEO_RESOLUTION_HELP} from '../_shared/video-model-limits.js';
import {
	type VideoCreateOptions,
	type VideoEstimateOptions,
	type VideoListOptions,
	createVideo,
	estimateCredits,
	getVideo,
	listVideos,
} from './video.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

export function register(program: Command) {
	const cmd = program.command('video').description('SeeDance video generation');

	cmd
		.command('create')
		.description('Create a video generation task')
		.requiredOption('--prompt <text>', 'Video description')
		.option('--model <model>', VIDEO_MODEL_HELP, 'happyhorse')
		.option('--resolution <res>', VIDEO_RESOLUTION_HELP)
		.option('--ratio <ratio>', 'Aspect ratio: 16:9, 4:3, 1:1, 3:4, 9:16, 21:9, 4:5, 5:4')
		.option('--duration <seconds>', 'Video duration in seconds (range depends on --model)', Number)
		.option('--first-frame <path-or-url>', 'First frame image')
		.option('--first-frame-meta <meta>', 'First frame metadata WIDTHxHEIGHT[:SIZE]')
		.option('--last-frame <path-or-url>', 'Last frame image (requires --first-frame)')
		.option('--last-frame-meta <meta>', 'Last frame metadata WIDTHxHEIGHT[:SIZE]')
		.option(
			'--reference-image <path-or-url>',
			'Reference image (repeatable; max depends on --model)',
			collect,
			[],
		)
		.option(
			'--reference-image-meta <meta>',
			'Reference image metadata WIDTHxHEIGHT[:SIZE] (repeatable, same order)',
			collect,
			[],
		)
		.option(
			'--reference-video <path-or-url>',
			'Reference video (repeatable; max depends on --model)',
			collect,
			[],
		)
		.option(
			'--reference-video-meta <meta>',
			'Reference video metadata WIDTHxHEIGHT[:DURATION[:FPS[:SIZE]]] (repeatable, same order)',
			collect,
			[],
		)
		.option(
			'--reference-audio <path-or-url>',
			'Reference audio (repeatable; max depends on --model)',
			collect,
			[],
		)
		.option(
			'--input-video-duration <seconds>',
			'Reference video duration (range depends on --model; required with --reference-video)',
			Number,
		)
		.option('--no-generate-audio', 'Disable audio generation (ignored by MiniMax-H3)')
		.option('--audio-setting <mode>', 'Audio handling for video-edit: auto, origin')
		.option('--seed <number>', 'Random seed (-1 to 4294967295; ignored by MiniMax-H3)', Number)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 1200)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoCreateOptions) => {
			try {
				const client = await getClient();
				await createVideo(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('get <taskId>')
		.description('Get video task details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: {json: boolean}) => {
			try {
				const client = await getClient();
				await getVideo(client, taskId, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('list')
		.description('List video generation tasks')
		.option('--page <n>', 'Page number', Number, 1)
		.option('--page-size <n>', 'Items per page', Number, 20)
		.option('--status <status>', 'Filter: pending, generating, uploading, success, failed')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoListOptions) => {
			try {
				const client = await getClient();
				await listVideos(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('estimate')
		.description('Estimate credit cost')
		.requiredOption('--model <model>', VIDEO_MODEL_HELP)
		.requiredOption('--resolution <res>', VIDEO_RESOLUTION_HELP)
		.requiredOption(
			'--duration <seconds>',
			'Duration in seconds (range depends on --model)',
			Number,
		)
		.option('--ratio <ratio>', 'Aspect ratio', '16:9')
		.option('--has-video-input', 'Has reference video input', false)
		.option('--input-video-duration <seconds>', 'Reference video duration', Number)
		.option(
			'--reference-image-meta <meta>',
			'Reference image metadata WIDTHxHEIGHT[:SIZE] for estimate',
			collect,
			[],
		)
		.option(
			'--reference-video-meta <meta>',
			'Reference video metadata WIDTHxHEIGHT[:DURATION[:FPS[:SIZE]]] for estimate',
			collect,
			[],
		)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoEstimateOptions) => {
			try {
				const client = await getClient();
				await estimateCredits(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
