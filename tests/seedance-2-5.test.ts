import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Command} from 'commander';
import {createVideo, estimateCredits, type VideoCreateOptions} from '../source/video/video.js';
import {register as registerOpenAPIVideo} from '../source/openapi/video.js';

const client = vi.hoisted(() => ({
	createVideoGeneration: vi.fn(),
	createBananaVideoGeneration: vi.fn(),
	estimateVideoGenerationCredits: vi.fn(),
	estimateVideoCredits: vi.fn(),
}));
vi.mock('../source/openapi/client.js', () => ({
	getOpenAPIClient: vi.fn().mockResolvedValue(client),
}));
vi.mock('../source/_shared/upload.js', () => ({
	resolveFileOrUrl: vi.fn(async (_client, url: string) => url),
}));
const taskId = '6a2016607ebd26d050c585ca';
const model = 'doubao-seedance-2-5';
function options(overrides: Partial<VideoCreateOptions> = {}): VideoCreateOptions {
	return {
		model,
		prompt: 'Generate a video',
		referenceImage: [],
		referenceImageMeta: [],
		referenceVideo: [],
		referenceVideoMeta: [],
		referenceAudio: [],
		generateAudio: true,
		wait: false,
		timeout: 1200,
		json: true,
		...overrides,
	};
}
beforeEach(() => {
	vi.clearAllMocks();
	client.createVideoGeneration.mockResolvedValue({taskId});
	client.createBananaVideoGeneration.mockResolvedValue({taskId});
	client.estimateVideoCredits.mockResolvedValue({estimatedCostUsd: 1.3, tokens: 108000});
	client.estimateVideoGenerationCredits.mockResolvedValue({credits: 143, tokens: 108000});
	vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('Seedance 2.5 requests', () => {
	it.each(['listenhub', 'labnana'] as const)(
		'sends audio-only draft with metadata on %s',
		async (surface) => {
			await createVideo(
				client as never,
				options({
					draft: true,
					resolution: '480p',
					referenceAudio: ['https://example.com/a.mp3', 'https://example.com/b.wav'],
					referenceAudioMeta: ['5:300000', '7:500000'],
					requestId: 'draft-request',
				}),
				surface,
			);
			const method =
				surface === 'labnana' ? client.createBananaVideoGeneration : client.createVideoGeneration;
			expect(method).toHaveBeenCalledWith(
				expect.objectContaining({
					draft: true,
					resolution: '480p',
					requestId: 'draft-request',
					content: [
						{type: 'text', text: 'Generate a video'},
						{
							type: 'audio_url',
							audio_url: {url: 'https://example.com/a.mp3', duration: 5, size: 300000},
							role: 'reference_audio',
						},
						{
							type: 'audio_url',
							audio_url: {url: 'https://example.com/b.wav', duration: 7, size: 500000},
							role: 'reference_audio',
						},
					],
				}),
			);
		},
	);
	it.each(['listenhub', 'labnana'] as const)(
		'rejects 2.5 audio metadata on 2.0 before submission on %s',
		async (surface) => {
			await expect(
				createVideo(
					client as never,
					options({
						model: 'doubao-seedance-2-pro',
						referenceImage: ['https://example.com/a.png'],
						referenceImageMeta: ['1280x720'],
						referenceAudio: ['https://example.com/a.mp3'],
						referenceAudioMeta: ['5:300000'],
					}),
					surface,
				),
			).rejects.toThrow('--reference-audio-meta requires --model doubao-seedance-2-5');
			expect(client.createVideoGeneration).not.toHaveBeenCalled();
			expect(client.createBananaVideoGeneration).not.toHaveBeenCalled();
		},
	);
	it('OpenAPI rejects 2.5 audio metadata on 2.0 before submission', async () => {
		const parent = new Command().exitOverride();
		const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('CLI exit');
		});
		registerOpenAPIVideo(parent);
		await expect(
			parent.parseAsync(
				[
					'video',
					'create',
					'--model',
					'doubao-seedance-2-pro',
					'--prompt',
					'Follow music',
					'--reference-image',
					'https://example.com/a.png',
					'--reference-image-meta',
					'1280x720',
					'--reference-audio',
					'https://example.com/a.mp3',
					'--reference-audio-meta',
					'5:300000',
					'--no-wait',
					'--json',
				],
				{from: 'user'},
			),
		).rejects.toThrow('CLI exit');
		expect(stderr).toHaveBeenCalledWith(
			expect.stringContaining('--reference-audio-meta requires --model doubao-seedance-2-5'),
		);
		expect(client.createVideoGeneration).not.toHaveBeenCalled();
	});
	it.each(['doubao-seedance-2-pro', 'doubao-seedance-2-fast'])(
		'preserves URL-only audio references for %s',
		async (selectedModel) => {
			await createVideo(
				client as never,
				options({
					model: selectedModel,
					referenceImage: ['https://example.com/a.png'],
					referenceImageMeta: ['1280x720'],
					referenceAudio: ['https://example.com/a.mp3'],
				}),
			);
			expect(client.createVideoGeneration).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.arrayContaining([
						{
							type: 'audio_url',
							audio_url: {url: 'https://example.com/a.mp3'},
							role: 'reference_audio',
						},
					]),
				}),
			);
		},
	);
	it('accepts all 50 references plus prompt without dropping assets', async () => {
		await createVideo(
			client as never,
			options({
				referenceImage: Array.from({length: 30}, (_, i) => `https://example.com/${i}.png`),
				referenceImageMeta: Array(30).fill('1280x720'),
				referenceVideo: Array.from({length: 10}, (_, i) => `https://example.com/${i}.mp4`),
				referenceVideoMeta: Array(10).fill('1280x720:3:24:1000000'),
				referenceAudio: Array.from({length: 10}, (_, i) => `https://example.com/${i}.mp3`),
				referenceAudioMeta: Array(10).fill('3:100000'),
			}),
		);
		const params = client.createVideoGeneration.mock.calls[0]![0];
		expect(params.content).toHaveLength(51);
		expect(params.inputVideoDuration).toBe(30);
	});
	it('sums different-sized input videos and forwards edit auto parameters', async () => {
		await createVideo(
			client as never,
			options({
				referenceVideo: ['https://example.com/a.mp4', 'https://example.com/b.mp4'],
				referenceVideoMeta: ['1280x720:4:24:8000000', '720x1280:7:30:9000000'],
				omniReferenceTaskType: 'edit',
				ratio: 'adaptive',
				duration: -1,
			}),
		);
		expect(client.createVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				inputVideoDuration: 11,
				omniReferenceTaskType: 'edit',
				ratio: 'adaptive',
				duration: -1,
				referenceVideos: [
					expect.objectContaining({width: 1280, duration: 4}),
					expect.objectContaining({width: 720, duration: 7}),
				],
			}),
		);
	});
	it('sends only draft reference and idempotency key for final', async () => {
		await createVideo(
			client as never,
			options({prompt: undefined, draftTaskId: taskId, requestId: 'final-request'}),
		);
		expect(client.createVideoGeneration).toHaveBeenCalledWith({
			model,
			draftTaskId: taskId,
			requestId: 'final-request',
		});
	});
	it('rejects overriding inherited final parameters', async () => {
		await expect(createVideo(client as never, options({draftTaskId: taskId}))).rejects.toThrow(
			/inherits/,
		);
		expect(client.createVideoGeneration).not.toHaveBeenCalled();
	});
	it.each([
		{prompt: 'a'.repeat(5001)},
		{referenceAudio: ['a.mp3'], referenceAudioMeta: ['31']},
		{referenceAudio: ['a.mp3', 'b.mp3'], referenceAudioMeta: ['16', '16']},
		{
			referenceVideo: ['a.mp4'],
			referenceVideoMeta: ['1280x720:3:24'],
			omniReferenceTaskType: 'edit',
			duration: -1,
			ratio: 'adaptive',
		},
		{
			referenceImage: Array.from({length: 31}, (_, i) => `https://example.com/${i}.png`),
			referenceImageMeta: Array(31).fill('1280x720'),
		},
	])('rejects 2.5 boundary violations before upload/submission: %j', async (overrides) => {
		await expect(createVideo(client as never, options(overrides))).rejects.toThrow();
		expect(client.createVideoGeneration).not.toHaveBeenCalled();
	});
	it('accepts 5000 characters and 30 second output', async () => {
		await createVideo(client as never, options({prompt: 'a'.repeat(5000), duration: 30}));
		expect(client.createVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({duration: 30}),
		);
	});
	it.each([
		{duration: 30},
		{referenceAudio: ['https://example.com/a.mp3']},
		{ratio: 'adaptive'},
		{draft: true, resolution: '480p'},
		{prompt: 'a'.repeat(3001)},
	])('preserves Seedance 2.0 restrictions: %j', async (overrides) => {
		await expect(
			createVideo(client as never, options({model: 'doubao-seedance-2-pro', ...overrides})),
		).rejects.toThrow();
	});
	it.each([
		['doubao-seedance-2-pro', 'a'],
		['doubao-seedance-2-fast', 'a'],
		['doubao-seedance-2-pro', '字'],
		['doubao-seedance-2-fast', '字'],
	])('validates the 3000-character boundary for %s using %s', async (selectedModel, character) => {
		const prompt = character.repeat(3000);
		await createVideo(client as never, options({model: selectedModel, prompt}));
		expect(client.createVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				model: selectedModel,
				content: expect.arrayContaining([{type: 'text', text: prompt}]),
			}),
		);
		client.createVideoGeneration.mockClear();
		await expect(
			createVideo(client as never, options({model: selectedModel, prompt: prompt + character})),
		).rejects.toThrow('3000');
		expect(client.createVideoGeneration).not.toHaveBeenCalled();
	});
	it('estimates a final without inventing output duration or original inputs', async () => {
		await estimateCredits(client as never, {
			model,
			draftTaskId: taskId,
			hasVideoInput: false,
			referenceImageMeta: [],
			referenceVideoMeta: [],
			json: true,
		});
		expect(client.estimateVideoGenerationCredits).toHaveBeenCalledWith({
			model,
			draftTaskId: taskId,
		});
	});
	it('OpenAPI commander accepts final generation without prompt', async () => {
		const parent = new Command().exitOverride();
		registerOpenAPIVideo(parent);
		await parent.parseAsync(
			[
				'video',
				'create',
				'--model',
				model,
				'--draft-task-id',
				taskId,
				'--request-id',
				'final-request',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);
		expect(client.createVideoGeneration).toHaveBeenCalledWith({
			model,
			draftTaskId: taskId,
			requestId: 'final-request',
		});
	});
	it('OpenAPI commander accepts pure audio and a 30 second output', async () => {
		const parent = new Command().exitOverride();
		registerOpenAPIVideo(parent);
		await parent.parseAsync(
			[
				'video',
				'create',
				'--model',
				model,
				'--prompt',
				'Follow music',
				'--duration',
				'30',
				'--reference-audio',
				'https://example.com/a.mp3',
				'--reference-audio-meta',
				'5:300000',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);
		expect(client.createVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				duration: 30,
				content: [
					{type: 'text', text: 'Follow music'},
					{
						type: 'audio_url',
						audio_url: {url: 'https://example.com/a.mp3', duration: 5, size: 300000},
						role: 'reference_audio',
					},
				],
			}),
		);
	});
	it('OpenAPI commander estimates final without duration/resolution', async () => {
		const parent = new Command().exitOverride();
		registerOpenAPIVideo(parent);
		await parent.parseAsync(
			['video', 'estimate', '--model', model, '--draft-task-id', taskId, '--json'],
			{from: 'user'},
		);
		expect(client.estimateVideoCredits).toHaveBeenCalledWith({model, draftTaskId: taskId});
	});
});
