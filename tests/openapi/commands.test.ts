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
		mockClient.createVideoGeneration.mockResolvedValue({taskId: 'vid-001'});
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
		expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({taskId: 'vid-001'}, null, 2));
	});

	it('includes first-frame in content array when provided', async () => {
		mockClient.createVideoGeneration.mockResolvedValue({taskId: 'vid-002'});
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
