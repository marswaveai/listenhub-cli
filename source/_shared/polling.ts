import type {
	AIImageItem,
	EpisodeDetail,
	ListenHubClient,
	LyricsTaskDetail,
	MusicTaskDetail,
} from '@marswave/listenhub-sdk';
import ora from 'ora';
import {CliTimeoutError} from './output.js';

const pollIntervalMs = 10_000;
const defaultTimeoutS = 300;

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export async function pollUntilDone(
	client: ListenHubClient,
	episodeId: string,
	options: {timeout?: number; label?: string; json?: boolean},
): Promise<EpisodeDetail> {
	const timeoutS = options.timeout ?? defaultTimeoutS;
	const maxAttempts = Math.ceil(timeoutS / (pollIntervalMs / 1000));
	const spinner = options.json
		? undefined
		: ora({
				text: `${options.label ?? 'Creating'}... (1/${maxAttempts})`,
			}).start();

	for (let i = 0; i < maxAttempts; i++) {
		if (i > 0) {
			await sleep(pollIntervalMs); // eslint-disable-line no-await-in-loop
		}

		const detail = await client.getCreation(episodeId); // eslint-disable-line no-await-in-loop
		if (detail.processStatus === 'success') {
			spinner?.succeed(`${options.label ?? 'Created'} successfully`);
			return detail;
		}

		if (detail.processStatus === 'fail') {
			spinner?.fail('Creation failed');
			throw new Error(`Creation failed (code: ${detail.failCode})`);
		}

		if (spinner) {
			spinner.text = `${options.label ?? 'Creating'}... (${String(i + 2)}/${maxAttempts})`;
		}
	}

	spinner?.fail('Timed out');
	throw new CliTimeoutError(`Timed out after ${timeoutS}s`);
}

export async function pollImageUntilDone(
	client: ListenHubClient,
	imageId: string,
	options: {timeout?: number; json?: boolean},
): Promise<AIImageItem> {
	const timeoutS = options.timeout ?? 120;
	const maxAttempts = Math.ceil(timeoutS / (pollIntervalMs / 1000));
	const spinner = options.json
		? undefined
		: ora({text: `Creating image... (1/${maxAttempts})`}).start();

	for (let i = 0; i < maxAttempts; i++) {
		if (i > 0) {
			await sleep(pollIntervalMs); // eslint-disable-line no-await-in-loop
		}

		const item = await client.getAIImage(imageId); // eslint-disable-line no-await-in-loop
		if (item.status === 'success') {
			spinner?.succeed('Image created successfully');
			return item;
		}

		if (item.status === 'fail') {
			spinner?.fail('Image creation failed');
			throw new Error('Image creation failed');
		}

		if (spinner) {
			spinner.text = `Creating image... (${String(i + 2)}/${maxAttempts})`;
		}
	}

	spinner?.fail('Timed out');
	throw new CliTimeoutError(`Timed out after ${timeoutS}s`);
}

export async function pollMusicTaskUntilDone(
	client: ListenHubClient,
	taskId: string,
	options: {timeout?: number; json?: boolean},
): Promise<MusicTaskDetail> {
	const timeoutS = options.timeout ?? 600;
	const maxAttempts = Math.ceil(timeoutS / (pollIntervalMs / 1000));
	const spinner = options.json
		? undefined
		: ora({text: `Creating music... (1/${maxAttempts})`}).start();

	for (let i = 0; i < maxAttempts; i++) {
		if (i > 0) {
			await sleep(pollIntervalMs); // eslint-disable-line no-await-in-loop
		}

		const task = await client.getMusicTask(taskId); // eslint-disable-line no-await-in-loop
		if (task.status === 'success') {
			spinner?.succeed('Music created successfully');
			return task;
		}

		if (task.status === 'failed') {
			spinner?.fail('Music creation failed');
			throw new Error(
				`Music creation failed${task.errorMessage ? `: ${task.errorMessage}` : ''}`,
			);
		}

		if (spinner) {
			spinner.text = `Creating music... (${String(i + 2)}/${maxAttempts})`;
		}
	}

	spinner?.fail('Timed out');
	throw new CliTimeoutError(`Timed out after ${timeoutS}s`);
}

const lyricsIntervalMs = 5_000;

export async function pollLyricsTaskUntilDone(
	client: ListenHubClient,
	taskId: string,
	options: {timeout?: number; json?: boolean},
): Promise<LyricsTaskDetail> {
	const timeoutS = options.timeout ?? 120;
	const maxAttempts = Math.ceil(timeoutS / (lyricsIntervalMs / 1000));
	const spinner = options.json
		? undefined
		: ora({text: `Creating lyrics... (1/${maxAttempts})`}).start();

	for (let i = 0; i < maxAttempts; i++) {
		if (i > 0) {
			await sleep(lyricsIntervalMs); // eslint-disable-line no-await-in-loop
		}

		const task = await client.getLyricsTask(taskId); // eslint-disable-line no-await-in-loop
		if (task.status === 'success') {
			spinner?.succeed('Lyrics generated successfully');
			return task;
		}

		if (task.status === 'failed') {
			spinner?.fail('Lyrics generation failed');
			throw new Error(
				`Lyrics generation failed${task.errorMessage ? `: ${task.errorMessage}` : ''}`,
			);
		}

		if (spinner) {
			spinner.text = `Creating lyrics... (${String(i + 2)}/${maxAttempts})`;
		}
	}

	spinner?.fail('Timed out');
	throw new CliTimeoutError(`Timed out after ${timeoutS}s`);
}
