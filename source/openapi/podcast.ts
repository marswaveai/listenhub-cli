import type {Command} from 'commander';
import type {OpenAPIPodcastDetail} from '@marswave/listenhub-sdk';
import {handleError, printJson, printDetail} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

type CreateOptions = {
	query?: string;
	sourceUrl: string[];
	sourceText: string[];
	speakerId: string[];
	mode?: string;
	lang?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

type GetOptions = {
	json: boolean;
};

type TextContentOptions = {
	query?: string;
	sourceUrl: string[];
	sourceText: string[];
	speakerId: string[];
	mode?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

type GenerateAudioOptions = {
	wait: boolean;
	timeout: number;
	json: boolean;
};

type TextStreamOptions = {
	event: string;
};

function printPodcastDetail(result: OpenAPIPodcastDetail): void {
	printDetail('Podcast', [
		['Episode', result.episodeId],
		['Status', result.processStatus],
		['Content Status', result.contentStatus],
		['Title', result.title],
		['Audio', result.audioUrl],
		['Stream', result.audioStreamUrl],
		['Credits', result.credits],
		['Created', result.createdAt],
	]);
}

export function register(openapi: Command) {
	const podcast = openapi.command('podcast').description('Podcast commands');

	podcast
		.command('create')
		.description('Create a podcast episode from sources')
		.option('--query <text>', 'Query or topic for the podcast')
		.option('--source-url <url>', 'Source URL (repeatable)', collect, [] as string[])
		.option('--source-text <text>', 'Source text (repeatable)', collect, [] as string[])
		.option(
			'--speaker-id <id>',
			'Speaker ID (repeatable, at least 1 required)',
			collect,
			[] as string[],
		)
		.option('--mode <mode>', 'Generation mode')
		.option('--lang <lang>', 'Language code')
		.option('--no-wait', 'Do not wait for completion')
		.option('--timeout <seconds>', 'Polling timeout in seconds', '300')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: CreateOptions) => {
			try {
				if (options.speakerId.length === 0) {
					console.error('✗ Error: At least one --speaker-id is required');
					process.exit(1); // eslint-disable-line unicorn/no-process-exit
				}

				const client = await getOpenAPIClient();

				const sources = [
					...options.sourceUrl.map((content) => ({type: 'url' as const, content})),
					...options.sourceText.map((content) => ({type: 'text' as const, content})),
				];

				const speakers = options.speakerId.map((speakerId) => ({speakerId}));

				const {episodeId} = await client.createPodcast({
					query: options.query,
					sources,
					speakers,
					mode: options.mode,
					language: options.lang,
				});

				if (!options.wait) {
					if (options.json) {
						printJson({episodeId});
					} else {
						console.log(`✓ Podcast created: ${episodeId}`);
					}

					return;
				}

				const result = await pollOpenAPI<OpenAPIPodcastDetail>({
					getStatus: async () => client.getPodcast(episodeId),
					isDone: (r) => r.processStatus === 'success',
					isFailed: (r) => r.processStatus === 'failed',
					getErrorMessage: (r) => r.message ?? `Failed with code ${String(r.failCode)}`,
					options: {
						timeout: Number(options.timeout),
						label: 'Generating podcast',
						json: options.json,
					},
				});

				if (options.json) {
					printJson(result);
				} else {
					printPodcastDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	podcast
		.command('get <episodeId>')
		.description('Get podcast episode details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (episodeId: string, options: GetOptions) => {
			try {
				const client = await getOpenAPIClient();
				const result = await client.getPodcast(episodeId);

				if (options.json) {
					printJson(result);
				} else {
					printPodcastDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	podcast
		.command('text-content')
		.description('Generate podcast text content only (no audio)')
		.option('--query <text>', 'Query or topic for the podcast')
		.option('--source-url <url>', 'Source URL (repeatable)', collect, [] as string[])
		.option('--source-text <text>', 'Source text (repeatable)', collect, [] as string[])
		.option(
			'--speaker-id <id>',
			'Speaker ID (repeatable, at least 1 required)',
			collect,
			[] as string[],
		)
		.option('--mode <mode>', 'Generation mode')
		.option('--no-wait', 'Do not wait for completion')
		.option('--timeout <seconds>', 'Polling timeout in seconds', '300')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: TextContentOptions) => {
			try {
				if (options.speakerId.length === 0) {
					console.error('✗ Error: At least one --speaker-id is required');
					process.exit(1); // eslint-disable-line unicorn/no-process-exit
				}

				if (!options.query && options.sourceUrl.length === 0 && options.sourceText.length === 0) {
					console.error(
						'✗ Error: At least one of --query, --source-url, or --source-text is required',
					);
					process.exit(1); // eslint-disable-line unicorn/no-process-exit
				}

				const client = await getOpenAPIClient();

				const sources = [
					...options.sourceUrl.map((content) => ({type: 'url' as const, content})),
					...options.sourceText.map((content) => ({type: 'text' as const, content})),
				];

				const speakers = options.speakerId.map((speakerId) => ({speakerId}));

				const {episodeId} = await client.createPodcastTextContent({
					query: options.query,
					sources,
					speakers,
					mode: options.mode,
				});

				if (!options.wait) {
					if (options.json) {
						printJson({episodeId});
					} else {
						console.log(`✓ Podcast text content job started: ${episodeId}`);
					}

					return;
				}

				const result = await pollOpenAPI<OpenAPIPodcastDetail>({
					getStatus: async () => client.getPodcast(episodeId),
					isDone: (r) => r.contentStatus === 'text-success',
					isFailed: (r) => r.contentStatus === 'text-fail',
					getErrorMessage: (r) => r.message ?? `Failed with code ${String(r.failCode)}`,
					options: {
						timeout: Number(options.timeout),
						label: 'Generating podcast text content',
						json: options.json,
					},
				});

				if (options.json) {
					printJson(result);
				} else {
					printPodcastDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	podcast
		.command('generate-audio <episodeId>')
		.description('Generate audio for an existing podcast text episode')
		.option('--no-wait', 'Do not wait for completion')
		.option('--timeout <seconds>', 'Polling timeout in seconds', '300')
		.option('-j, --json', 'Output JSON', false)
		.action(async (episodeId: string, options: GenerateAudioOptions) => {
			try {
				const client = await getOpenAPIClient();
				await client.generatePodcastAudio(episodeId);

				if (!options.wait) {
					if (options.json) {
						printJson({episodeId});
					} else {
						console.log(`✓ Audio generation started: ${episodeId}`);
					}

					return;
				}

				const result = await pollOpenAPI<OpenAPIPodcastDetail>({
					getStatus: async () => client.getPodcast(episodeId),
					isDone: (r) => r.contentStatus === 'audio-success',
					isFailed: (r) => r.contentStatus === 'audio-fail',
					getErrorMessage: (r) => r.message ?? `Failed with code ${String(r.failCode)}`,
					options: {
						timeout: Number(options.timeout),
						label: 'Generating podcast audio',
						json: options.json,
					},
				});

				if (options.json) {
					printJson(result);
				} else {
					printPodcastDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	podcast
		.command('text-stream <episodeId>')
		.description('Stream generated text (SSE) for a podcast episode')
		.requiredOption('--event <event>', 'Event type: script or outline')
		.action(async (episodeId: string, options: TextStreamOptions) => {
			try {
				const client = await getOpenAPIClient();
				const response = await client.getPodcastTextStream(
					episodeId,
					options.event as 'script' | 'outline',
				);

				const body = response.body;
				if (!body) {
					throw new Error('Empty response body');
				}

				const reader = body.getReader();
				const decoder = new TextDecoder();

				// eslint-disable-next-line no-constant-condition
				while (true) {
					// eslint-disable-next-line no-await-in-loop
					const {done, value} = await reader.read();
					if (done) break;
					process.stdout.write(decoder.decode(value, {stream: true}));
				}

				process.stdout.write(decoder.decode());
			} catch (error) {
				handleError(error, false);
			}
		});
}
