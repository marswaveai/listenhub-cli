import type {Command} from 'commander';
import type {
	OpenAPICreateListenHubVoiceParams,
	OpenAPIListenHubVoiceTaskDetail,
	OpenAPIListListenHubVoiceTasksParams,
	OpenAPIListenHubVoiceTaskStatus,
} from '@marswave/listenhub-sdk';
import {handleError, printDetail, printJson, printTable} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

// ListenHub Voice — end-to-end audio generation (text / reference voices /
// image → audio). Authenticates with an OpenAPI key (lh_sk_…) against the
// /openapi base. Async: create a task, then poll GET /v1/listenhub-voice/tasks/:id.
// Only the three publicly-covered endpoints are exposed (generate / tasks / task);
// /voices and /estimate-credits are intentionally not surfaced.

type WaitOptions = {wait: boolean; timeout: string; json: boolean};

function printVoiceDetail(task: OpenAPIListenHubVoiceTaskDetail): void {
	printDetail('ListenHub Voice task', [
		['Task ID', task.id],
		['Status', task.status],
		['Model', task.model],
		['Audio URL', task.audioUrl ?? '-'],
		['Duration', task.audioDuration ? `${task.audioDuration}s` : '-'],
		['Credits charged', task.creditCharged],
		['Credits refunded', task.creditRefunded || undefined],
		['Error', task.errorMessage],
	]);
}

async function emitTask(taskId: string, options: WaitOptions): Promise<void> {
	const client = await getOpenAPIClient();
	if (!options.wait) {
		if (options.json) {
			printJson({taskId});
		} else {
			console.log(`✓ ListenHub Voice task submitted: ${taskId}`);
		}

		return;
	}

	const task = await pollOpenAPI<OpenAPIListenHubVoiceTaskDetail>({
		getStatus: async () => client.getListenHubVoiceTask(taskId),
		isDone: (r) => r.status === 'success',
		isFailed: (r) => r.status === 'failed',
		getErrorMessage: (r) => r.errorMessage ?? 'ListenHub Voice generation failed',
		options: {timeout: Number(options.timeout), label: 'Generating audio', json: options.json},
	});

	if (options.json) {
		printJson(task);
	} else {
		printVoiceDetail(task);
	}
}

