import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Command} from 'commander';
import {register as registerVoiceClone} from '../source/voice-clone/_cli.js';

const mockClient = vi.hoisted(() => ({
	createVoiceClone: vi.fn(),
	getVoiceCloneTask: vi.fn(),
	confirmVoiceClone: vi.fn(),
	listVoiceCloneSpeakers: vi.fn(),
	getVoiceCloneSpeaker: vi.fn(),
	updateVoiceCloneSpeaker: vi.fn(),
	deleteVoiceCloneSpeaker: vi.fn(),
}));

vi.mock('../source/_shared/client.js', () => ({
	getClient: vi.fn().mockResolvedValue(mockClient),
}));

vi.mock('ora', () => ({
	default: () => ({start: () => ({text: '', succeed: vi.fn(), fail: vi.fn()})}),
}));

function makeParent(): Command {
	const parent = new Command();
	parent.exitOverride();
	return parent;
}

let tmpDir: string;
let referencePath: string;

beforeEach(async () => {
	for (const fn of Object.values(mockClient)) {
		fn.mockReset();
	}

	tmpDir = await mkdtemp(path.join(os.tmpdir(), 'lh-cli-voice-clone-'));
	referencePath = path.join(tmpDir, 'reference.mp3');
	await writeFile(referencePath, Buffer.from([1, 2, 3, 4]));
});

afterEach(async () => {
	vi.restoreAllMocks();
	await rm(tmpDir, {recursive: true, force: true});
});

describe('voice-clone create', () => {
	it('lists every supported language in --help', () => {
		const parent = makeParent();
		registerVoiceClone(parent);
		const create = parent.commands[0]!.commands[0]!;
		const help = create.helpInformation().replaceAll(/\s+/g, ' ');

		expect(help).toContain('en, zh, ja, es, pt, fr, de, tr, ko, it, th, vi');
	});

	it('sends every reference file with the language and skips polling with --no-wait', async () => {
		mockClient.createVoiceClone.mockResolvedValue({taskId: 'task-1', status: 'pending'});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const second = path.join(tmpDir, 'second.wav');
		await writeFile(second, Buffer.from([5, 6]));

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(
			[
				'voice-clone',
				'create',
				'--file',
				referencePath,
				second,
				'--lang',
				'zh',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);

		const params = mockClient.createVoiceClone.mock.calls[0]![0];
		expect(params.language).toBe('zh');
		expect(params.audioFiles).toHaveLength(2);
		expect(params.audioFiles[0]).toBeInstanceOf(Blob);
		expect(params.audioFilenames).toEqual(['reference.mp3', 'second.wav']);
		expect(mockClient.getVoiceCloneTask).not.toHaveBeenCalled();
		expect(consoleSpy).toHaveBeenCalledWith(
			JSON.stringify({taskId: 'task-1', status: 'pending'}, null, 2),
		);
	});

	it('polls until the clone completes and reports the preview', async () => {
		mockClient.createVoiceClone.mockResolvedValue({taskId: 'task-1', status: 'pending'});
		mockClient.getVoiceCloneTask.mockResolvedValue({
			status: 'completed',
			demoAudioUrl: 'https://cdn.test/demo.mp3',
		});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(
			['voice-clone', 'create', '--file', referencePath, '--lang', 'en', '--json'],
			{from: 'user'},
		);

		expect(mockClient.getVoiceCloneTask).toHaveBeenCalledWith('task-1');
		expect(consoleSpy).toHaveBeenCalledWith(
			JSON.stringify(
				{taskId: 'task-1', status: 'completed', demoAudioUrl: 'https://cdn.test/demo.mp3'},
				null,
				2,
			),
		);
	});

	it('fails before any request when a reference file is missing', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit');
		}) as never);

		const parent = makeParent();
		registerVoiceClone(parent);
		await expect(
			parent.parseAsync(
				['voice-clone', 'create', '--file', path.join(tmpDir, 'nope.mp3'), '--lang', 'zh'],
				{from: 'user'},
			),
		).rejects.toThrow('exit');

		expect(mockClient.createVoiceClone).not.toHaveBeenCalled();
		expect(errorSpy.mock.calls[0]![0]).toContain('File not found');
		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});

describe('voice-clone task and speaker commands', () => {
	it('gets a task', async () => {
		mockClient.getVoiceCloneTask.mockResolvedValue({status: 'processing'});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(['voice-clone', 'get', 'task-1', '--json'], {from: 'user'});

		expect(mockClient.getVoiceCloneTask).toHaveBeenCalledWith('task-1');
	});

	it('confirms a task, defaulting useCredits to false', async () => {
		mockClient.confirmVoiceClone.mockResolvedValue(undefined);
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(
			['voice-clone', 'confirm', '--task-id', 'task-1', '--name', 'My Voice', '--gender', 'female'],
			{from: 'user'},
		);

		expect(mockClient.confirmVoiceClone).toHaveBeenCalledWith({
			taskId: 'task-1',
			name: 'My Voice',
			gender: 'female',
			useCredits: false,
		});
	});

	it('passes --use-credits through as the explicit charge authorization', async () => {
		mockClient.confirmVoiceClone.mockResolvedValue(undefined);
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(
			[
				'voice-clone',
				'confirm',
				'--task-id',
				'task-1',
				'--name',
				'My Voice',
				'--gender',
				'male',
				'--use-credits',
			],
			{from: 'user'},
		);

		expect(mockClient.confirmVoiceClone.mock.calls[0]![0].useCredits).toBe(true);
	});

	it('lists speakers with quota', async () => {
		mockClient.listVoiceCloneSpeakers.mockResolvedValue({
			speakers: [
				{
					id: 'sp-1',
					name: 'My Voice',
					speakerInnerId: 'voice-clone-1',
					language: 'zh',
					gender: 'female',
					createdAt: '2026-07-30T00:00:00.000Z',
				},
			],
			quota: 2,
			isLimitReached: false,
			maxSpeakers: 2,
			remainingConfirmations: 1,
		});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(['voice-clone', 'speakers', '--json'], {from: 'user'});

		expect(mockClient.listVoiceCloneSpeakers).toHaveBeenCalledTimes(1);
	});

	it('gets, updates and deletes one speaker', async () => {
		mockClient.getVoiceCloneSpeaker.mockResolvedValue({id: 'sp-1', name: 'My Voice'});
		mockClient.updateVoiceCloneSpeaker.mockResolvedValue({id: 'sp-1', name: 'Renamed'});
		mockClient.deleteVoiceCloneSpeaker.mockResolvedValue({speakerId: 'sp-1'});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(['voice-clone', 'speaker', 'sp-1', '--json'], {from: 'user'});
		await parent.parseAsync(['voice-clone', 'update', 'sp-1', '--name', 'Renamed', '--json'], {
			from: 'user',
		});
		await parent.parseAsync(['voice-clone', 'delete', 'sp-1', '--json'], {from: 'user'});

		expect(mockClient.getVoiceCloneSpeaker).toHaveBeenCalledWith('sp-1');
		expect(mockClient.updateVoiceCloneSpeaker).toHaveBeenCalledWith('sp-1', {name: 'Renamed'});
		expect(mockClient.deleteVoiceCloneSpeaker).toHaveBeenCalledWith('sp-1');
	});

	it('rejects an update with neither name nor gender', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit');
		}) as never);

		const parent = makeParent();
		registerVoiceClone(parent);
		await expect(
			parent.parseAsync(['voice-clone', 'update', 'sp-1'], {from: 'user'}),
		).rejects.toThrow('exit');

		expect(mockClient.updateVoiceCloneSpeaker).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});
