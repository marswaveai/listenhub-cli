import type {Command} from 'commander';
import type {OpenAPIFlowSpeechDetail} from '@marswave/listenhub-sdk';
import {handleError, printJson, printDetail} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

type CreateOptions = {
	sourceUrl: string[];
	sourceText: string[];
	speakerId: string[];
	mode: string;
	lang?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

type GetOptions = {
	json: boolean;
};

type TtsOptions = {
	script: string[];
	speakerId: string[];
	title?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

type TextStreamOptions = {
	event: string;
};

function printFlowSpeechDetail(result: OpenAPIFlowSpeechDetail): void {
	printDetail('Flow Speech', [
		['Episode', result.episodeId],
		['Status', result.processStatus],
		['Title', result.title],
		['Audio', result.audioUrl],
		['Stream', result.audioStreamUrl],
		['Subtitles', result.subtitlesUrl],
		['Created', result.createdAt],
	]);
}

export function register(openapi: Command) {
	const flowSpeech = openapi.command('flow-speech').description('Flow Speech commands');

	flowSpeech
		.command('create')
		.description('Create a flow speech episode from sources')
		.option('--source-url <url>', 'Source URL (repeatable)', collect, [] as string[])
		.option('--source-text <text>', 'Source text (repeatable)', collect, [] as string[])
		.option(
			'--speaker-id <id>',
			'Speaker ID (repeatable, at least 1 required)',
			collect,
			[] as string[],
		)
		.option('--mode <mode>', 'Generation mode: smart, direct', 'smart')
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

				if (options.sourceUrl.length === 0 && options.sourceText.length === 0) {
					console.error('✗ Error: At least one --source-url or --source-text is required');
					process.exit(1); // eslint-disable-line unicorn/no-process-exit
				}

				const client = await getOpenAPIClient();

				const sources = [
					...options.sourceUrl.map((uri) => ({type: 'url' as const, uri})),
					...options.sourceText.map((content) => ({type: 'text' as const, content})),
				];

				const speakers = options.speakerId.map((speakerId) => ({speakerId}));

				const {episodeId} = await client.createFlowSpeech({
					sources,
					speakers,
					mode: options.mode as 'smart' | 'direct',
					language: options.lang,
				});

				if (!options.wait) {
					if (options.json) {
						printJson({episodeId});
					} else {
						console.log(`✓ Flow speech created: ${episodeId}`);
					}

					return;
				}

				const result = await pollOpenAPI<OpenAPIFlowSpeechDetail>({
					getStatus: async () => client.getFlowSpeech(episodeId),
					isDone: (r) => r.processStatus === 'success',
					isFailed: (r) => r.processStatus === 'failed',
					getErrorMessage: (r) => r.message ?? `Failed with code ${String(r.failCode)}`,
					options: {
						timeout: Number(options.timeout),
						label: 'Generating flow speech',
						json: options.json,
					},
				});

				if (options.json) {
					printJson(result);
				} else {
					printFlowSpeechDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	flowSpeech
		.command('get <episodeId>')
		.description('Get flow speech details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (episodeId: string, options: GetOptions) => {
			try {
				const client = await getOpenAPIClient();
				const result = await client.getFlowSpeech(episodeId);

				if (options.json) {
					printJson(result);
				} else {
					printFlowSpeechDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	flowSpeech
		.command('tts')
		.description('Create flow speech from scripts')
		.option(
			'--script <content>',
			'Script content (repeatable, at least 1 required)',
			collect,
			[] as string[],
		)
		.option(
			'--speaker-id <id>',
			'Speaker ID (repeatable, at least 1 required)',
			collect,
			[] as string[],
		)
		.option('--title <title>', 'Episode title')
		.option('--no-wait', 'Do not wait for completion')
		.option('--timeout <seconds>', 'Polling timeout in seconds', '300')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: TtsOptions) => {
			try {
				if (options.script.length === 0) {
					console.error('✗ Error: At least one --script is required');
					process.exit(1); // eslint-disable-line unicorn/no-process-exit
				}

				if (options.speakerId.length === 0) {
					console.error('✗ Error: At least one --speaker-id is required');
					process.exit(1); // eslint-disable-line unicorn/no-process-exit
				}

				const client = await getOpenAPIClient();

				const scripts = options.script.map((content, i) => ({
					content,
					speakerId: options.speakerId[i] ?? options.speakerId[0]!,
				}));

				const {episodeId} = await client.createFlowSpeechTTS({
					scripts,
					title: options.title,
				});

				if (!options.wait) {
					if (options.json) {
						printJson({episodeId});
					} else {
						console.log(`✓ Flow speech TTS created: ${episodeId}`);
					}

					return;
				}

				const result = await pollOpenAPI<OpenAPIFlowSpeechDetail>({
					getStatus: async () => client.getFlowSpeech(episodeId),
					isDone: (r) => r.processStatus === 'success',
					isFailed: (r) => r.processStatus === 'failed',
					getErrorMessage: (r) => r.message ?? `Failed with code ${String(r.failCode)}`,
					options: {
						timeout: Number(options.timeout),
						label: 'Generating flow speech TTS',
						json: options.json,
					},
				});

				if (options.json) {
					printJson(result);
				} else {
					printFlowSpeechDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	flowSpeech
		.command('text-stream <episodeId>')
		.description('Stream generated text (SSE) for a flow speech episode')
		.requiredOption('--event <event>', 'Event type: script or outline')
		.action(async (episodeId: string, options: TextStreamOptions) => {
			try {
				const client = await getOpenAPIClient();
				const response = await client.getFlowSpeechTextStream(
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
