import {mkdtemp, rm, truncate, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {Command} from 'commander';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ListenHubError} from '@marswave/listenhub-sdk';
import {register} from '../../source/openapi/transcription.js';

const client = vi.hoisted(() => ({
	estimate: vi.fn(),
	upload: vi.fn(),
	create: vi.fn(),
	get: vi.fn(),
	transcript: vi.fn(),
}));
vi.mock('../../source/openapi/transcription-client.js', () => ({
	getTranscriptionClient: vi.fn().mockResolvedValue(client),
}));

const task = {
	id: 'task-1',
	status: 'queued',
	fileName: 'voice.wav',
	originalDurationMs: 1200,
	speechDurationMs: 0,
	reservedCredits: 1,
	chargedCredits: 0,
};
const transcript = {
	text: 'Hello!',
	originalDurationMs: 1200,
	speechDurationMs: 700,
	channels: [0],
	detectedLanguage: 'en',
	model: 'qwen-audio-3.0-asr-flash-filetrans',
	region: 'cn-beijing',
	sentences: [
		{
			startMs: 100,
			endMs: 800,
			text: 'Hello!',
			speakerId: 0,
			words: [{startMs: 100, endMs: 800, text: 'Hello', punctuation: '!', confidence: 0.96}],
		},
	],
};
let tempDirectory: string;
let filePath: string;
let output: ReturnType<typeof vi.spyOn>;
let errors: ReturnType<typeof vi.spyOn>;
let exits: ReturnType<typeof vi.spyOn>;

async function run(args: string[]) {
	const command = new Command().exitOverride();
	register(command);
	await command.parseAsync(['transcription', ...args], {from: 'user'});
}

function createArgs(...extra: string[]) {
	return [
		'create',
		'--file-key',
		'uploads/source.wav',
		'--file-name',
		'voice.wav',
		'--duration-ms',
		'1200',
		'--idempotency-key',
		'stable-identity',
		...extra,
	];
}

beforeEach(async () => {
	for (const method of Object.values(client)) method.mockReset();
	tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'transcription-cli-'));
	filePath = path.join(tempDirectory, 'voice.wav');
	await writeFile(filePath, 'audio-fixture');
	output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	exits = vi.spyOn(process, 'exit').mockImplementation((() => {
		throw new Error('exit');
	}) as never);
});

afterEach(async () => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	await rm(tempDirectory, {recursive: true, force: true});
});

