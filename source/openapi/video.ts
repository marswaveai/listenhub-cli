import type {Command} from 'commander';
import type {
	OpenAPICreateVideoGenerationParams,
	OpenAPIVideoGenerationTaskDetail,
	OpenAPIVideoGenerationTaskStatus,
} from '@marswave/listenhub-sdk';
import {handleError, printDetail, printJson, printTable} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

type VideoCreateOptions = {
	prompt: string;
	firstFrame?: string;
	lastFrame?: string;
	referenceImage: string[];
	referenceVideo: string[];
	referenceAudio: string[];
	inputVideoDuration?: string;
	model?: string;
	resolution?: string;
	ratio?: string;
	duration?: string;
	generateAudio: boolean;
	seed?: string;
	wait: boolean;
	timeout: string;
	json: boolean;
};

type VideoGetOptions = {
	json: boolean;
};

type VideoListOptions = {
	page: string;
	pageSize: string;
	status?: string;
	json: boolean;
};

type VideoEstimateOptions = {
	model: string;
	resolution: string;
	duration: string;
	ratio?: string;
	hasVideoInput: boolean;
	inputVideoDuration?: string;
	json: boolean;
};

function printVideoDetail(result: OpenAPIVideoGenerationTaskDetail): void {
	printDetail('Video Generation Task', [
		['ID', result.id],
		['Status', result.status],
		['Model', result.model],
		['Resolution', result.resolution ?? result.params?.resolution],
		['Ratio', result.ratio ?? result.params?.ratio],
		['Duration', result.duration ?? result.params?.duration],
		['Seed', result.seed ?? result.params?.seed],
		['Credits', result.creditCharged],
		['Video URL', result.videoUrl],
		['Created', result.createdAt ? new Date(result.createdAt * 1000).toISOString() : undefined],
	]);
}

