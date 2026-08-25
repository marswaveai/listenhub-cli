/**
 * Per-model video limits, mirroring the server-side Joi in listenhub-api-server
 * (`src/controller/video-generation.ts` + `src/lib/video-generation/*-rules.ts`).
 *
 * The CLI used to carry one flat set of bounds (duration 4-15, 9 reference images,
 * `--last-frame` always needing `--first-frame`). That silently rejected valid
 * requests the moment a model with different bounds shipped: Wan 3.0 goes up to
 * 30s and 10 reference images, MiniMax H3 caps images at 5 and accepts a lone
 * last frame. Capabilities are registered positively per model — never as
 * "everything except X", which is how the last round buried a bug.
 *
 * The server stays authoritative; these bounds only turn a round-trip 400 into a
 * local message.
 */

export const VIDEO_MODELS = [
	'doubao-seedance-2-pro',
	'doubao-seedance-2-fast',
	'happyhorse',
	'wan3.0-video',
	'wan3.0-video-prime',
	'MiniMax-H3',
] as const;

export type VideoModelName = (typeof VIDEO_MODELS)[number];

/** `768p` / `2k` are MiniMax-H3 only; every other model rejects them. */
export const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p', '768p', '2k'] as const;

export type VideoModelLimits = {
	duration: {min: number; max: number};
	inputVideoDuration: {min: number; max: number};
	referenceImageMax: number;
	referenceVideoMax: number;
	referenceAudioMax: number;
	/** MiniMax H3 accepts a last frame on its own; every other model needs a first frame too. */
	lastFrameRequiresFirstFrame: boolean;
	/** Wan 3.0 and MiniMax H3 accept prompt + reference audio with no image or video. */
	referenceAudioRequiresVisual: boolean;
	resolutions: readonly string[];
};

const SEEDANCE: VideoModelLimits = {
	duration: {min: 4, max: 15},
	inputVideoDuration: {min: 2, max: 15},
	referenceImageMax: 9,
	referenceVideoMax: 3,
	referenceAudioMax: 3,
	lastFrameRequiresFirstFrame: true,
	referenceAudioRequiresVisual: true,
	resolutions: ['480p', '720p', '1080p'],
};

const WAN3: VideoModelLimits = {
	duration: {min: 2, max: 30},
	inputVideoDuration: {min: 1, max: 15},
	referenceImageMax: 10,
	referenceVideoMax: 5,
	referenceAudioMax: 5,
	lastFrameRequiresFirstFrame: true,
	referenceAudioRequiresVisual: false,
	resolutions: ['480p', '720p', '1080p'],
};

const MINIMAX_H3: VideoModelLimits = {
	duration: {min: 4, max: 15},
	inputVideoDuration: {min: 2, max: 15},
	referenceImageMax: 5,
	referenceVideoMax: 3,
	referenceAudioMax: 3,
	lastFrameRequiresFirstFrame: false,
	referenceAudioRequiresVisual: false,
	resolutions: ['768p', '2k'],
};

const LIMITS_BY_MODEL: Record<VideoModelName, VideoModelLimits> = {
	'doubao-seedance-2-pro': SEEDANCE,
	'doubao-seedance-2-fast': SEEDANCE,
	happyhorse: {
		duration: {min: 3, max: 15},
		inputVideoDuration: {min: 3, max: 60},
		referenceImageMax: 9,
		referenceVideoMax: 3,
		referenceAudioMax: 3,
		lastFrameRequiresFirstFrame: true,
		referenceAudioRequiresVisual: true,
		resolutions: ['720p', '1080p'],
	},
	'wan3.0-video': WAN3,
	'wan3.0-video-prime': WAN3,
	'MiniMax-H3': MINIMAX_H3,
};

/**
 * Unknown model names fall back to the widest bounds we know of, so a model the
 * server has but this CLI build does not is not blocked locally.
 */
const WIDEST: VideoModelLimits = {
	duration: {min: 2, max: 30},
	inputVideoDuration: {min: 1, max: 60},
	referenceImageMax: 10,
	referenceVideoMax: 5,
	referenceAudioMax: 5,
	lastFrameRequiresFirstFrame: false,
	referenceAudioRequiresVisual: false,
	resolutions: VIDEO_RESOLUTIONS,
};

export function videoModelLimits(
	model: string | undefined,
	defaultModel: string,
): VideoModelLimits {
	const resolved = model ?? defaultModel;
	return LIMITS_BY_MODEL[resolved as VideoModelName] ?? WIDEST;
}

/** Help text for `--model`, so the four registration sites cannot drift apart. */
export const VIDEO_MODEL_HELP = `Model: ${VIDEO_MODELS.join(', ')}`;

export const VIDEO_RESOLUTION_HELP = `Resolution: ${VIDEO_RESOLUTIONS.join(
	', ',
)} (768p and 2k are MiniMax-H3 only)`;