describe('transcription CLI', () => {
	it('estimates duration without creating a task', async () => {
		client.estimate.mockResolvedValue({durationMs: 60001, credits: 2});
		await run(['estimate', '--duration-ms', '60001', '--json']);
		expect(client.estimate).toHaveBeenCalledWith(60001);
		expect(client.create).not.toHaveBeenCalled();
		expect(output).toHaveBeenCalledWith(JSON.stringify({durationMs: 60001, credits: 2}, null, 2));
	});

	it.each(['0', '-1', '1.5', 'NaN', 'Infinity', '7200001'])(
		'rejects invalid duration %s before calling API',
		async (duration) => {
			await expect(run(['estimate', '--duration-ms', duration, '--json'])).rejects.toThrow('exit');
			expect(client.estimate).not.toHaveBeenCalled();
			expect(exits).toHaveBeenCalledWith(1);
		},
	);

	it('uploads the bytes with the exact signed headers and prints only reusable metadata', async () => {
		const headers = {'Content-Type': 'audio/wav', 'x-goog-meta-purpose': 'transcription'};
		client.upload.mockResolvedValue({
			fileKey: 'owned/source.wav',
			presignedUrl: 'https://storage.test/signed-secret',
			fileUrl: 'https://storage.test/source.wav',
			headers,
		});
		const fetch = vi.fn().mockResolvedValue(new Response('', {status: 200}));
		vi.stubGlobal('fetch', fetch);
		await run(['upload', filePath, '--json']);
		expect(client.upload).toHaveBeenCalledWith({
			fileName: 'voice.wav',
			contentType: 'audio/wav',
			fileSize: 13,
		});
		expect(fetch).toHaveBeenCalledWith('https://storage.test/signed-secret', {
			method: 'PUT',
			headers,
			body: Buffer.from('audio-fixture'),
		});
		expect(output).toHaveBeenCalledWith(
			JSON.stringify(
				{
					fileKey: 'owned/source.wav',
					fileName: 'voice.wav',
					fileSize: 13,
					contentType: 'audio/wav',
				},
				null,
				2,
			),
		);
		expect(client.create).not.toHaveBeenCalled();
	});

	it.each([0, 50 * 1024 * 1024 + 1])(
		'rejects files of %s bytes before requesting an upload',
		async (size) => {
			await truncate(filePath, size);
			await expect(run(['upload', filePath, '--json'])).rejects.toThrow('exit');
			expect(client.upload).not.toHaveBeenCalled();
			expect(exits).toHaveBeenCalledWith(1);
		},
	);

	it('reports a failed upload and does not emit a usable file key', async () => {
		client.upload.mockResolvedValue({
			fileKey: 'owned/source.wav',
			presignedUrl: 'https://storage.test/source',
			headers: {'Content-Type': 'audio/wav'},
		});
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('', {status: 403, statusText: 'Forbidden'})),
		);
		await expect(run(['upload', filePath, '--json'])).rejects.toThrow('exit');
		expect(output).not.toHaveBeenCalled();
		expect(errors.mock.calls[0]![0]).toContain('Upload failed: 403 Forbidden');
	});

	it('preserves caller idempotency key, hints and reservation in create --no-wait output', async () => {
		client.create.mockResolvedValue(task);
		await run(createArgs('--term', 'ListenHub', '--term', 'Hypit', '--no-wait', '--json'));
		expect(client.create).toHaveBeenCalledWith({
			fileKey: 'uploads/source.wav',
			fileName: 'voice.wav',
			durationMs: 1200,
			idempotencyKey: 'stable-identity',
			terms: ['ListenHub', 'Hypit'],
		});
		expect(client.get).not.toHaveBeenCalled();
		expect(output).toHaveBeenCalledWith(JSON.stringify(task, null, 2));
	});

	it('validates polling timeout before creating a paid task', async () => {
		await expect(run(createArgs('--timeout', 'NaN', '--json'))).rejects.toThrow('exit');
		expect(client.create).not.toHaveBeenCalled();
	});

	it('waits for create completion and preserves transcript evidence', async () => {
		client.create.mockResolvedValue(task);
		const completed = {...task, status: 'completed', chargedCredits: 1, result: transcript};
		client.get.mockResolvedValue(completed);
		await run(createArgs('--json'));
		expect(client.get).toHaveBeenCalledWith('task-1');
		expect(output).toHaveBeenCalledTimes(1);
		expect(output).toHaveBeenCalledWith(JSON.stringify(completed, null, 2));
	});

	it('gets a task without polling and returns all server fields', async () => {
		const result = {...task, submissionState: 'pending'};
		client.get.mockResolvedValue(result);
		await run(['get', 'task-1', '--json']);
		expect(client.get).toHaveBeenCalledTimes(1);
		expect(output).toHaveBeenCalledWith(JSON.stringify(result, null, 2));
	});

	it('returns completed tasks from wait', async () => {
		const completed = {...task, status: 'completed', result: transcript};
		client.get.mockResolvedValue(completed);
		await run(['wait', 'task-1', '--json']);
		expect(output).toHaveBeenCalledWith(JSON.stringify(completed, null, 2));
	});

	it('surfaces task failure and preserves a recoverable task ID', async () => {
		client.get.mockResolvedValue({...task, status: 'failed', errorCode: 'provider_failed'});
		await expect(run(['wait', 'task-1', '--json'])).rejects.toThrow('exit');
		expect(errors.mock.calls[0]![0]).toContain('Transcription task-1 failed: provider_failed');
		expect(exits).toHaveBeenCalledWith(1);
	});

	it('uses timeout exit code 3 while leaving a task available to wait again', async () => {
		client.get.mockResolvedValue({...task, status: 'transcribing'});
		await expect(run(['wait', 'task-1', '--timeout', '1', '--json'])).rejects.toThrow('exit');
		expect(exits).toHaveBeenCalledWith(3);
		expect(client.create).not.toHaveBeenCalled();
	});

	it('preserves the raw sentence/word transcript including confidence and speaker 0', async () => {
		client.transcript.mockResolvedValue(transcript);
		await run(['transcript', 'task-1', '--json']);
		expect(client.transcript).toHaveBeenCalledWith('task-1');
		expect(output).toHaveBeenCalledWith(JSON.stringify(transcript, null, 2));
	});

	it('maps SDK authentication failures to JSON stderr and exit 2', async () => {
		client.get.mockRejectedValue(
			new ListenHubError({status: 401, code: '401', message: 'Invalid key', requestId: 'req-1'}),
		);
		await expect(run(['get', 'task-1', '--json'])).rejects.toThrow('exit');
		expect(output).not.toHaveBeenCalled();
		expect(JSON.parse(errors.mock.calls[0]![0] as string)).toEqual({
			error: 'Invalid key',
			code: '401',
			requestId: 'req-1',
		});
		expect(exits).toHaveBeenCalledWith(2);
	});
});
