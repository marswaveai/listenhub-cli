import ora from 'ora';
import {CliTimeoutError} from '../_shared/output.js';

const pollIntervalMs = 10_000;
const defaultTimeoutS = 300;

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export interface PollOptions {
	timeout?: number;
	label?: string;
	json?: boolean;
}

export interface PollConfig<T> {
	getStatus: () => Promise<T>;
	isDone: (result: T) => boolean;
	isFailed: (result: T) => boolean;
	getErrorMessage?: (result: T) => string;
	options: PollOptions;
}

export async function pollOpenAPI<T>(config: PollConfig<T>): Promise<T> {
	const {getStatus, isDone, isFailed, getErrorMessage, options} = config;
	const timeoutS = options.timeout ?? defaultTimeoutS;
	const maxAttempts = Math.ceil(timeoutS / (pollIntervalMs / 1000));
	const label = options.label ?? 'Processing';

	const spinner = options.json ? undefined : ora({text: `${label}... (1/${maxAttempts})`}).start();

	for (let i = 0; i < maxAttempts; i++) {
		if (i > 0) {
			await sleep(pollIntervalMs); // eslint-disable-line no-await-in-loop
		}

		const result = await getStatus(); // eslint-disable-line no-await-in-loop

		if (isDone(result)) {
			spinner?.succeed(`${label} complete`);
			return result;
		}

		if (isFailed(result)) {
			const msg = getErrorMessage?.(result) ?? 'Task failed';
			spinner?.fail(msg);
			throw new Error(msg);
		}

		if (spinner) {
			spinner.text = `${label}... (${String(i + 2)}/${maxAttempts})`;
		}
	}

	spinner?.fail('Timed out');
	throw new CliTimeoutError(`Timed out after ${timeoutS}s`);
}
