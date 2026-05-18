import type {Command} from 'commander';
import type {OpenAPIStorybookDetail} from '@marswave/listenhub-sdk';
import {handleError, printDetail, printJson} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

type CreateOptions = {
	sourceUrl: string[];
	sourceText: string[];
	speakerId: string[];
	skipAudio: boolean;
	style?: string;
	mode?: string;
	lang?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

type GetOptions = {
	json: boolean;
};

type GenerateVideoOptions = {
	json: boolean;
};

function printStorybookDetail(result: OpenAPIStorybookDetail): void {
	printDetail('Storybook', [
		['Episode', result.episodeId],
		['Status', result.processStatus],
		['Mode', result.mode],
		['Title', result.title],
		['Audio', result.audioUrl],
		['Video', result.videoUrl],
		['Video Status', result.videoStatus],
		['Credits', result.credits],
		['Created', result.createdAt],
	]);
}

export function register(openapi: Command) {
	const storybook = openapi.command('storybook').description('Storybook commands');

	storybook
		.command('create')
		.description('Create a storybook episode from sources')
		.option('--source-url <url>', 'Source URL (repeatable)', collect, [] as string[])
		.option('--source-text <text>', 'Source text (repeatable)', collect, [] as string[])
		.option('--speaker-id <id>', 'Speaker ID (repeatable)', collect, [] as string[])
		.option('--skip-audio', 'Skip audio generation', false)
		.option('--style <style>', 'Storybook style')
		.option('--mode <mode>', 'Generation mode (info, story, slides)', 'info')
		.option('--lang <lang>', 'Language code')
		.option('--no-wait', 'Do not wait for completion')
		.option('--timeout <seconds>', 'Polling timeout in seconds', '300')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: CreateOptions) => {
			try {
				const client = await getOpenAPIClient();

				const sources = [
					...options.sourceUrl.map((content) => ({type: 'url' as const, content})),
					...options.sourceText.map((content) => ({type: 'text' as const, content})),
				];

				const speakers = options.speakerId.length > 0
					? options.speakerId.map((speakerId) => ({speakerId}))
					: undefined;

				const {episodeId} = await client.createStorybook({
					sources,
					speakers,
					skipAudio: options.skipAudio || undefined,
					style: options.style,
					language: options.lang,
					mode: options.mode as 'info' | 'story' | 'slides' | undefined,
				});

				if (!options.wait) {
					if (options.json) {
						printJson({episodeId});
					} else {
						console.log(`✓ Storybook created: ${episodeId}`);
					}

					return;
				}

				const result = await pollOpenAPI<OpenAPIStorybookDetail>({
					getStatus: async () => client.getStorybook(episodeId),
					isDone: (r) => r.processStatus === 'success',
					isFailed: (r) => r.processStatus === 'failed',
					getErrorMessage: (r) => r.message ?? `Failed with code ${String(r.failCode)}`,
					options: {
						timeout: Number(options.timeout),
						label: 'Generating storybook',
						json: options.json,
					},
				});

				if (options.json) {
					printJson(result);
				} else {
					printStorybookDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	storybook
		.command('get <episodeId>')
		.description('Get storybook episode details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (episodeId: string, options: GetOptions) => {
			try {
				const client = await getOpenAPIClient();
				const result = await client.getStorybook(episodeId);

				if (options.json) {
					printJson(result);
				} else {
					printStorybookDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	storybook
		.command('generate-video <episodeId>')
		.description('Generate video for a storybook episode')
		.option('-j, --json', 'Output JSON', false)
		.action(async (episodeId: string, options: GenerateVideoOptions) => {
			try {
				const client = await getOpenAPIClient();
				const result = await client.generateStorybookVideo(episodeId);

				if (options.json) {
					printJson(result);
				} else {
					console.log(result.success ? '✓ Video generation started' : '✗ Video generation failed');
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
