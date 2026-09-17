import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import type {Command} from 'commander';
import {CliTimeoutError, handleError, printDetail, printJson} from '../_shared/output.js';
import {pollOpenAPI} from './polling.js';
import {getTranscriptionClient, type TranscriptionTask} from './transcription-client.js';

type JsonOptions = {json: boolean};
type WaitOptions = JsonOptions & {timeout: string};

const contentTypes: Record<string, string> = {
	'.aac': 'audio/aac',
	'.amr': 'audio/amr',
	'.avi': 'video/x-msvideo',
	'.flac': 'audio/flac',
	'.flv': 'video/x-flv',
	'.m4a': 'audio/mp4',
	'.mkv': 'video/x-matroska',
	'.mov': 'video/quicktime',
	'.mp3': 'audio/mpeg',
	'.mp4': 'video/mp4',
	'.mpeg': 'video/mpeg',
	'.ogg': 'audio/ogg',
	'.opus': 'audio/ogg',
	'.wav': 'audio/wav',
	'.webm': 'video/webm',
	'.wma': 'audio/x-ms-wma',
	'.wmv': 'video/x-ms-wmv',
};

function durationMs(value: string): number {
	const duration = Number(value);
	if (!Number.isInteger(duration) || duration < 1 || duration > 7_200_000) {
		throw new Error('--duration-ms must be an integer between 1 and 7200000 (2 hours)');
	}
	return duration;
}

function timeoutSeconds(value: string): number {
	const timeout = Number(value);
	if (!Number.isFinite(timeout) || timeout <= 0) {
		throw new Error('--timeout must be a positive number of seconds');
	}
	return timeout;
}

function printTask(task: TranscriptionTask, json: boolean): void {
	if (json) {
		printJson(task);
		return;
	}
	printDetail('Transcription task', [
		['Task ID', task.id],
		['File', task.fileName],
		['Status', task.status],
		['Reserved credits', task.reservedCredits],
		['Charged credits', task.chargedCredits],
		['Error', task.errorCode],
	]);
}

async function waitForTask(
	client: Awaited<ReturnType<typeof getTranscriptionClient>>,
	id: string,
	options: WaitOptions,
): Promise<TranscriptionTask> {
	try {
		return await pollOpenAPI({
			getStatus: async () => client.get(id),
			isDone: (task) => task.status === 'completed',
			isFailed: (task) => task.status === 'failed',
			getErrorMessage: (task) => `Transcription ${id} failed: ${task.errorCode ?? 'unknown error'}`,
			options: {
				timeout: timeoutSeconds(options.timeout),
				label: 'Transcribing',
				json: options.json,
			},
		});
	} catch (error) {
		if (error instanceof CliTimeoutError) {
			throw new CliTimeoutError(
				`${error.message}; resume with listenhub openapi transcription wait ${id}`,
			);
		}
		throw error;
	}
}

