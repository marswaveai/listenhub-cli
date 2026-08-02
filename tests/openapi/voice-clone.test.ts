import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Command} from 'commander';
import {register as registerVoiceClone} from '../../source/openapi/voice-clone.js';

const mockClient = vi.hoisted(() => ({
	createVoiceClone: vi.fn(),
	getVoiceCloneTask: vi.fn(),
	confirmVoiceClone: vi.fn(),
	listVoiceCloneSpeakers: vi.fn(),
	getVoiceCloneSpeaker: vi.fn(),
	updateVoiceCloneSpeaker: vi.fn(),
	deleteVoiceCloneSpeaker: vi.fn(),
}));

vi.mock('../../source/openapi/client.js', () => ({
	getOpenAPIClient: vi.fn().mockResolvedValue(mockClient),
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

	tmpDir = await mkdtemp(path.join(os.tmpdir(), 'lh-cli-openapi-voice-clone-'));
	referencePath = path.join(tmpDir, 'reference.mp3');
	await writeFile(referencePath, Buffer.from([1, 2, 3, 4]));
});

afterEach(async () => {
	vi.restoreAllMocks();
	await rm(tmpDir, {recursive: true, force: true});
});

describe('openapi voice-clone create', () => {
	it('lists every supported language in --help', () => {
		const parent = makeParent();
		registerVoiceClone(parent);
		const create = parent.commands[0]!.commands[0]!;
		const help = create.helpInformation().replaceAll(/\s+/g, ' ');

		expect(help).toContain('en, zh, ja, es, pt, fr, de, tr, ko, it, th, vi');
	});

	it('requires an explicit consent declaration before any request', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit');
		}) as never);

		const parent = makeParent();
		registerVoiceClone(parent);
		await expect(
			parent.parseAsync(
				['voice-clone', 'create', '--file', referencePath, '--lang', 'en', '--no-wait'],
				{from: 'user'},
			),
		).rejects.toThrow('exit');

		expect(mockClient.createVoiceClone).not.toHaveBeenCalled();
		expect(errorSpy.mock.calls[0]![0]).toContain('--consent');
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it('sends consentConfirmed with the reference files and language', async () => {
		mockClient.createVoiceClone.mockResolvedValue({taskId: 'task-1', status: 'pending'});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(
			[
				'voice-clone',
				'create',
				'--file',
				referencePath,
				'--lang',
				'ja',
				'--consent',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);

		const params = mockClient.createVoiceClone.mock.calls[0]![0];
		expect(params.language).toBe('ja');
		expect(params.consentConfirmed).toBe(true);
		expect(params.audioFiles).toHaveLength(1);
		expect(params.audioFilenames).toEqual(['reference.mp3']);
		expect(params.autoConfirm).toBeUndefined();
		expect(params.useCredits).toBeUndefined();
	});

	it('rejects --auto-confirm without name and gender', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit');
		}) as never);

		const parent = makeParent();
		registerVoiceClone(parent);
		await expect(
			parent.parseAsync(
				[
					'voice-clone',
					'create',
					'--file',
					referencePath,
					'--lang',
					'en',
					'--consent',
					'--auto-confirm',
				],
				{from: 'user'},
			),
		).rejects.toThrow('exit');

		expect(mockClient.createVoiceClone).not.toHaveBeenCalled();
		expect(errorSpy.mock.calls[0]![0]).toContain('--auto-confirm requires');
	});

	it('forwards the auto-confirm fields and the credit authorization', async () => {
		mockClient.createVoiceClone.mockResolvedValue({taskId: 'task-1', status: 'pending'});
		mockClient.getVoiceCloneTask.mockResolvedValue({
			status: 'completed',
			demoAudioUrl: 'https://cdn.test/demo.mp3',
			speakerId: 'voice-clone-1',
		});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(
			[
				'voice-clone',
				'create',
				'--file',
				referencePath,
				'--lang',
				'en',
				'--consent',
				'--auto-confirm',
				'--name',
				'API Voice',
				'--gender',
				'other',
				'--use-credits',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.createVoiceClone.mock.calls[0]![0]).toMatchObject({
			consentConfirmed: true,
			autoConfirm: true,
			name: 'API Voice',
			gender: 'other',
			useCredits: true,
		});
		expect(consoleSpy).toHaveBeenCalledWith(
			JSON.stringify(
				{
					taskId: 'task-1',
					status: 'completed',
					demoAudioUrl: 'https://cdn.test/demo.mp3',
					speakerId: 'voice-clone-1',
				},
				null,
				2,
			),
		);
	});

	it('surfaces the failed terminal shape from the response body', async () => {
		mockClient.createVoiceClone.mockResolvedValue({taskId: 'task-1', status: 'pending'});
		mockClient.getVoiceCloneTask.mockResolvedValue({
			status: 'failed',
			errorCode: 30003,
			errorMessage: 'No voice detected',
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit');
		}) as never);

		const parent = makeParent();
		registerVoiceClone(parent);
		await expect(
			parent.parseAsync(
				['voice-clone', 'create', '--file', referencePath, '--lang', 'en', '--consent'],
				{from: 'user'},
			),
		).rejects.toThrow('exit');

		expect(errorSpy.mock.calls[0]![0]).toContain('No voice detected');
	});
});

