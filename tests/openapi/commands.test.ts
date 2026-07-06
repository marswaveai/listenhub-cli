import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Command} from 'commander';
import {register as registerSpeakers} from '../../source/openapi/speakers.js';
import {register as registerSubscription} from '../../source/openapi/subscription.js';
import {register as registerContent} from '../../source/openapi/content.js';
import {register as registerVideo} from '../../source/openapi/video.js';
import {register as registerStorybook} from '../../source/openapi/storybook.js';

// vi.hoisted ensures these are available when vi.mock factory runs (which is hoisted to top)
const mockClient = vi.hoisted(() => ({
	listSpeakers: vi.fn(),
	speech: vi.fn(),
	createFlowSpeech: vi.fn(),
	getFlowSpeech: vi.fn(),
	createPodcast: vi.fn(),
	getPodcast: vi.fn(),
	createPodcastTextContent: vi.fn(),
	generatePodcastAudio: vi.fn(),
	createStorybook: vi.fn(),
	getStorybook: vi.fn(),
	generateStorybookVideo: vi.fn(),
	createImage: vi.fn(),
	createVideoGeneration: vi.fn(),
	getVideoGenerationTask: vi.fn(),
	listVideoGenerationTasks: vi.fn(),
	estimateVideoCredits: vi.fn(),
	createPixVerseVideoGeneration: vi.fn(),
	estimatePixVerseVideoCredits: vi.fn(),
	createContentExtract: vi.fn(),
	getContentExtract: vi.fn(),
	getSubscription: vi.fn(),
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

beforeEach(() => {
	// Only reset call counts, not implementations
	for (const fn of Object.values(mockClient)) {
		fn.mockReset();
	}
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('speakers list', () => {
	it('calls listSpeakers without filter and prints JSON', async () => {
		const items = [{name: 'Alice', speakerId: 'alice-01', gender: 'female', language: 'en'}];
		mockClient.listSpeakers.mockResolvedValue({items});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerSpeakers(parent);

		await parent.parseAsync(['speakers', 'list', '--json'], {from: 'user'});

		expect(mockClient.listSpeakers).toHaveBeenCalledWith({language: undefined});
		expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(items, null, 2));
	});

	it('passes language filter to listSpeakers', async () => {
		mockClient.listSpeakers.mockResolvedValue({items: []});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerSpeakers(parent);

		await parent.parseAsync(['speakers', 'list', '--language', 'zh', '--json'], {from: 'user'});

		expect(mockClient.listSpeakers).toHaveBeenCalledWith({language: 'zh'});
		expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify([], null, 2));
	});
});

describe('subscription', () => {
	it('calls getSubscription and prints JSON', async () => {
		const subscriptionData = {
			totalAvailableCredits: 500,
			usageAvailableMonthlyCredits: 200,
			usageTotalMonthlyCredits: 300,
			usageAvailablePermanentCredits: 300,
		};
		mockClient.getSubscription.mockResolvedValue(subscriptionData);
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerSubscription(parent);

		await parent.parseAsync(['subscription', '--json'], {from: 'user'});

		expect(mockClient.getSubscription).toHaveBeenCalledTimes(1);
		expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(subscriptionData, null, 2));
	});
});

describe('content extract', () => {
	it('calls createContentExtract with URL and --no-wait, prints taskId JSON', async () => {
		mockClient.createContentExtract.mockResolvedValue({taskId: 'task-abc'});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerContent(parent);

		await parent.parseAsync(
			['content', 'extract', '--url', 'https://example.com', '--no-wait', '--json'],
			{from: 'user'},
		);

		expect(mockClient.createContentExtract).toHaveBeenCalledWith({
			source: {type: 'url', uri: 'https://example.com'},
			options: {
				summarize: undefined,
				maxLength: undefined,
			},
		});
		expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({taskId: 'task-abc'}, null, 2));
	});

	it('passes summarize option to createContentExtract', async () => {
		mockClient.createContentExtract.mockResolvedValue({taskId: 'task-xyz'});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerContent(parent);

		await parent.parseAsync(
			['content', 'extract', '--url', 'https://example.com', '--summarize', '--no-wait', '--json'],
			{from: 'user'},
		);

		expect(mockClient.createContentExtract).toHaveBeenCalledWith({
			source: {type: 'url', uri: 'https://example.com'},
			options: {
				summarize: true,
				maxLength: undefined,
			},
		});
	});
});

describe('video create', () => {
	it('builds content array from --prompt and creates task with --no-wait', async () => {
		mockClient.createVideoGeneration.mockResolvedValue({taskId: '6a2016607ebd26d050c585ca'});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			['video', 'create', '--prompt', 'A sunset over the ocean', '--no-wait', '--json'],
			{from: 'user'},
		);

		expect(mockClient.createVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				content: [{type: 'text', text: 'A sunset over the ocean'}],
			}),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			JSON.stringify({taskId: '6a2016607ebd26d050c585ca'}, null, 2),
		);
	});

	it('includes first-frame in content array when provided', async () => {
		mockClient.createVideoGeneration.mockResolvedValue({taskId: '6a201660b9fc373811288f09'});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			[
				'video',
				'create',
				'--prompt',
				'Timelapse',
				'--first-frame',
				'https://img.example.com/frame.jpg',
				'--first-frame-meta',
				'1080x1920:3600000',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.createVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				content: [
					{type: 'text', text: 'Timelapse'},
					{
						type: 'image_url',
						image_url: {url: 'https://img.example.com/frame.jpg'},
						role: 'first_frame',
					},
				],
				referenceImages: [{role: 'first_frame', width: 1080, height: 1920, size: 3_600_000}],
			}),
		);
	});

	it('includes reference video metadata when provided', async () => {
		mockClient.createVideoGeneration.mockResolvedValue({taskId: '6a201660b9fc373811288f10'});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			[
				'video',
				'create',
				'--prompt',
				'Restyle this clip',
				'--reference-video',
				'https://video.example.com/ref.mp4',
				'--reference-video-meta',
				'1280x720:5:30:8000000',
				'--input-video-duration',
				'5',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.createVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				content: [
					{type: 'text', text: 'Restyle this clip'},
					{
						type: 'video_url',
						video_url: {url: 'https://video.example.com/ref.mp4'},
						role: 'reference_video',
					},
				],
				inputVideoDuration: 5,
				referenceVideos: [
					{
						role: 'reference_video',
						width: 1280,
						height: 720,
						duration: 5,
						fps: 30,
						size: 8_000_000,
					},
				],
			}),
		);
	});
});

