import {parseVideoMeta} from './video-reference-metadata.js';

export type SeedanceOptions = {
	model?: string;
	prompt?: string;
	resolution?: string;
	ratio?: string;
	duration?: number | string;
	draft?: boolean;
	draftTaskId?: string;
	requestId?: string;
	omniReferenceTaskType?: string;
	firstFrame?: string;
	lastFrame?: string;
	referenceImage?: string[];
	referenceVideo?: string[];
	referenceAudio?: string[];
	referenceImageMeta?: string[];
	referenceVideoMeta?: string[];
	referenceAudioMeta?: string[];
	inputVideoDuration?: number | string;
	seed?: number | string;
	generateAudio?: boolean;
	audioSetting?: string;
};

export type AudioReferenceMeta = {role: 'reference_audio'; duration: number; size?: number};

export function parseAudioMeta(value: string): AudioReferenceMeta {
	const match = /^(\d+(?:\.\d+)?)(?::(\d+))?$/.exec(value.trim());
	if (!match) throw new Error('Audio metadata must be DURATION[:SIZE], for example 5:800000');
	return {
		role: 'reference_audio',
		duration: Number(match[1]),
		...(match[2] !== undefined && {size: Number(match[2])}),
	};
}

export function seedanceRequestFields(options: SeedanceOptions) {
	return {
		...(options.draft !== undefined && {draft: options.draft}),
		...(options.draftTaskId && {draftTaskId: options.draftTaskId}),
		...(options.requestId && {requestId: options.requestId}),
		...(options.omniReferenceTaskType && {
			omniReferenceTaskType: options.omniReferenceTaskType as
				| 'auto'
				| 'reference'
				| 'edit'
				| 'extend',
		}),
	};
}

export function validateSeedanceOptions(options: SeedanceOptions, estimate = false): void {
	const is25 = options.model === 'doubao-seedance-2-5';
	if (!is25) {
		if (options.referenceAudioMeta?.length)
			throw new Error('--reference-audio-meta requires --model doubao-seedance-2-5');
		if (
			options.draft ||
			options.draftTaskId ||
			options.omniReferenceTaskType ||
			options.ratio === 'adaptive' ||
			Number(options.duration) === -1
		) {
			throw new Error(
				'Draft, omni task type, adaptive and duration -1 require --model doubao-seedance-2-5',
			);
		}
		if (!estimate && !options.prompt?.trim()) throw new Error('--prompt is required');
		if (options.model?.startsWith('doubao-seedance') && (options.prompt?.length ?? 0) > 3000) {
			throw new Error('Seedance 2.0 prompt must not exceed 3000 characters');
		}
		return;
	}

	if (options.draftTaskId) {
		if (
			options.draft ||
			options.prompt !== undefined ||
			options.resolution !== undefined ||
			options.ratio !== undefined ||
			options.duration !== undefined ||
			options.seed !== undefined ||
			options.generateAudio === false ||
			options.audioSetting !== undefined ||
			options.omniReferenceTaskType !== undefined ||
			options.firstFrame ||
			options.lastFrame ||
			options.inputVideoDuration !== undefined ||
			[
				options.referenceImage,
				options.referenceVideo,
				options.referenceAudio,
				options.referenceImageMeta,
				options.referenceVideoMeta,
				options.referenceAudioMeta,
			].some((items) => (items?.length ?? 0) > 0)
		) {
			throw new Error(
				'--draft-task-id inherits the draft inputs; omit prompt, assets and generation parameters',
			);
		}
		return;
	}
	if (!estimate && !options.prompt?.trim())
		throw new Error('--prompt is required unless --draft-task-id is provided');
	if ((options.prompt?.length ?? 0) > 5000)
		throw new Error('Seedance 2.5 prompt must not exceed 5000 characters');
	if (
		options.omniReferenceTaskType &&
		!['auto', 'reference', 'edit', 'extend'].includes(options.omniReferenceTaskType)
	)
		throw new Error('--omni-reference-task-type must be auto, reference, edit or extend');
	if (options.resolution !== undefined && !['480p', '720p', '1080p'].includes(options.resolution))
		throw new Error('Seedance 2.5 resolution must be 480p, 720p or 1080p');
	if (options.draft && options.resolution !== '480p')
		throw new Error('--draft requires --resolution 480p');
	if (
		options.ratio !== undefined &&
		!['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'].includes(options.ratio)
	)
		throw new Error('Unsupported Seedance 2.5 ratio');
	const editing = options.omniReferenceTaskType === 'edit';
	if (
		(editing ||
			options.omniReferenceTaskType === 'extend' ||
			options.firstFrame ||
			options.lastFrame) &&
		options.ratio !== 'adaptive'
	)
		throw new Error('Seedance 2.5 frame, edit and extend modes require --ratio adaptive');
	if (editing && Number(options.duration) !== -1)
		throw new Error('Seedance 2.5 edit requires --duration -1');
	if (
		(editing || options.omniReferenceTaskType === 'extend') &&
		!(options.referenceVideo?.length || options.referenceVideoMeta?.length)
	)
		throw new Error('Seedance 2.5 edit/extend requires a reference video');
	if (options.duration !== undefined) {
		const duration = Number(options.duration);
		if (!Number.isInteger(duration) || (duration !== -1 && (duration < 4 || duration > 30)))
			throw new Error('Seedance 2.5 duration must be 4–30 seconds or -1');
	}
	const videos = (options.referenceVideoMeta ?? []).map(parseVideoMeta);
	const audios = (options.referenceAudioMeta ?? []).map(parseAudioMeta);
	if (!estimate && audios.length !== (options.referenceAudio?.length ?? 0))
		throw new Error('Seedance 2.5 requires one --reference-audio-meta DURATION[:SIZE] per audio');
	for (const [kind, items, min] of [
		['video', videos, editing ? 4 : 2],
		['audio', audios, 2],
	] as const) {
		if (items.length > 10)
			throw new Error(`Seedance 2.5 supports at most 10 reference ${kind} files`);
		if (
			items.some((item) => item.duration === undefined || item.duration < min || item.duration > 30)
		)
			throw new Error(`Each Seedance 2.5 reference ${kind} must be ${min}–30 seconds`);
		if (items.reduce((sum, item) => sum + (item.duration ?? 0), 0) > 30)
			throw new Error(`Seedance 2.5 total reference ${kind} duration must not exceed 30 seconds`);
	}
	if (audios.some((audio) => audio.size !== undefined && audio.size > 15 * 1024 * 1024))
		throw new Error('Seedance 2.5 reference audio must not exceed 15 MB');
	if (
		videos.length &&
		options.inputVideoDuration !== undefined &&
		Math.abs(
			videos.reduce((sum, video) => sum + (video.duration ?? 0), 0) -
				Number(options.inputVideoDuration),
		) > 0.01
	)
		throw new Error('--input-video-duration must equal the sum of all reference video durations');
}

export function totalReferenceVideoDuration(options: SeedanceOptions): number | undefined {
	if (options.model !== 'doubao-seedance-2-5' || !options.referenceVideoMeta?.length)
		return undefined;
	return options.referenceVideoMeta
		.map(parseVideoMeta)
		.reduce((sum, video) => sum + (video.duration ?? 0), 0);
}

export function draftFinalParams(options: SeedanceOptions) {
	return {
		model: 'doubao-seedance-2-5',
		draftTaskId: options.draftTaskId!,
		...(options.requestId && {requestId: options.requestId}),
	};
}