describe('openapi voice-clone task and speaker commands', () => {
	it('gets a task, keeping the confirm error visible', async () => {
		mockClient.getVoiceCloneTask.mockResolvedValue({
			status: 'completed',
			demoAudioUrl: 'https://cdn.test/demo.mp3',
			confirmError: 'Saving this voice requires 300 credits.',
		});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(['voice-clone', 'get', 'task-1'], {from: 'user'});

		expect(mockClient.getVoiceCloneTask).toHaveBeenCalledWith('task-1');
		expect(consoleSpy.mock.calls.flat().join('\n')).toContain('300 credits');
	});

	it('confirms a task and prints the returned speakerId', async () => {
		mockClient.confirmVoiceClone.mockResolvedValue({speakerId: 'voice-clone-1'});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(
			['voice-clone', 'confirm', '--task-id', 'task-1', '--name', 'API Voice', '--gender', 'male'],
			{from: 'user'},
		);

		expect(mockClient.confirmVoiceClone).toHaveBeenCalledWith({
			taskId: 'task-1',
			name: 'API Voice',
			gender: 'male',
			useCredits: false,
		});
		expect(consoleSpy.mock.calls.flat().join('\n')).toContain('voice-clone-1');
	});

	it('lists, gets, updates and deletes speakers', async () => {
		mockClient.listVoiceCloneSpeakers.mockResolvedValue({
			speakers: [],
			quota: 5,
			isLimitReached: false,
			maxSpeakers: 5,
			remainingConfirmations: 5,
		});
		mockClient.getVoiceCloneSpeaker.mockResolvedValue({
			id: 'sp-1',
			speakerInnerId: 'voice-clone-1',
		});
		mockClient.updateVoiceCloneSpeaker.mockResolvedValue({id: 'sp-1', name: 'Renamed'});
		mockClient.deleteVoiceCloneSpeaker.mockResolvedValue({speakerId: 'sp-1'});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVoiceClone(parent);
		await parent.parseAsync(['voice-clone', 'speakers', '--json'], {from: 'user'});
		await parent.parseAsync(['voice-clone', 'speaker', 'sp-1', '--json'], {from: 'user'});
		await parent.parseAsync(['voice-clone', 'update', 'sp-1', '--gender', 'female', '--json'], {
			from: 'user',
		});
		await parent.parseAsync(['voice-clone', 'delete', 'sp-1', '--json'], {from: 'user'});

		expect(mockClient.listVoiceCloneSpeakers).toHaveBeenCalledTimes(1);
		expect(mockClient.getVoiceCloneSpeaker).toHaveBeenCalledWith('sp-1');
		expect(mockClient.updateVoiceCloneSpeaker).toHaveBeenCalledWith('sp-1', {gender: 'female'});
		expect(mockClient.deleteVoiceCloneSpeaker).toHaveBeenCalledWith('sp-1');
	});
});