describe('video estimate', () => {
	it('passes reference metadata to estimateVideoCredits', async () => {
		mockClient.estimateVideoCredits.mockResolvedValue({tokens: 3320, credits: 10});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			[
				'video',
				'estimate',
				'--model',
				'doubao-seedance-2-pro',
				'--resolution',
				'720p',
				'--duration',
				'5',
				'--has-video-input',
				'--input-video-duration',
				'5',
				'--reference-video-meta',
				'1280x720:5:30:8000000',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.estimateVideoCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				model: 'doubao-seedance-2-pro',
				resolution: '720p',
				duration: 5,
				hasVideoInput: true,
				inputVideoDuration: 5,
				referenceVideos: [
					{
						role: 'reference_video',
						width: 1280,
						height: 720,
						duration: 5,
						fps: 30,
						size: 8_000_000,
					},
				],
			}),
		);
		expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({tokens: 3320, credits: 10}, null, 2));
	});
});

describe('video pixverse generate', () => {
	it('text_to_video: passes capability + prompt with --no-wait and prints response JSON', async () => {
		const created = {taskId: '6a2016607ebd26d050c585ca', status: 'generating'};
		mockClient.createPixVerseVideoGeneration.mockResolvedValue(created);
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			[
				'video',
				'pixverse',
				'generate',
				'--capability',
				'text_to_video',
				'--prompt',
				'A cat playing piano',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.createPixVerseVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				capability: 'text_to_video',
				prompt: 'A cat playing piano',
			}),
		);
		expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(created, null, 2));
	});

	it('image_to_video: parses --image url:duration into images asset array', async () => {
		mockClient.createPixVerseVideoGeneration.mockResolvedValue({
			taskId: '6a201660b9fc373811288f09',
			status: 'generating',
		});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			[
				'video',
				'pixverse',
				'generate',
				'--capability',
				'image_to_video',
				'--image',
				'https://img.example.com/a.jpg:5',
				'--image',
				'https://img.example.com/b.jpg',
				'--quality',
				'1080p',
				'--aspect-ratio',
				'9:16',
				'--duration',
				'10',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.createPixVerseVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				capability: 'image_to_video',
				quality: '1080p',
				aspectRatio: '9:16',
				duration: 10,
				images: [
					{url: 'https://img.example.com/a.jpg', duration: 5},
					{url: 'https://img.example.com/b.jpg'},
				],
			}),
		);
	});

	it('lip_sync: builds nested pixverse object from lip-sync flags', async () => {
		mockClient.createPixVerseVideoGeneration.mockResolvedValue({
			taskId: '6a201660b9fc373811288f10',
			status: 'generating',
		});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			[
				'video',
				'pixverse',
				'generate',
				'--capability',
				'lip_sync',
				'--source-task-id',
				'6a201660b9fc373811288f00',
				'--lip-sync-tts',
				'--lip-sync-speaker-id',
				'speaker-1',
				'--lip-sync-content',
				'Hello world',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.createPixVerseVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				capability: 'lip_sync',
				sourceTaskId: '6a201660b9fc373811288f00',
				// lip_sync TTS must populate BOTH the nested `tts` object (which the
				// server validator gates on) and the lipSyncTts* fields (which the
				// provider reads), so the flag-driven path passes validation.
				pixverse: {
					lipSyncTtsSwitch: true,
					lipSyncTtsSpeakerId: 'speaker-1',
					lipSyncTtsContent: 'Hello world',
					tts: {speakerId: 'speaker-1', content: 'Hello world'},
				},
			}),
		);
	});

	it('agent: merges --agent-type into a --pixverse-json escape hatch (flags win)', async () => {
		mockClient.createPixVerseVideoGeneration.mockResolvedValue({
			taskId: '6a201660b9fc373811288f11',
			status: 'generating',
		});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			[
				'video',
				'pixverse',
				'generate',
				'--capability',
				'agent',
				'--agent-type',
				'promo_mix',
				'--quality',
				'1080p',
				'--duration',
				'30',
				'--pixverse-json',
				'{"motionMode":"smooth"}',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.createPixVerseVideoGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				capability: 'agent',
				quality: '1080p',
				duration: 30,
				pixverse: {motionMode: 'smooth', agentType: 'promo_mix'},
			}),
		);
	});

	it('rejects an invalid --capability', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			['video', 'pixverse', 'generate', '--capability', 'bogus', '--no-wait', '--json'],
			{from: 'user'},
		);

		expect(mockClient.createPixVerseVideoGeneration).not.toHaveBeenCalled();
		expect(exitSpy).toHaveBeenCalledWith(1);
		errorSpy.mockRestore();
		exitSpy.mockRestore();
	});
});

