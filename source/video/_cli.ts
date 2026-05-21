import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
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
		.option('--model <model>', 'Model: happyhorse, doubao-seedance-2-pro, doubao-seedance-2-fast', 'happyhorse')
		.option('--resolution <res>', 'Resolution: 480p, 720p, 1080p')
		.option('--ratio <ratio>', 'Aspect ratio: 16:9, 4:3, 1:1, 3:4, 9:16, 21:9, 4:5, 5:4')
		.option('--duration <seconds>', 'Video duration in seconds (3-15)', Number)
		.option('--first-frame <path-or-url>', 'First frame image')
		.option('--last-frame <path-or-url>', 'Last frame image (requires --first-frame)')
		.option('--reference-image <path-or-url>', 'Reference image (repeatable, max 9)', collect, [])
		.option('--reference-video <path-or-url>', 'Reference video (repeatable, max 3)', collect, [])
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
		.requiredOption('--model <model>', 'Model name')
		.requiredOption('--resolution <res>', 'Resolution')
		.requiredOption('--duration <seconds>', 'Duration (4-15)', Number)
		.option('--ratio <ratio>', 'Aspect ratio', '16:9')
		.option('--has-video-input', 'Has reference video input', false)
		.option('--input-video-duration <seconds>', 'Reference video duration', Number)
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
