import type {Command} from 'commander';
import type {OpenAPIClient, OpenAPIContentExtractDetail} from '@marswave/listenhub-sdk';
import {handleError, printJson, printDetail} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

type ExtractOptions = {
	url: string;
	summarize: boolean;
	maxLength?: number;
	wait: boolean;
	timeout: number;
	json: boolean;
};

type GetOptions = {
	json: boolean;
};

function printContentDetail(result: OpenAPIContentExtractDetail): void {
	printDetail('Content Extract', [
		['Task ID', result.taskId],
		['Status', result.status],
		['Credits', result.credits],
	]);
	if (result.data?.content) {
		console.log('\n' + result.data.content);
	}
}

async function runExtract(client: OpenAPIClient, options: ExtractOptions): Promise<void> {
	const {taskId} = await client.createContentExtract({
		source: {type: 'url', uri: options.url},
		options: {
			summarize: options.summarize || undefined,
			maxLength: options.maxLength,
		},
	});

	if (!options.wait) {
		if (options.json) {
			printJson({taskId});
		} else {
			console.log(`✓ Content extract started: ${taskId}`);
		}

		return;
	}

	const result = await pollOpenAPI<OpenAPIContentExtractDetail>({
		getStatus: async () => client.getContentExtract(taskId),
		isDone: (r) => r.status === 'completed',
		isFailed: (r) => r.status === 'failed',
		getErrorMessage: (r) => r.message ?? `Failed with code ${String(r.failCode)}`,
		options: {
			timeout: Number(options.timeout),
			label: 'Extracting content',
			json: options.json,
		},
	});

	if (options.json) {
		printJson(result);
	} else {
		printContentDetail(result);
	}
}

export function register(openapi: Command) {
	const content = openapi.command('content').description('Content extraction commands');

	content
		.command('extract')
		.description('Extract content from a URL')
		.requiredOption('--url <url>', 'URL to extract content from')
		.option('--summarize', 'Summarize the extracted content', false)
		.option('--max-length <n>', 'Maximum content length', Number)
		.option('--no-wait', 'Do not wait for completion')
		.option('--timeout <seconds>', 'Polling timeout in seconds', '300')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: ExtractOptions) => {
			try {
				const client = await getOpenAPIClient();
				await runExtract(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	content
		.command('get <taskId>')
		.description('Get content extraction result')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: GetOptions) => {
			try {
				const client = await getOpenAPIClient();
				const result = await client.getContentExtract(taskId);

				if (options.json) {
					printJson(result);
				} else {
					printContentDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