describe('video pixverse estimate', () => {
	it('calls estimatePixVerseVideoCredits with capability/quality/duration and prints JSON', async () => {
		const estimate = {tokens: 1400, credits: 14};
		mockClient.estimatePixVerseVideoCredits.mockResolvedValue(estimate);
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			[
				'video',
				'pixverse',
				'estimate',
				'--capability',
				'text_to_video',
				'--quality',
				'720p',
				'--duration',
				'5',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.estimatePixVerseVideoCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				capability: 'text_to_video',
				quality: '720p',
				duration: 5,
			}),
		);
		expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(estimate, null, 2));
	});

	it('passes agentType under pixverse for capability=agent', async () => {
		mockClient.estimatePixVerseVideoCredits.mockResolvedValue({tokens: 3000, credits: 30});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerVideo(parent);

		await parent.parseAsync(
			[
				'video',
				'pixverse',
				'estimate',
				'--capability',
				'agent',
				'--agent-type',
				'ad_master',
				'--duration',
				'30',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.estimatePixVerseVideoCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				capability: 'agent',
				duration: 30,
				pixverse: {agentType: 'ad_master'},
			}),
		);
	});
});

describe('storybook create', () => {
	it('passes source URLs and speaker IDs to createStorybook', async () => {
		mockClient.createStorybook.mockResolvedValue({episodeId: 'ep-111'});
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerStorybook(parent);

		await parent.parseAsync(
			[
				'storybook',
				'create',
				'--source-url',
				'https://news.example.com/article',
				'--speaker-id',
				'speaker-abc',
				'--no-wait',
				'--json',
			],
			{from: 'user'},
		);

		expect(mockClient.createStorybook).toHaveBeenCalledWith(
			expect.objectContaining({
				sources: [{type: 'url', content: 'https://news.example.com/article'}],
				speakers: [{speakerId: 'speaker-abc'}],
			}),
		);
		expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({episodeId: 'ep-111'}, null, 2));
	});

	it('omits speakers when no --speaker-id is given', async () => {
		mockClient.createStorybook.mockResolvedValue({episodeId: 'ep-222'});
		vi.spyOn(console, 'log').mockImplementation(() => undefined);

		const parent = makeParent();
		registerStorybook(parent);

		await parent.parseAsync(
			['storybook', 'create', '--source-text', 'Once upon a time', '--no-wait', '--json'],
			{from: 'user'},
		);

		expect(mockClient.createStorybook).toHaveBeenCalledWith(
			expect.objectContaining({
				sources: [{type: 'text', content: 'Once upon a time'}],
				speakers: undefined,
			}),
		);
	});
});