export function register(openapi: Command) {
	const transcription = openapi
		.command('transcription')
		.description('Audio/video transcription with word timestamps');

	transcription
		.command('estimate')
		.description('Estimate credits without reserving or charging them')
		.requiredOption('--duration-ms <milliseconds>', 'Source duration in milliseconds (max 2 hours)')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: JsonOptions & {durationMs: string}) => {
			try {
				const duration = durationMs(options.durationMs);
				const client = await getTranscriptionClient();
				const result = await client.estimate(duration);
				if (options.json) printJson(result);
				else
					printDetail('Transcription estimate', [
						['Duration (ms)', result.durationMs],
						['Credits', result.credits],
					]);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	transcription
		.command('upload <file>')
		.description('Upload a local audio/video file (max 50 MiB); returns its file key')
		.option('-j, --json', 'Output JSON', false)
		.action(async (file: string, options: JsonOptions) => {
			try {
				const filePath = path.resolve(file);
				const fileName = path.basename(filePath);
				const contentType = contentTypes[path.extname(filePath).toLowerCase()];
				if (!contentType)
					throw new Error(`Unsupported transcription format: ${path.extname(filePath)}`);
				const fileStat = await stat(filePath);
				if (!fileStat.isFile() || fileStat.size < 1 || fileStat.size > 50 * 1024 * 1024) {
					throw new Error('Upload requires a non-empty file of at most 50 MiB');
				}
				const buffer = await readFile(filePath);
				const fileSize = buffer.length;
				if (fileSize < 1 || fileSize > 50 * 1024 * 1024)
					throw new Error('File size changed; upload requires 1 byte to 50 MiB');
				const client = await getTranscriptionClient();
				const upload = await client.upload({fileName, contentType, fileSize});
				const response = await fetch(upload.presignedUrl, {
					method: 'PUT',
					headers: upload.headers,
					body: buffer,
				});
				if (!response.ok)
					throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
				const result = {fileKey: upload.fileKey, fileName, fileSize, contentType};
				if (options.json) printJson(result);
				else
					printDetail('Transcription upload', [
						['File key', result.fileKey],
						['File', fileName],
						['Bytes', fileSize],
					]);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	transcription
		.command('create')
		.description('Create a transcription from a previously uploaded file key')
		.requiredOption('--file-key <key>', 'File key returned by transcription upload')
		.requiredOption('--file-name <name>', 'Original filename including extension')
		.requiredOption('--duration-ms <milliseconds>', 'Source duration in milliseconds (max 2 hours)')
		.requiredOption(
			'--idempotency-key <key>',
			'Stable request identity; reuse it when retrying this creation (max 128 chars)',
		)
		.option(
			'--term <text>',
			'Recognition hint (repeatable, max 50)',
			(value: string, previous: string[]) => [...previous, value],
			[] as string[],
		)
		.option('--no-wait', 'Return the created task immediately')
		.option('--timeout <seconds>', 'Polling timeout in seconds', '1200')
		.option('-j, --json', 'Output JSON', false)
		.action(
			async (
				options: WaitOptions & {
					fileKey: string;
					fileName: string;
					durationMs: string;
					idempotencyKey: string;
					term: string[];
					wait: boolean;
				},
			) => {
				try {
					const duration = durationMs(options.durationMs);
					if (options.wait) timeoutSeconds(options.timeout);
					if (!options.idempotencyKey.trim() || options.idempotencyKey.length > 128)
						throw new Error('--idempotency-key must contain 1 to 128 characters');
					const client = await getTranscriptionClient();
					const task = await client.create({
						fileKey: options.fileKey,
						fileName: options.fileName,
						durationMs: duration,
						idempotencyKey: options.idempotencyKey,
						terms: options.term,
					});
					printTask(
						options.wait ? await waitForTask(client, task.id, options) : task,
						options.json,
					);
				} catch (error) {
					handleError(error, options.json);
				}
			},
		);

	transcription
		.command('get <taskId>')
		.description('Get the task status and reserved/charged credits')
		.option('-j, --json', 'Output JSON', false)
		.action(async (id: string, options: JsonOptions) => {
			try {
				const client = await getTranscriptionClient();
				printTask(await client.get(id), options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	transcription
		.command('wait <taskId>')
		.description('Wait for a transcription task to complete')
		.option('--timeout <seconds>', 'Polling timeout in seconds', '1200')
		.option('-j, --json', 'Output JSON', false)
		.action(async (id: string, options: WaitOptions) => {
			try {
				timeoutSeconds(options.timeout);
				const client = await getTranscriptionClient();
				printTask(await waitForTask(client, id, options), options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	transcription
		.command('transcript <taskId>')
		.description('Get completed transcript with sentence and word timestamps in milliseconds')
		.option('-j, --json', 'Output JSON', false)
		.action(async (id: string, options: JsonOptions) => {
			try {
				const client = await getTranscriptionClient();
				const result = await client.transcript(id);
				if (options.json) printJson(result);
				else console.log(result.text);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
