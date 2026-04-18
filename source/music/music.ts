import type {
	CreateMusicExtendParams,
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

export type MusicListOptions = {
	page: number;
	pageSize: number;
	status?: MusicTaskStatus;
	json: boolean;
};

// --- Helpers ---

function formatDuration(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${String(m)}:${String(s).padStart(2, '0')}`;
}

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString('sv-SE'); // YYYY-MM-DD
}

function formatDateTime(timestamp: number): string {
	const d = new Date(timestamp);
	return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('en-GB', {hour12: false})}`;
}

function printMusicDetail(task: MusicTaskDetail): void {
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
				`${track.audioUrl} (${formatDuration(track.duration)})`,
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
