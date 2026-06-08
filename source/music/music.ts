import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {
	CreateMusicExtendParams,
	CreateMusicTrackParams,
	ListenHubClient,
	MusicTaskDetail,
	MusicTaskStatus,
} from '@marswave/listenhub-sdk';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollMusicTaskUntilDone} from '../_shared/polling.js';
import {resolveFileOrUrl} from '../_shared/upload.js';

// --- Types ---

export type MusicGenerateOptions = {
	prompt: string;
	style?: string;
	title?: string;
	instrumental: boolean;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export type MusicCoverOptions = {
	audio: string;
	prompt?: string;
	style?: string;
	title?: string;
	instrumental: boolean;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export type MusicExtendOptions = {
	audio: string;
	model: string;
	continueAt: number;
	prompt?: string;
	style?: string;
	title?: string;
	instrumental: boolean;
	negativeTags?: string;
	vocalGender?: string;
	styleWeight?: number;
	weirdness?: number;
	audioWeight?: number;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export type MusicRemixOptions = {
	audio?: string;
	audioUrl?: string;
	providerSongId?: string;
	lyrics: string;
	prompt: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export type MusicInstrumentalOptions = {
	prompt?: string;
	referenceAudio?: string;
	model?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export type MusicSoundtrackOptions = {
	image?: string;
	video?: string;
	prompt?: string;
	model?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export type MusicTrackOptions = {
	audio?: string;
	providerSongId?: string;
	generateType: string;
	prompt: string;
	lyrics?: string;
	vocalGender?: string;
	generateStart?: number;
	generateEnd?: number;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export type MusicRecognizeOptions = {
	audio: string;
	json: boolean;
};

export type MusicDescribeOptions = {
	audio: string;
	json: boolean;
};

export type MusicStemOptions = {
	audio: string;
	model?: string;
	json: boolean;
};

export type MusicListOptions = {
	page: number;
	pageSize: number;
	status?: MusicTaskStatus;
	json: boolean;
};

// --- Helpers ---

const musicMaxBytes = 10 * 1024 * 1024;
const audioExtensions = new Set(['.mp3', '.m4a', '.wav']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const videoExtensions = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm']);

type MusicFileKind = 'audio' | 'image' | 'video';

const allowedMusicExtensions: Record<MusicFileKind, Set<string>> = {
	audio: audioExtensions,
	image: imageExtensions,
	video: videoExtensions,
};

/**
 * Read a local file into a Blob for multipart upload, validating extension and size.
 * Returns the Blob plus the original basename so the SDK can preserve the filename.
 */
export async function readFileAsBlob(
	input: string,
	kind: MusicFileKind,
	options: {audioWav?: boolean} = {},
): Promise<{blob: Blob; filename: string}> {
	const trimmed = input.trim();
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		throw new Error(`Expected a local ${kind} file, got a URL: ${trimmed}`);
	}

	const filePath = path.resolve(trimmed);
	const ext = path.extname(filePath).toLowerCase();

	let allowed = allowedMusicExtensions[kind];
	if (kind === 'audio' && !options.audioWav) {
		allowed = new Set(['.mp3', '.m4a']);
	}

	if (!allowed.has(ext)) {
		const expected = [...allowed].join(', ');
		throw new Error(`Unsupported ${kind} format: ${ext} (expected: ${expected})`);
	}

	let buffer: Buffer;
	try {
		buffer = await readFile(filePath);
	} catch {
		throw new Error(`File not found: ${trimmed}`);
	}

	if (buffer.length > musicMaxBytes) {
		const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
		throw new Error(`File too large: ${sizeMb} MB (max 10 MB)`);
	}

	return {blob: new Blob([new Uint8Array(buffer)]), filename: path.basename(filePath)};
}

function emitTaskResult(task: MusicTaskDetail, json: boolean): void {
	if (json) {
		printJson(task);
	} else {
		printMusicDetail(task);
	}
}

function emitSubmitted(result: {taskId: string}, json: boolean): void {
	if (json) {
		printJson(result);
	} else {
		console.log(`✓ Music task submitted: ${result.taskId}`);
	}
}

export function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${String(m)}:${String(s).padStart(2, '0')}`;
}

/**
 * Normalize a provider duration to seconds. Mureka reports track/clip duration in
 * milliseconds, while Suno (and the documented API contract) use seconds. No generated
 * music track is an hour long, so any value >= 3600 must be milliseconds. This also
 * self-corrects if the server is later changed to normalize Mureka durations to seconds.
 */
export function toSeconds(duration: number): number {
	return duration >= 3600 ? duration / 1000 : duration;
}

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString('sv-SE'); // YYYY-MM-DD
}

function formatDateTime(timestamp: number): string {
	const d = new Date(timestamp);
	return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('en-GB', {hour12: false})}`;
}

export function printMusicDetail(task: MusicTaskDetail): void {
	const rows: Array<[string, string | number | undefined]> = [
		['Task ID:', task.id],
		['Type:', task.taskType.toLowerCase()],
		['Status:', task.status],
	];

	if (task.status === 'failed') {
		rows.push(['Error:', task.errorMessage]);
	} else {
		const trackTitle = task.tracks[0]?.title ?? task.params.title;
		if (trackTitle) {
			rows.push(['Title:', trackTitle]);
		}

		rows.push(['Tracks:', task.tracks.length]);
		for (const [i, track] of task.tracks.entries()) {
			rows.push([
				`Track ${String(i + 1)}:`,
				`${track.audioUrl} (${formatDuration(toSeconds(track.duration))})`,
			]);
		}
	}

	rows.push(['Created:', formatDateTime(task.createdAt)]);

	if (task.status === 'failed') {
		console.log(`\u2717 Music task\n`);
		for (const [key, value] of rows) {
			if (value !== undefined) {
				console.log(`  ${key.padEnd(10)} ${String(value)}`);
			}
		}
	} else {
		printDetail('Music task', rows);
	}
}

// --- Commands ---

export async function createGenerate(
	client: ListenHubClient,
	options: MusicGenerateOptions,
): Promise<void> {
	if (!options.prompt.trim()) {
		throw new Error('Prompt is required');
	}

	const result = await client.createMusicGenerate({
		prompt: options.prompt,
		...(options.style && {style: options.style}),
		...(options.title && {title: options.title}),
		...(options.instrumental && {instrumental: true}),
	});

	if (!options.wait) {
		if (options.json) {
			printJson(result);
		} else {
			console.log(`\u2713 Music task submitted: ${result.taskId}`);
		}

		return;
	}

	const task = await pollMusicTaskUntilDone(client, result.taskId, {
		timeout: options.timeout,
		json: options.json,
	});

	if (options.json) {
		printJson(task);
	} else {
		printMusicDetail(task);
	}
}

export async function createCover(
	client: ListenHubClient,
	options: MusicCoverOptions,
): Promise<void> {
	const uploadUrl = await resolveFileOrUrl(client, options.audio, {
		accept: 'audio',
	});

	const result = await client.createMusicCover({
		uploadUrl,
		...(options.prompt && {prompt: options.prompt}),
		...(options.style && {style: options.style}),
		...(options.title && {title: options.title}),
		...(options.instrumental && {instrumental: true}),
	});

	if (!options.wait) {
		if (options.json) {
			printJson(result);
		} else {
			console.log(`\u2713 Music task submitted: ${result.taskId}`);
		}

		return;
	}

	const task = await pollMusicTaskUntilDone(client, result.taskId, {
		timeout: options.timeout,
		json: options.json,
	});

	if (options.json) {
		printJson(task);
	} else {
		printMusicDetail(task);
	}
}

export async function createExtend(
	client: ListenHubClient,
	options: MusicExtendOptions,
): Promise<void> {
	const uploadUrl = await resolveFileOrUrl(client, options.audio, {
		accept: 'audio',
	});

	const parameters: CreateMusicExtendParams = {
		uploadUrl,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- CLI string validated by Commander choices
		model: options.model as CreateMusicExtendParams['model'],
		continueAt: options.continueAt,
		...(options.prompt && {prompt: options.prompt}),
		...(options.style && {style: options.style}),
		...(options.title && {title: options.title}),
		...(options.instrumental && {instrumental: true}),
		...(options.negativeTags && {negativeTags: options.negativeTags}),
		...(options.vocalGender && {
			vocalGender:
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- CLI string validated by Commander choices
				options.vocalGender as CreateMusicExtendParams['vocalGender'],
		}),
		...(options.styleWeight !== undefined && {
			styleWeight: options.styleWeight,
		}),
		...(options.weirdness !== undefined && {
			weirdnessConstraint: options.weirdness,
		}),
		...(options.audioWeight !== undefined && {
			audioWeight: options.audioWeight,
		}),
	};

	const result = await client.createMusicExtend(parameters);

	if (!options.wait) {
		if (options.json) {
			printJson(result);
		} else {
			console.log(`\u2713 Music task submitted: ${result.taskId}`);
		}

		return;
	}

	const task = await pollMusicTaskUntilDone(client, result.taskId, {
		timeout: options.timeout,
		json: options.json,
	});

	if (options.json) {
		printJson(task);
	} else {
		printMusicDetail(task);
	}
}

export async function listTasks(client: ListenHubClient, options: MusicListOptions): Promise<void> {
	const {items} = await client.listMusicTasks({
		page: options.page,
		pageSize: options.pageSize,
		...(options.status && {status: options.status}),
	});

	if (options.json) {
		printJson({items});
		return;
	}

	const headers = ['ID', 'Type', 'Status', 'Title', 'Tracks', 'Created'];
	const rows = items.map((task) => [
		task.id,
		task.taskType.toLowerCase(),
		task.status,
		task.tracks[0]?.title ?? task.params.title ?? '\u2014',
		String(task.tracks.length),
		formatDate(task.createdAt),
	]);
	printTable(headers, rows);
}

export async function getTask(
	client: ListenHubClient,
	taskId: string,
	json: boolean,
): Promise<void> {
	const task = await client.getMusicTask(taskId);

	if (json) {
		printJson(task);
		return;
	}

	printMusicDetail(task);
}

export async function createRemix(
	client: ListenHubClient,
	options: MusicRemixOptions,
): Promise<void> {
	const sources = [options.audio, options.audioUrl, options.providerSongId].filter(Boolean);
	if (sources.length !== 1) {
		throw new Error('Provide exactly one of: <audio file>, --audio-url, --provider-song-id');
	}

	const parameters: Parameters<ListenHubClient['createMusicRemix']>[0] = {
		lyrics: options.lyrics,
		prompt: options.prompt,
	};

	if (options.audio) {
		const {blob, filename} = await readFileAsBlob(options.audio, 'audio');
		parameters.audio = blob;
		parameters.audioFilename = filename;
	} else if (options.audioUrl) {
		parameters.audioUrl = await resolveFileOrUrl(client, options.audioUrl, {accept: 'audio'});
	} else if (options.providerSongId) {
		parameters.providerSongId = options.providerSongId;
	}

	const result = await client.createMusicRemix(parameters);

	if (!options.wait) {
		emitSubmitted(result, options.json);
		return;
	}

	const task = await pollMusicTaskUntilDone(client, result.taskId, {
		timeout: options.timeout,
		json: options.json,
	});
	emitTaskResult(task, options.json);
}

export async function createInstrumental(
	client: ListenHubClient,
	options: MusicInstrumentalOptions,
): Promise<void> {
	const hasPrompt = Boolean(options.prompt);
	const hasReference = Boolean(options.referenceAudio);
	if (hasPrompt === hasReference) {
		throw new Error('Provide exactly one of: --prompt, --reference-audio <file>');
	}

	const parameters: Parameters<ListenHubClient['createMusicInstrumental']>[0] = {};

	if (options.prompt) {
		parameters.prompt = options.prompt;
	} else if (options.referenceAudio) {
		const {blob, filename} = await readFileAsBlob(options.referenceAudio, 'audio');
		parameters.referenceAudio = blob;
		parameters.referenceAudioFilename = filename;
	}

	if (options.model) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- CLI string validated by Commander choices
		parameters.model = options.model as NonNullable<typeof parameters.model>;
	}

	const result = await client.createMusicInstrumental(parameters);

	if (!options.wait) {
		emitSubmitted(result, options.json);
		return;
	}

	const task = await pollMusicTaskUntilDone(client, result.taskId, {
		timeout: options.timeout,
		json: options.json,
	});
	emitTaskResult(task, options.json);
}

export async function createSoundtrack(
	client: ListenHubClient,
	options: MusicSoundtrackOptions,
): Promise<void> {
	const hasImage = Boolean(options.image);
	const hasVideo = Boolean(options.video);
	if (hasImage === hasVideo) {
		throw new Error('Provide exactly one of: --image <file>, --video <file>');
	}

	const parameters: Parameters<ListenHubClient['createMusicSoundtrack']>[0] = {};

	if (options.image) {
		const {blob, filename} = await readFileAsBlob(options.image, 'image');
		parameters.image = blob;
		parameters.imageFilename = filename;
	} else if (options.video) {
		const {blob, filename} = await readFileAsBlob(options.video, 'video');
		parameters.video = blob;
		parameters.videoFilename = filename;
	}

	if (options.prompt) {
		parameters.prompt = options.prompt;
	}

	if (options.model) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- CLI string validated by Commander choices
		parameters.model = options.model as NonNullable<typeof parameters.model>;
	}

	const result = await client.createMusicSoundtrack(parameters);

	if (!options.wait) {
		emitSubmitted(result, options.json);
		return;
	}

	const task = await pollMusicTaskUntilDone(client, result.taskId, {
		timeout: options.timeout,
		json: options.json,
	});
	emitTaskResult(task, options.json);
}

export async function createTrack(
	client: ListenHubClient,
	options: MusicTrackOptions,
): Promise<void> {
	const hasAudio = Boolean(options.audio);
	const hasProviderSong = Boolean(options.providerSongId);
	if (hasAudio === hasProviderSong) {
		throw new Error('Provide exactly one of: --audio <file>, --provider-song-id');
	}

	if (options.generateType === 'Vocals' && !options.lyrics) {
		throw new Error('--lyrics is required when --generate-type is Vocals');
	}

	const parameters: CreateMusicTrackParams = {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- CLI string validated by Commander choices
		generateType: options.generateType as CreateMusicTrackParams['generateType'],
		prompt: options.prompt,
	};

	if (options.audio) {
		const {blob, filename} = await readFileAsBlob(options.audio, 'audio', {audioWav: true});
		parameters.audio = blob;
		parameters.audioFilename = filename;
	} else if (options.providerSongId) {
		parameters.providerSongId = options.providerSongId;
	}

	if (options.lyrics) {
		parameters.lyrics = options.lyrics;
	}

	if (options.vocalGender) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- CLI string validated by Commander choices
		parameters.vocalGender = options.vocalGender as CreateMusicTrackParams['vocalGender'];
	}

	if (options.generateStart !== undefined) {
		parameters.generateStart = options.generateStart;
	}

	if (options.generateEnd !== undefined) {
		parameters.generateEnd = options.generateEnd;
	}

	const result = await client.createMusicTrack(parameters);

	if (!options.wait) {
		emitSubmitted(result, options.json);
		return;
	}

	const task = await pollMusicTaskUntilDone(client, result.taskId, {
		timeout: options.timeout,
		json: options.json,
	});
	emitTaskResult(task, options.json);
}

export async function recognize(
	client: ListenHubClient,
	options: MusicRecognizeOptions,
): Promise<void> {
	const {blob, filename} = await readFileAsBlob(options.audio, 'audio');
	const result = await client.recognizeMusic({audio: blob, audioFilename: filename});

	if (options.json) {
		printJson(result);
		return;
	}

	printDetail('Music recognition', [
		['ID:', result.id],
		['Duration:', formatDuration(toSeconds(result.result.duration))],
		['Sections:', result.result.lyricsSections.length],
		['Credit cost:', result.creditCost],
	]);
}

export async function describe(
	client: ListenHubClient,
	options: MusicDescribeOptions,
): Promise<void> {
	const {blob, filename} = await readFileAsBlob(options.audio, 'audio');
	const result = await client.describeMusic({audio: blob, audioFilename: filename});

	if (options.json) {
		printJson(result);
		return;
	}

	printDetail('Music description', [
		['ID:', result.id],
		['Description:', result.result.description],
		['Tags:', result.result.tags.join(', ') || '—'],
		['Genres:', result.result.genres.join(', ') || '—'],
		['Instruments:', result.result.instruments.join(', ') || '—'],
		['Credit cost:', result.creditCost],
	]);
}

export async function stem(client: ListenHubClient, options: MusicStemOptions): Promise<void> {
	const {blob, filename} = await readFileAsBlob(options.audio, 'audio');
	const result = await client.stemMusic({
		audio: blob,
		audioFilename: filename,
		...(options.model && {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- CLI string validated by Commander choices
			model: options.model as 'audio-separation-1' | 'audio-separation-2',
		}),
	});

	if (options.json) {
		printJson(result);
		return;
	}

	printDetail('Music stems', [
		['ID:', result.id],
		['Stems (zip):', result.result.zipUrl],
		['MIDI (zip):', result.result.midiZipUrl ?? '—'],
		['Expires:', formatDateTime(result.result.expiresAt)],
		['Credit cost:', result.creditCost],
	]);
}
