import path from 'node:path';
import type {
	CreateVideoGenerationParams,
	EstimateVideoGenerationCreditsParams,
	ListenHubClient,
	VideoContentItem,
	VideoGenerationModel,
	VideoGenerationRatio,
	VideoGenerationResolution,
	VideoGenerationTaskStatus,
} from '@marswave/listenhub-sdk';
import {getMp4Duration} from '../_shared/mp4-duration.js';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollVideoTaskUntilDone} from '../_shared/polling.js';
import {resolveFileOrUrl} from '../_shared/upload.js';
import {normalizeVideoTaskId} from '../_shared/video-task-id.js';

export type VideoCreateOptions = {
	prompt: string;
	model?: string;
	resolution?: string;
	ratio?: string;
	duration?: number;
	firstFrame?: string;
	lastFrame?: string;
	referenceImage: string[];
	referenceVideo: string[];
	referenceAudio: string[];
	inputVideoDuration?: number;
	generateAudio: boolean;
	audioSetting?: string;
	seed?: number;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export type VideoListOptions = {
	page: number;
	pageSize: number;
	status?: string;
	json: boolean;
};

export type VideoEstimateOptions = {
	model: string;
	resolution: string;
	duration: number;
	ratio: string;
	hasVideoInput: boolean;
	inputVideoDuration?: number;
	json: boolean;
};

const allowedVideoAudioExtensions = new Set(['.mp3', '.wav']);
const allowedVideoExtensions = new Set(['.mp4', '.mov']);

function validateCreateOptions(options: VideoCreateOptions): void {
	if (options.duration !== undefined && (options.duration < 3 || options.duration > 15)) {
		throw new Error('Duration must be between 3 and 15 seconds');
	}

	if (options.seed !== undefined && (options.seed < -1 || options.seed > 4_294_967_295)) {
		throw new Error('Seed must be between -1 and 4294967295');
	}

	if (options.lastFrame && !options.firstFrame) {
		throw new Error('--last-frame requires --first-frame');
	}

	const hasFrameMode = Boolean(options.firstFrame || options.lastFrame);
	const hasReferenceMode =
		options.referenceImage.length > 0 ||
		options.referenceVideo.length > 0 ||
		options.referenceAudio.length > 0;

	if (hasFrameMode && hasReferenceMode) {
		throw new Error(
			'Cannot mix frame mode (--first-frame/--last-frame) with reference mode (--reference-image/--reference-video/--reference-audio)',
		);
	}

	if (options.referenceVideo.length > 0 && options.inputVideoDuration === undefined) {
		const hasLocalVideo = options.referenceVideo.some(
			(v) => !v.startsWith('http://') && !v.startsWith('https://'),
		);
		if (!hasLocalVideo) {
			throw new Error('--input-video-duration is required when using --reference-video with URLs');
		}
	}

	if (options.inputVideoDuration !== undefined && options.referenceVideo.length === 0) {
		throw new Error('--input-video-duration requires --reference-video');
	}

	if (
		options.inputVideoDuration !== undefined &&
		(options.inputVideoDuration < 2 || options.inputVideoDuration > 15)
	) {
		throw new Error('Input video duration must be between 2 and 15 seconds');
	}

	if (
		options.referenceAudio.length > 0 &&
		options.referenceImage.length === 0 &&
		options.referenceVideo.length === 0
	) {
		throw new Error('--reference-audio requires --reference-image or --reference-video');
	}

	if (options.referenceImage.length > 9) {
		throw new Error('Too many reference images (max 9)');
	}

	if (options.referenceVideo.length > 3) {
		throw new Error('Too many reference videos (max 3)');
	}

	if (options.referenceAudio.length > 3) {
		throw new Error('Too many reference audios (max 3)');
	}

	for (const file of options.referenceAudio) {
		if (!file.startsWith('http://') && !file.startsWith('https://')) {
			const ext = path.extname(file).toLowerCase();
			if (!allowedVideoAudioExtensions.has(ext)) {
				throw new Error('Reference audio must be .mp3 or .wav');
			}
		}
	}

	for (const file of options.referenceVideo) {
		if (!file.startsWith('http://') && !file.startsWith('https://')) {
			const ext = path.extname(file).toLowerCase();
			if (!allowedVideoExtensions.has(ext)) {
				throw new Error('Reference video must be .mp4 or .mov');
			}
		}
	}
}

export async function createVideo(
	client: ListenHubClient,
	options: VideoCreateOptions,
): Promise<void> {
	if (options.referenceVideo.length > 0 && options.inputVideoDuration === undefined) {
		const localVideo = options.referenceVideo.find(
			(v) => !v.startsWith('http://') && !v.startsWith('https://'),
		);
		if (localVideo) {
			const filePath = path.resolve(localVideo.trim());
			const detected = await getMp4Duration(filePath);
			if (detected >= 2 && detected <= 15) {
				options.inputVideoDuration = detected;
			} else {
				throw new Error(
					`Reference video is ${String(detected)}s long; --input-video-duration (2-15) is required to specify how much to use`,
				);
			}
		}
	}

	validateCreateOptions(options);

	const content: VideoContentItem[] = [{type: 'text', text: options.prompt}];

	if (options.firstFrame) {
		const url = await resolveFileOrUrl(client, options.firstFrame, {
			accept: 'image',
			category: 'episode',
		});
		content.push({type: 'image_url', image_url: {url}, role: 'first_frame'});
	}

	if (options.lastFrame) {
		const url = await resolveFileOrUrl(client, options.lastFrame, {
			accept: 'image',
			category: 'episode',
		});
		content.push({type: 'image_url', image_url: {url}, role: 'last_frame'});
	}

	for (const ref of options.referenceImage) {
		const url = await resolveFileOrUrl(client, ref, {accept: 'image', category: 'episode'}); // eslint-disable-line no-await-in-loop
		content.push({type: 'image_url', image_url: {url}, role: 'reference_image'});
	}

	for (const ref of options.referenceVideo) {
		const url = await resolveFileOrUrl(client, ref, {accept: 'video', category: 'episode'}); // eslint-disable-line no-await-in-loop
		content.push({type: 'video_url', video_url: {url}, role: 'reference_video'});
	}

	for (const ref of options.referenceAudio) {
		const url = await resolveFileOrUrl(client, ref, {accept: 'audio', category: 'episode'}); // eslint-disable-line no-await-in-loop
		content.push({type: 'audio_url', audio_url: {url}, role: 'reference_audio'});
	}

	const params: CreateVideoGenerationParams = {
		content,
		...(options.model && {model: options.model as VideoGenerationModel}),
		...(options.resolution && {resolution: options.resolution as VideoGenerationResolution}),
		...(options.ratio && {ratio: options.ratio as VideoGenerationRatio}),
		...(options.duration !== undefined && {duration: options.duration}),
		...(!options.generateAudio && {generateAudio: false}),
		...(options.seed !== undefined && {seed: options.seed}),
		...(options.inputVideoDuration !== undefined && {
			inputVideoDuration: options.inputVideoDuration,
		}),
		...(options.audioSetting && {audioSetting: options.audioSetting as 'auto' | 'origin'}),
	};

	const {taskId: rawTaskId} = await client.createVideoGeneration(params);
	const taskId = normalizeVideoTaskId(rawTaskId);

	if (!options.wait) {
		if (options.json) {
			printJson({taskId});
		} else {
			console.log(`✓ Video task submitted: ${taskId}`);
		}

		return;
	}

	const task = await pollVideoTaskUntilDone(client, taskId, {
		timeout: options.timeout,
		json: options.json,
	});

	if (options.json) {
		printJson(task);
	} else {
		printDetail('Video created', [
			['ID:', task.id],
			['Video:', task.videoUrl],
			['Duration:', task.duration ? `${String(task.duration)}s` : undefined],
			['Resolution:', task.resolution],
			['Ratio:', task.ratio],
			['Seed:', task.seed],
			['Credits:', task.creditCharged],
		]);
	}
}

export async function getVideo(
	client: ListenHubClient,
	taskId: string,
	json: boolean,
): Promise<void> {
	const task = await client.getVideoGenerationTask(normalizeVideoTaskId(taskId));

	if (json) {
		printJson(task);
		return;
	}

	printDetail('Video task details', [
		['ID:', task.id],
		['Status:', task.status],
		['Model:', task.model],
		['Video:', task.videoUrl],
		['Duration:', task.duration ? `${String(task.duration)}s` : undefined],
		['Resolution:', task.resolution],
		['Ratio:', task.ratio],
		['Seed:', task.seed],
		['Credits:', task.creditCharged],
		['Created:', new Date(task.createdAt).toISOString()],
	]);
}

export async function listVideos(
	client: ListenHubClient,
	options: VideoListOptions,
): Promise<void> {
	const {items} = await client.listVideoGenerationTasks({
		page: options.page,
		pageSize: options.pageSize,
		...(options.status && {status: options.status as VideoGenerationTaskStatus}),
	});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['ID', 'Model', 'Status', 'Duration', 'Created'];
	const rows = items.map((item) => [
		item.id,
		item.model,
		item.status,
		item.params.duration ? `${String(item.params.duration)}s` : '-',
		new Date(item.createdAt).toISOString().slice(0, 10),
	]);
	printTable(headers, rows);
}

export async function estimateCredits(
	client: ListenHubClient,
	options: VideoEstimateOptions,
): Promise<void> {
	if (options.hasVideoInput && options.inputVideoDuration === undefined) {
		throw new Error('--input-video-duration is required when using --has-video-input');
	}

	if (!options.hasVideoInput && options.inputVideoDuration !== undefined) {
		throw new Error('--input-video-duration requires --has-video-input');
	}

	const params: EstimateVideoGenerationCreditsParams = {
		model: options.model as VideoGenerationModel,
		resolution: options.resolution as VideoGenerationResolution,
		duration: options.duration,
		...(options.ratio && {ratio: options.ratio as VideoGenerationRatio}),
		...(options.hasVideoInput && {hasVideoInput: true}),
		...(options.inputVideoDuration !== undefined && {
			inputVideoDuration: options.inputVideoDuration,
		}),
	};

	const result = await client.estimateVideoGenerationCredits(params);

	if (options.json) {
		printJson(result);
		return;
	}

	printDetail('Credit estimate', [
		['Tokens:', result.tokens],
		['Credits:', result.credits],
	]);
}