export function register(openapi: Command) {
	const video = openapi.command('video').description('AI video generation');

	video
		.command('create')
		.description('Create a video generation task')
		.requiredOption('--prompt <text>', 'Video description / prompt')
		.option('--first-frame <url>', 'First frame image URL')
		.option('--last-frame <url>', 'Last frame image URL (requires --first-frame)')
		.option(
			'--reference-image <url>',
			'Reference image URL (repeatable, max 9)',
			collect,
			[] as string[],
		)
		.option(
			'--reference-video <url>',
			'Reference video URL (repeatable, max 3)',
			collect,
			[] as string[],
		)
		.option(
			'--reference-audio <url>',
			'Reference audio URL (repeatable, max 3)',
			collect,
			[] as string[],
		)
		.option(
			'--input-video-duration <seconds>',
			'Input video duration in seconds (2-15, required with --reference-video)',
		)
		.option('--model <model>', 'Model name (e.g. doubao-seedance-2-pro)')
		.option('--resolution <res>', 'Output resolution: 480p, 720p, 1080p')
		.option('--ratio <ratio>', 'Aspect ratio: 16:9, 4:3, 1:1, 3:4, 9:16, 21:9')
		.option('--duration <seconds>', 'Video duration in seconds (4-15)')
		.option('--no-generate-audio', 'Disable audio generation')
		.option('--seed <number>', 'Random seed (-1 to 4294967295)')
		.option('--no-wait', 'Do not wait for task completion')
		.option('--timeout <seconds>', 'Polling timeout in seconds', '1200')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoCreateOptions) => {
			try {
				// Validation
				if (options.lastFrame && !options.firstFrame) {
					throw new Error('--last-frame requires --first-frame');
				}

				const hasFrameMode = Boolean(options.firstFrame) || Boolean(options.lastFrame);
				const hasReferenceMode =
					options.referenceImage.length > 0 ||
					options.referenceVideo.length > 0 ||
					options.referenceAudio.length > 0;

				if (hasFrameMode && hasReferenceMode) {
					throw new Error(
						'Cannot mix frame mode (--first-frame/--last-frame) with reference mode (--reference-image/--reference-video/--reference-audio)',
					);
				}

				if (options.referenceVideo.length > 0 && !options.inputVideoDuration) {
					throw new Error('--reference-video requires --input-video-duration');
				}

				if (options.inputVideoDuration && options.referenceVideo.length === 0) {
					throw new Error('--input-video-duration requires --reference-video');
				}

				if (
					options.referenceAudio.length > 0 &&
					options.referenceImage.length === 0 &&
					options.referenceVideo.length === 0
				) {
					throw new Error('--reference-audio requires --reference-image or --reference-video');
				}

				if (options.referenceImage.length > 9) {
					throw new Error('Maximum 9 reference images allowed');
				}

				if (options.referenceVideo.length > 3) {
					throw new Error('Maximum 3 reference videos allowed');
				}

				if (options.referenceAudio.length > 3) {
					throw new Error('Maximum 3 reference audios allowed');
				}

				if (options.duration !== undefined) {
					const dur = Number(options.duration);
					if (Number.isNaN(dur) || dur < 4 || dur > 15) {
						throw new Error('--duration must be between 4 and 15 seconds');
					}
				}

				if (options.seed !== undefined) {
					const seed = Number(options.seed);
					if (Number.isNaN(seed) || seed < -1 || seed > 4_294_967_295) {
						throw new Error('--seed must be between -1 and 4294967295');
					}
				}

				if (options.inputVideoDuration !== undefined) {
					const ivd = Number(options.inputVideoDuration);
					if (Number.isNaN(ivd) || ivd < 2 || ivd > 15) {
						throw new Error('--input-video-duration must be between 2 and 15 seconds');
					}
				}

				// Build content array
				const content: OpenAPICreateVideoGenerationParams['content'] = [
					{type: 'text', text: options.prompt},
				];

				if (options.firstFrame) {
					content.push({
						type: 'image_url',
						image_url: {url: options.firstFrame},
						role: 'first_frame',
					});
				}

				if (options.lastFrame) {
					content.push({
						type: 'image_url',
						image_url: {url: options.lastFrame},
						role: 'last_frame',
					});
				}

				for (const url of options.referenceImage) {
					content.push({type: 'image_url', image_url: {url}, role: 'reference_image'});
				}

				for (const url of options.referenceVideo) {
					content.push({type: 'video_url', video_url: {url}, role: 'reference_video'});
				}

				for (const url of options.referenceAudio) {
					content.push({type: 'audio_url', audio_url: {url}, role: 'reference_audio'});
				}

				const params: OpenAPICreateVideoGenerationParams = {
					content,
					model: options.model as OpenAPICreateVideoGenerationParams['model'],
					resolution: options.resolution as OpenAPICreateVideoGenerationParams['resolution'],
					ratio: options.ratio as OpenAPICreateVideoGenerationParams['ratio'],
					duration: options.duration === undefined ? undefined : Number(options.duration),
					generateAudio: options.generateAudio === false ? false : undefined,
					seed: options.seed === undefined ? undefined : Number(options.seed),
					inputVideoDuration:
						options.inputVideoDuration === undefined
							? undefined
							: Number(options.inputVideoDuration),
				};

				const client = await getOpenAPIClient();
				const {taskId} = await client.createVideoGeneration(params);

				if (!options.wait) {
					if (options.json) {
						printJson({taskId});
					} else {
						console.log(`✓ Video generation task created: ${taskId}`);
					}

					return;
				}

				const result = await pollOpenAPI<OpenAPIVideoGenerationTaskDetail>({
					getStatus: async () => client.getVideoGenerationTask(taskId),
					isDone: (r) => r.status === 'success',
					isFailed: (r) => r.status === 'failed',
					getErrorMessage: () => 'Video generation failed',
					options: {
						timeout: Number(options.timeout),
						label: 'Generating video',
						json: options.json,
					},
				});

				if (options.json) {
					printJson(result);
				} else {
					printVideoDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	video
		.command('get <taskId>')
		.description('Get video generation task details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: VideoGetOptions) => {
			try {
				const client = await getOpenAPIClient();
				const result = await client.getVideoGenerationTask(taskId);

				if (options.json) {
					printJson(result);
				} else {
					printVideoDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	video
		.command('list')
		.description('List video generation tasks')
		.option('--page <n>', 'Page number', '1')
		.option('--page-size <n>', 'Items per page', '20')
		.option(
			'--status <status>',
			'Filter by status: pending, generating, uploading, success, failed',
		)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoListOptions) => {
			try {
				const client = await getOpenAPIClient();
				const result = await client.listVideoGenerationTasks({
					page: Number(options.page),
					pageSize: Number(options.pageSize),
					status: options.status as OpenAPIVideoGenerationTaskStatus | undefined,
				});

				if (options.json) {
					printJson(result);
					return;
				}

				if (result.items.length === 0) {
					console.log('No video generation tasks found.');
					return;
				}

				printTable(
					['ID', 'Model', 'Status', 'Duration', 'Created'],
					result.items.map((item) => [
						item.id,
						item.model,
						item.status,
						String(item.params.duration),
						new Date(item.createdAt * 1000).toISOString(),
					]),
				);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	video
		.command('estimate')
		.description('Estimate credits for video generation')
		.requiredOption('--model <model>', 'Model name (e.g. doubao-seedance-2-pro)')
		.requiredOption('--resolution <res>', 'Output resolution: 480p, 720p, 1080p')
		.requiredOption('--duration <seconds>', 'Video duration in seconds', Number)
		.option('--ratio <ratio>', 'Aspect ratio: 16:9, 4:3, 1:1, 3:4, 9:16, 21:9')
		.option('--has-video-input', 'Whether input video is provided', false)
		.option('--input-video-duration <seconds>', 'Input video duration in seconds', Number)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoEstimateOptions) => {
			try {
				if (options.hasVideoInput && options.inputVideoDuration === undefined) {
					throw new Error('--has-video-input requires --input-video-duration');
				}

				const client = await getOpenAPIClient();
				const result = await client.estimateVideoCredits({
					model: options.model as OpenAPICreateVideoGenerationParams['model'] extends infer M
						? NonNullable<M>
						: never,
					resolution: options.resolution as '480p' | '720p' | '1080p',
					duration: Number(options.duration),
					ratio: options.ratio as OpenAPICreateVideoGenerationParams['ratio'],
					hasVideoInput: options.hasVideoInput || undefined,
					inputVideoDuration:
						options.inputVideoDuration === undefined
							? undefined
							: Number(options.inputVideoDuration),
				});

				if (options.json) {
					printJson(result);
				} else {
					printDetail('Credit Estimate', [
						['Tokens', result.tokens],
						['Credits', result.credits],
					]);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
