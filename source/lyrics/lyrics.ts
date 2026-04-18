import type {ListenHubClient, LyricsTaskDetail, LyricsTaskStatus} from '@marswave/listenhub-sdk';
import {printJson, printTable} from '../_shared/output.js';
import {pollLyricsTaskUntilDone} from '../_shared/polling.js';

// --- Types ---

export type LyricsGenerateOptions = {
	prompt: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export type LyricsListOptions = {
	page: number;
	pageSize: number;
	status?: LyricsTaskStatus;
	json: boolean;
};

// --- Helpers ---

function formatDateTime(timestamp: number): string {
	const d = new Date(timestamp);
	return `${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('en-GB', {hour12: false})}`;
}

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString('sv-SE');
}

function printLyricsDetail(task: LyricsTaskDetail): void {
	if (task.status === 'failed') {
		const rows: Array<[string, string | number | undefined]> = [
			['Task ID:', task.id],
			['Status:', task.status],
			['Error:', task.errorMessage],
			['Created:', formatDateTime(task.createdAt)],
		];
		console.log(`\u2717 Lyrics task\n`);
		for (const [key, value] of rows) {
			if (value !== undefined) {
				console.log(`  ${key.padEnd(10)} ${String(value)}`);
			}
		}

		return;
	}

	console.log(`\u2713 Lyrics generated (${task.variants.length} variants)\n`);

	for (const [i, variant] of task.variants.entries()) {
		console.log(`  \u2500\u2500 Variant ${String(i + 1)} \u2500\u2500`);
		console.log(`  Title: ${variant.title}\n`);
		for (const line of variant.text.split('\n')) {
			console.log(`  ${line}`);
		}

		console.log();
	}
}

// --- Commands ---

export async function createGenerate(
	client: ListenHubClient,
	options: LyricsGenerateOptions,
): Promise<void> {
	if (!options.prompt.trim()) {
		throw new Error('Prompt is required');
	}

	const result = await client.createLyrics({
		prompt: options.prompt,
	});

	if (!options.wait) {
		if (options.json) {
			printJson(result);
		} else {
			console.log(`\u2713 Lyrics task submitted: ${result.taskId}`);
		}

		return;
	}

	const task = await pollLyricsTaskUntilDone(client, result.taskId, {
		timeout: options.timeout,
		json: options.json,
	});

	if (options.json) {
		printJson(task);
	} else {
		printLyricsDetail(task);
	}
}

export async function listTasks(
	client: ListenHubClient,
	options: LyricsListOptions,
): Promise<void> {
	const response = await client.listLyricsTasks({
		page: options.page,
		pageSize: options.pageSize,
		...(options.status && {status: options.status}),
	});

	if (options.json) {
		printJson(response);
		return;
	}

	const headers = ['ID', 'Status', 'Prompt', 'Variants', 'Created'];
	const rows = response.items.map((task) => [
		task.id,
		task.status,
		task.params.prompt.length > 30
			? task.params.prompt.slice(0, 30) + '\u2026'
			: task.params.prompt,
		String(task.variants.length),
		formatDate(task.createdAt),
	]);
	printTable(headers, rows);
}

export async function getTask(
	client: ListenHubClient,
	taskId: string,
	json: boolean,
): Promise<void> {
	const task = await client.getLyricsTask(taskId);

	if (json) {
		printJson(task);
		return;
	}

	printLyricsDetail(task);
}