export function register(openapi: Command) {
	const voice = openapi
		.command('listenhub-voice')
		.description('ListenHub Voice end-to-end audio generation (text / reference / image → audio)');

	voice
		.command('generate')
		.description('Generate end-to-end audio from a text script')
		.requiredOption(
			'--text <text>',
			'Script text (max 1400 chars). Use @音频1 / @音频2 to assign lines in multi-voice mode',
		)
		.option(
			'--voice <spec...>',
			'Voice(s), 1-3 items. Each: "speaker:<voiceType>" (official preset, single-voice only) or "reference:<url>" (custom reference audio). Repeat or space-separate for multi-voice',
		)
		.option(
			'--image-url <url>',
			'Reference image URL for image→audio (mutually exclusive with --voice)',
		)
		.option('--speech-rate <n>', 'Speech rate [-50, 100]')
		.option('--loudness-rate <n>', 'Loudness rate [-50, 100]')
		.option('--pitch-rate <n>', 'Pitch rate [-12, 12]')
		.option('--format <fmt>', 'Output format: mp3 (default), wav, pcm, ogg_opus')
		.option('--duration-hint <seconds>', 'Target duration hint [1, 110]')
		.option('--watermark', 'Add audio watermark', false)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', '300')
		.option('-j, --json', 'Output JSON', false)
		.action(
			async (
				options: WaitOptions & {
					text: string;
					voice?: string[];
					imageUrl?: string;
					speechRate?: string;
					loudnessRate?: string;
					pitchRate?: string;
					format?: string;
					durationHint?: string;
					watermark: boolean;
				},
			) => {
				try {
					if (options.voice && options.imageUrl) {
						throw new Error('--voice and --image-url are mutually exclusive');
					}

					const voices = (options.voice ?? []).map((spec) => {
						const idx = spec.indexOf(':');
						const kind = idx === -1 ? '' : spec.slice(0, idx);
						const value = idx === -1 ? '' : spec.slice(idx + 1);
						if (kind === 'speaker' && value) {
							return {type: 'speaker' as const, id: value};
						}

						if (kind === 'reference' && value) {
							return {type: 'reference' as const, url: value};
						}

						throw new Error(
							`Invalid --voice "${spec}". Use "speaker:<voiceType>" or "reference:<url>"`,
						);
					});

					const audioConfig: NonNullable<OpenAPICreateListenHubVoiceParams['audioConfig']> = {};
					if (options.speechRate !== undefined) audioConfig.speechRate = Number(options.speechRate);
					if (options.loudnessRate !== undefined)
						audioConfig.loudnessRate = Number(options.loudnessRate);
					if (options.pitchRate !== undefined) audioConfig.pitchRate = Number(options.pitchRate);
					if (options.format)
						audioConfig.format = options.format as NonNullable<
							OpenAPICreateListenHubVoiceParams['audioConfig']
						>['format'];

					const params: OpenAPICreateListenHubVoiceParams = {
						model: 'listenhub-voice-1.0',
						text: options.text,
						...(voices.length > 0 && {voices}),
						...(options.imageUrl && {image: {url: options.imageUrl}}),
						...(Object.keys(audioConfig).length > 0 && {audioConfig}),
						...(options.durationHint !== undefined && {durationHint: Number(options.durationHint)}),
						...(options.watermark && {watermark: true}),
					};

					const client = await getOpenAPIClient();
					const {taskId} = await client.createListenHubVoice(params);
					await emitTask(taskId, options);
				} catch (error) {
					handleError(error, options.json);
				}
			},
		);

	voice
		.command('tasks')
		.description('List your ListenHub Voice tasks, newest first')
		.option('--page <n>', 'Page number', '1')
		.option('--page-size <n>', 'Page size (max 100)', '20')
		.option(
			'--status <status>',
			'Filter by status: pending, generating, uploading, success, failed',
		)
		.option('--keyword <text>', 'Filter by keyword')
		.option('-j, --json', 'Output JSON', false)
		.action(
			async (options: {
				page: string;
				pageSize: string;
				status?: string;
				keyword?: string;
				json: boolean;
			}) => {
				try {
					const params: OpenAPIListListenHubVoiceTasksParams = {
						page: Number(options.page),
						pageSize: Number(options.pageSize),
						...(options.status && {status: options.status as OpenAPIListenHubVoiceTaskStatus}),
						...(options.keyword && {keyword: options.keyword}),
					};
					const client = await getOpenAPIClient();
					const result = await client.listListenHubVoiceTasks(params);
					if (options.json) {
						printJson(result);
						return;
					}

					printTable(
						['Task ID', 'Status', 'Duration', 'Credits', 'Created'],
						result.items.map((t) => [
							t.id,
							t.status,
							t.audioDuration ? `${t.audioDuration}s` : '-',
							String(t.creditCharged),
							new Date(t.createdAt).toISOString(),
						]),
					);
					console.log(`\nPage ${result.page} · ${result.items.length}/${result.total} tasks`);
				} catch (error) {
					handleError(error, options.json);
				}
			},
		);

	voice
		.command('task <taskId>')
		.description('Get a ListenHub Voice task detail / poll until done')
		.option('--wait', 'Poll until the task reaches a terminal state', false)
		.option('--timeout <seconds>', 'Polling timeout', '300')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: {wait: boolean; timeout: string; json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				if (options.wait) {
					const task = await pollOpenAPI<OpenAPIListenHubVoiceTaskDetail>({
						getStatus: async () => client.getListenHubVoiceTask(taskId),
						isDone: (r) => r.status === 'success',
						isFailed: (r) => r.status === 'failed',
						getErrorMessage: (r) => r.errorMessage ?? 'ListenHub Voice generation failed',
						options: {
							timeout: Number(options.timeout),
							label: 'Generating audio',
							json: options.json,
						},
					});
					if (options.json) printJson(task);
					else printVoiceDetail(task);
					return;
				}

				const task = await client.getListenHubVoiceTask(taskId);
				if (options.json) printJson(task);
				else printVoiceDetail(task);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
