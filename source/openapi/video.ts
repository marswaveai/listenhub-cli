import path from 'node:path';
import type {Command} from 'commander';
import type {
	OpenAPICreatePixVerseVideoParams,
	OpenAPICreateVideoGenerationParams,
	OpenAPIEstimatePixVerseCreditsParams,
	OpenAPIEstimateVideoCreditsParams,
	OpenAPIPixVerseAsset,
	OpenAPIPixVerseOptions,
	OpenAPIVideoGenerationTaskDetail,
	OpenAPIVideoGenerationTaskStatus,
} from '@marswave/listenhub-sdk';
import {handleError, printDetail, printJson, printTable} from '../_shared/output.js';
import {readLocalImageMeta} from '../_shared/image-dimensions.js';
import {resolveFileOrUrl} from '../_shared/upload.js';
import {normalizeVideoTaskId} from '../_shared/video-task-id.js';
import {
	isSeedanceVideoModel,
	parseImageMeta,
	parseVideoMeta,
	type VideoReferenceImageMeta,
	type VideoReferenceVideoMeta,
} from '../_shared/video-reference-metadata.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

const pixVerseCapabilities = [
	'text_to_video',
	'image_to_video',
	'transition',
	'multi_transition',
	'fusion',
	'restyle',
	'mimic',
	'lip_sync',
	'agent',
] as const;

const pixVerseModels = ['pixverse', 'v6', 'v5', 'v4.5'] as const;
const pixVerseLanguages = ['zh', 'en'] as const;
const pixVerseQualities = ['360p', '540p', '720p', '1080p'] as const;
const pixVerseAspectRatios = ['9:16', '16:9', '1:1', '4:3', '3:4'] as const;
const pixVerseAgentTypes = ['ad_master', 'promo_mix'] as const;

/**
 * Parse an asset spec of the form `url` or `url:duration` (duration in seconds).
 * The URL may itself contain colons (e.g. https://...), so only a trailing
 * `:<integer>` is treated as the duration.
 */
function parsePixVerseAsset(spec: string): OpenAPIPixVerseAsset {
	const trimmed = spec.trim();
	const match = /^(.*?):(\d+)$/.exec(trimmed);
	const url = match?.[1];
	const durationText = match?.[2];
	if (url !== undefined && durationText !== undefined && /^https?:\/\//.test(url)) {
		return {url, duration: Number(durationText)};
	}

	return {url: trimmed};
}

function ensureEnum<T extends string>(
	value: string | undefined,
	allowed: readonly T[],
	flag: string,
): T | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!allowed.includes(value as T)) {
		throw new Error(`${flag} must be one of: ${allowed.join(', ')}`);
	}

	return value as T;
}

type PixVerseGenerateOptions = {
	capability: string;
	model?: string;
	language?: string;
	prompt?: string;
	quality?: string;
	aspectRatio?: string;
	duration?: string;
	sourceTaskId?: string;
	image: string[];
	video: string[];
	audio: string[];
	agentType?: string;
	sourceVideoId?: string;
	restyleId?: string;
	lipSyncTts?: boolean;
	lipSyncSpeakerId?: string;
	lipSyncContent?: string;
	pixverseJson?: string;
	wait: boolean;
	timeout: string;
	json: boolean;
};

type PixVerseEstimateOptions = {
	capability: string;
	model?: string;
	language?: string;
	quality?: string;
	duration?: string;
	agentType?: string;
	json: boolean;
};

