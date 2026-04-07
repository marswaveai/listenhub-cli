import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {
	type ExplainerCreateOptions,
	type ExplainerListOptions,
	createExplainer,
	listExplainerVideos,
} from './explainer.js';

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

export function register(program: Command) {
	const cmd = program
		.command('explainer')
		.description('Explainer video generation');

	cmd
		.command('create')
		.description('Create an explainer video')
		.option('--query <text>', 'Topic text')
		.option('--source-url <url>', 'Reference URL (repeatable)', collect, [])
		.option('--source-text <text>', 'Reference text (repeatable)', collect, [])
		.option('--mode <mode>', 'Generation mode: info, story', 'info')
		.option('--lang <lang>', 'Language: en, zh, ja (auto-detected if omitted)')
		.option('--speaker <name>', 'Speaker name')
		.option('--speaker-id <id>', 'Speaker inner ID')
		.option('--skip-audio', 'Skip audio generation', false)
		.option('--image-size <size>', 'Image size: 2K, 4K', '2K')
		.option('--aspect-ratio <ratio>', 'Aspect ratio: 16:9, 9:16, 1:1', '16:9')
		.option('--style <style>', 'Visual style')
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 300)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: ExplainerCreateOptions) => {
			try {
				const client = await getClient();
				await createExplainer(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('list')
		.description('List explainer videos')
		.option('--page <n>', 'Page number', Number, 1)
		.option('--page-size <n>', 'Items per page', Number, 20)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: ExplainerListOptions) => {
			try {
				const client = await getClient();
				await listExplainerVideos(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