type VideoCreateOptions = {
	prompt: string;
	firstFrame?: string;
	firstFrameMeta?: string;
	lastFrame?: string;
	lastFrameMeta?: string;
	referenceImage: string[];
	referenceImageMeta: string[];
	referenceVideo: string[];
	referenceVideoMeta: string[];
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

type OpenAPIVideoGenerationParamsWithMetadata = OpenAPICreateVideoGenerationParams & {
	referenceImages?: VideoReferenceImageMeta[];
	referenceVideos?: VideoReferenceVideoMeta[];
};

type OpenAPIEstimateVideoCreditsParamsWithMetadata = OpenAPIEstimateVideoCreditsParams & {
	referenceImages?: VideoReferenceImageMeta[];
	referenceVideos?: VideoReferenceVideoMeta[];
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
	referenceImageMeta: string[];
	referenceVideoMeta: string[];
	json: boolean;
};

function isHttpUrl(value: string): boolean {
	return value.startsWith('http://') || value.startsWith('https://');
}

async function getReferenceImages(
	options: VideoCreateOptions,
	defaultModel: string,
): Promise<VideoReferenceImageMeta[]> {
	const images: VideoReferenceImageMeta[] = [];
	const inferLocalImages = isSeedanceVideoModel(options.model, defaultModel);

	if (options.firstFrameMeta !== undefined) {
		images.push(parseImageMeta(options.firstFrameMeta, 'first_frame'));
	} else if (
		inferLocalImages &&
		options.firstFrame !== undefined &&
		!isHttpUrl(options.firstFrame)
	) {
		images.push(await readLocalImageMeta(path.resolve(options.firstFrame.trim()), 'first_frame'));
	}

	if (options.lastFrameMeta !== undefined) {
		images.push(parseImageMeta(options.lastFrameMeta, 'last_frame'));
	} else if (inferLocalImages && options.lastFrame !== undefined && !isHttpUrl(options.lastFrame)) {
		images.push(await readLocalImageMeta(path.resolve(options.lastFrame.trim()), 'last_frame'));
	}

	const referenceImages = await Promise.all(
		options.referenceImage.map(async (ref, index) => {
			const meta = options.referenceImageMeta[index];
			if (meta !== undefined) return parseImageMeta(meta, 'reference_image');
			if (inferLocalImages && !isHttpUrl(ref)) {
				return readLocalImageMeta(path.resolve(ref.trim()), 'reference_image');
			}

			return undefined;
		}),
	);
	images.push(
		...referenceImages.filter((image): image is VideoReferenceImageMeta => image !== undefined),
	);

	return images;
}

function getReferenceVideos(options: VideoCreateOptions): VideoReferenceVideoMeta[] {
	return options.referenceVideoMeta.map(parseVideoMeta);
}

function validateReferenceMetadata(options: VideoCreateOptions): void {
	if (options.firstFrameMeta !== undefined && options.firstFrame === undefined) {
		throw new Error('--first-frame-meta requires --first-frame');
	}
	if (options.lastFrameMeta !== undefined && options.lastFrame === undefined) {
		throw new Error('--last-frame-meta requires --last-frame');
	}
	if (
		options.referenceImageMeta.length > 0 &&
		options.referenceImageMeta.length > options.referenceImage.length
	) {
		throw new Error('--reference-image-meta count cannot exceed --reference-image count');
	}
	if (
		options.referenceVideoMeta.length > 0 &&
		options.referenceVideoMeta.length !== options.referenceVideo.length
	) {
		throw new Error('--reference-video-meta count must match --reference-video count');
	}

	if (!isSeedanceVideoModel(options.model, 'doubao-seedance-2-fast')) {
		return;
	}

	if (
		options.firstFrame !== undefined &&
		options.firstFrameMeta === undefined &&
		isHttpUrl(options.firstFrame)
	) {
		throw new Error('Seedance --first-frame requires --first-frame-meta WIDTHxHEIGHT[:SIZE]');
	}
	if (
		options.lastFrame !== undefined &&
		options.lastFrameMeta === undefined &&
		isHttpUrl(options.lastFrame)
	) {
		throw new Error('Seedance --last-frame requires --last-frame-meta WIDTHxHEIGHT[:SIZE]');
	}
	if (
		options.referenceImage.some(
			(ref, index) => options.referenceImageMeta[index] === undefined && isHttpUrl(ref),
		)
	) {
		throw new Error('Seedance URL --reference-image requires one --reference-image-meta per image');
	}
	if (
		options.referenceVideo.length > 0 &&
		options.referenceVideoMeta.length !== options.referenceVideo.length
	) {
		throw new Error('Seedance --reference-video requires one --reference-video-meta per video');
	}
}

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
		.option('--first-frame <path-or-url>', 'First frame image')
		.option('--first-frame-meta <meta>', 'First frame metadata WIDTHxHEIGHT[:SIZE]')
		.option('--last-frame <path-or-url>', 'Last frame image (requires --first-frame)')
		.option('--last-frame-meta <meta>', 'Last frame metadata WIDTHxHEIGHT[:SIZE]')
		.option(
			'--reference-image <path-or-url>',
			'Reference image (repeatable, max 9)',
			collect,
			[] as string[],
		)
		.option(
			'--reference-image-meta <meta>',
			'Reference image metadata WIDTHxHEIGHT[:SIZE] (repeatable, same order)',
			collect,
			[] as string[],
		)
		.option(
			'--reference-video <path-or-url>',
			'Reference video (repeatable, max 3)',
			collect,
			[] as string[],
		)
		.option(
			'--reference-video-meta <meta>',
			'Reference video metadata WIDTHxHEIGHT[:DURATION[:FPS[:SIZE]]] (repeatable, same order)',
			collect,
			[] as string[],
		)
		.option(
			'--reference-audio <path-or-url>',
			'Reference audio (repeatable, max 3)',
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
				validateReferenceMetadata(options);

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

				const client = await getOpenAPIClient();

				// Build content array
				const content: OpenAPICreateVideoGenerationParams['content'] = [
					{type: 'text', text: options.prompt},
				];

				if (options.firstFrame) {
					const url = await resolveFileOrUrl(client, options.firstFrame, {
						accept: 'image',
						category: 'episode',
					});
					content.push({
						type: 'image_url',
						image_url: {url},
						role: 'first_frame',
					});
				}

				if (options.lastFrame) {
					const url = await resolveFileOrUrl(client, options.lastFrame, {
						accept: 'image',
						category: 'episode',
					});
					content.push({
						type: 'image_url',
						image_url: {url},
						role: 'last_frame',
					});
				}

				for (const ref of options.referenceImage) {
					const url = await resolveFileOrUrl(client, ref, {
						accept: 'image',
						category: 'episode',
					}); // eslint-disable-line no-await-in-loop
					content.push({type: 'image_url', image_url: {url}, role: 'reference_image'});
				}

				for (const ref of options.referenceVideo) {
					const url = await resolveFileOrUrl(client, ref, {
						accept: 'video',
						category: 'episode',
					}); // eslint-disable-line no-await-in-loop
					content.push({type: 'video_url', video_url: {url}, role: 'reference_video'});
				}

				for (const ref of options.referenceAudio) {
					const url = await resolveFileOrUrl(client, ref, {
						accept: 'audio',
						category: 'episode',
					}); // eslint-disable-line no-await-in-loop
					content.push({type: 'audio_url', audio_url: {url}, role: 'reference_audio'});
				}

				const referenceImages = await getReferenceImages(options, 'doubao-seedance-2-fast');
				const referenceVideos = getReferenceVideos(options);
				const params: OpenAPIVideoGenerationParamsWithMetadata = {
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
					...(referenceImages.length > 0 && {referenceImages}),
					...(referenceVideos.length > 0 && {referenceVideos}),
				};

				const {taskId: rawTaskId} = await client.createVideoGeneration(params);
				const taskId = normalizeVideoTaskId(rawTaskId);

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
				const result = await client.getVideoGenerationTask(normalizeVideoTaskId(taskId));

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
		.option(
			'--reference-image-meta <meta>',
			'Reference image metadata WIDTHxHEIGHT[:SIZE] for estimate',
			collect,
			[] as string[],
		)
		.option(
			'--reference-video-meta <meta>',
			'Reference video metadata WIDTHxHEIGHT[:DURATION[:FPS[:SIZE]]] for estimate',
			collect,
			[] as string[],
		)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VideoEstimateOptions) => {
			try {
				if (options.hasVideoInput && options.inputVideoDuration === undefined) {
					throw new Error('--has-video-input requires --input-video-duration');
				}

				const client = await getOpenAPIClient();
				const referenceImages = options.referenceImageMeta.map((meta) =>
					parseImageMeta(meta, 'reference_image'),
				);
				const referenceVideos = options.referenceVideoMeta.map(parseVideoMeta);
				const params: OpenAPIEstimateVideoCreditsParamsWithMetadata = {
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
					...(referenceImages.length > 0 && {referenceImages}),
					...(referenceVideos.length > 0 && {referenceVideos}),
				};
				const result = await client.estimateVideoCredits(params);

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

	registerPixVerse(video);
}

function registerPixVerse(video: Command) {
	const pixverse = video
		.command('pixverse')
		.description('PixVerse video generation (Agent API: atomic capabilities + marketing agent)');

	pixverse
		.command('generate')
		.description('Create a PixVerse video generation task')
		.requiredOption('--capability <capability>', `Capability: ${pixVerseCapabilities.join(', ')}`)
		.option('--model <model>', `Model: ${pixVerseModels.join(', ')} (default pixverse)`)
		.option('--language <lang>', `Service region: ${pixVerseLanguages.join(', ')} (default en)`)
		.option('--prompt <text>', 'Video description / prompt (max 2048 chars)')
		.option('--quality <quality>', `Quality: ${pixVerseQualities.join(', ')} (default 720p)`)
		.option(
			'--aspect-ratio <ratio>',
			`Aspect ratio: ${pixVerseAspectRatios.join(', ')} (default 16:9)`,
		)
		.option('--duration <seconds>', 'Video duration in seconds (1-60, default 5)')
		.option('--source-task-id <id>', 'Reuse a prior succeeded PixVerse task (restyle / lip_sync)')
		.option(
			'--image <url[:duration]>',
			'Image asset URL, optional :duration suffix (repeatable, max 10)',
			collect,
			[] as string[],
		)
		.option(
			'--video <url[:duration]>',
			'Video asset URL, optional :duration suffix (repeatable, max 2)',
			collect,
			[] as string[],
		)
		.option(
			'--audio <url[:duration]>',
			'Audio asset URL, optional :duration suffix (repeatable, max 1)',
			collect,
			[] as string[],
		)
		.option(
			'--agent-type <type>',
			`Agent type: ${pixVerseAgentTypes.join(', ')} (capability=agent)`,
		)
		.option('--source-video-id <id>', 'PixVerse source video id (restyle)')
		.option('--restyle-id <id>', 'PixVerse restyle id (restyle)')
		.option('--lip-sync-tts', 'Enable lip-sync TTS (capability=lip_sync)')
		.option('--lip-sync-speaker-id <id>', 'Lip-sync TTS speaker id')
		.option('--lip-sync-content <text>', 'Lip-sync TTS content')
		.option(
			'--pixverse-json <json>',
			'Escape hatch: JSON for the nested pixverse object (merged with flag-derived fields; flags win)',
		)
		.option('--no-wait', 'Do not wait for task completion')
		.option('--timeout <seconds>', 'Polling timeout in seconds', '1200')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: PixVerseGenerateOptions) => {
			try {
				const capability = ensureEnum(options.capability, pixVerseCapabilities, '--capability')!;

				if (options.image.length > 10) {
					throw new Error('Maximum 10 images allowed');
				}

				if (options.video.length > 2) {
					throw new Error('Maximum 2 videos allowed');
				}

				if (options.audio.length > 1) {
					throw new Error('Maximum 1 audio allowed');
				}

				if (options.duration !== undefined) {
					const dur = Number(options.duration);
					if (!Number.isInteger(dur) || dur < 1 || dur > 60) {
						throw new Error('--duration must be an integer between 1 and 60');
					}
				}

				// Build nested pixverse object from the escape hatch first, then let
				// dedicated flags override individual fields.
				let pixVerseOptions: OpenAPIPixVerseOptions = {};
				if (options.pixverseJson) {
					try {
						pixVerseOptions = JSON.parse(options.pixverseJson) as OpenAPIPixVerseOptions;
					} catch {
						throw new Error('--pixverse-json must be valid JSON');
					}
				}

				const agentType = ensureEnum(options.agentType, pixVerseAgentTypes, '--agent-type');
				if (agentType !== undefined) {
					pixVerseOptions.agentType = agentType;
				}

				if (options.sourceVideoId !== undefined) {
					pixVerseOptions.sourceVideoId = options.sourceVideoId;
				}

				if (options.restyleId !== undefined) {
					pixVerseOptions.restyleId = options.restyleId;
				}

				if (options.lipSyncTts) {
					pixVerseOptions.lipSyncTtsSwitch = true;
				}

				if (options.lipSyncSpeakerId !== undefined) {
					pixVerseOptions.lipSyncTtsSpeakerId = options.lipSyncSpeakerId;
				}

				if (options.lipSyncContent !== undefined) {
					pixVerseOptions.lipSyncTtsContent = options.lipSyncContent;
				}

				// lip_sync TTS: the server validator gates on the nested `tts`
				// object while the provider reads the lipSyncTts* fields. Populate
				// both from the --lip-sync-* flags so the TTS path passes validation
				// end to end (skip if --pixverse-json already provided a tts object).
				if (
					capability === 'lip_sync' &&
					!pixVerseOptions.tts &&
					options.lipSyncSpeakerId !== undefined &&
					options.lipSyncContent !== undefined
				) {
					pixVerseOptions.tts = {
						speakerId: options.lipSyncSpeakerId,
						content: options.lipSyncContent,
					};
				}

				const params: OpenAPICreatePixVerseVideoParams = {
					capability,
					model: ensureEnum(options.model, pixVerseModels, '--model'),
					language: ensureEnum(options.language, pixVerseLanguages, '--language'),
					prompt: options.prompt,
					quality: ensureEnum(options.quality, pixVerseQualities, '--quality'),
					aspectRatio: ensureEnum(options.aspectRatio, pixVerseAspectRatios, '--aspect-ratio'),
					duration: options.duration === undefined ? undefined : Number(options.duration),
					sourceTaskId: options.sourceTaskId,
					images: options.image.length > 0 ? options.image.map(parsePixVerseAsset) : undefined,
					videos: options.video.length > 0 ? options.video.map(parsePixVerseAsset) : undefined,
					audios: options.audio.length > 0 ? options.audio.map(parsePixVerseAsset) : undefined,
					pixverse: Object.keys(pixVerseOptions).length > 0 ? pixVerseOptions : undefined,
				};

				const client = await getOpenAPIClient();
				const created = await client.createPixVerseVideoGeneration(params);
				const taskId = normalizeVideoTaskId(created.taskId);

				if (!options.wait) {
					if (options.json) {
						printJson(created);
					} else {
						console.log(`\u2713 PixVerse video generation task created: ${taskId}`);
					}

					return;
				}

				const result = await pollOpenAPI<OpenAPIVideoGenerationTaskDetail>({
					getStatus: async () => client.getVideoGenerationTask(taskId),
					isDone: (r) => r.status === 'success',
					isFailed: (r) => r.status === 'failed',
					getErrorMessage: () => 'PixVerse video generation failed',
					options: {
						timeout: Number(options.timeout),
						label: 'Generating PixVerse video',
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

	pixverse
		.command('estimate')
		.description('Estimate credits for a PixVerse video generation task')
		.requiredOption('--capability <capability>', `Capability: ${pixVerseCapabilities.join(', ')}`)
		.option('--model <model>', `Model: ${pixVerseModels.join(', ')} (default pixverse)`)
		.option('--language <lang>', `Service region: ${pixVerseLanguages.join(', ')} (default en)`)
		.option('--quality <quality>', `Quality: ${pixVerseQualities.join(', ')} (default 720p)`)
		.option('--duration <seconds>', 'Video duration in seconds (1-60, default 5)')
		.option(
			'--agent-type <type>',
			`Agent type: ${pixVerseAgentTypes.join(', ')} (capability=agent)`,
		)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: PixVerseEstimateOptions) => {
			try {
				const capability = ensureEnum(options.capability, pixVerseCapabilities, '--capability')!;

				if (options.duration !== undefined) {
					const dur = Number(options.duration);
					if (!Number.isInteger(dur) || dur < 1 || dur > 60) {
						throw new Error('--duration must be an integer between 1 and 60');
					}
				}

				const agentType = ensureEnum(options.agentType, pixVerseAgentTypes, '--agent-type');

				const params: OpenAPIEstimatePixVerseCreditsParams = {
					capability,
					model: ensureEnum(options.model, pixVerseModels, '--model'),
					language: ensureEnum(options.language, pixVerseLanguages, '--language'),
					quality: ensureEnum(options.quality, pixVerseQualities, '--quality'),
					duration: options.duration === undefined ? undefined : Number(options.duration),
					pixverse: agentType === undefined ? undefined : {agentType},
				};

				const client = await getOpenAPIClient();
				const result = await client.estimatePixVerseVideoCredits(params);

				if (options.json) {
					printJson(result);
				} else {
					printDetail('PixVerse Credit Estimate', [
						['Tokens', result.tokens],
						['Credits', result.credits],
					]);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
