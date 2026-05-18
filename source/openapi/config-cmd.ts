import type {Command} from 'commander';
import process from 'node:process';
import readline from 'node:readline/promises';
import {handleError} from '../_shared/output.js';
import {
	deleteOpenAPIConfig,
	loadOpenAPIConfig,
	saveOpenAPIConfig,
	validateApiKey,
} from './config.js';

async function runSetKey(): Promise<void> {
	const rl = readline.createInterface({input: process.stdin, output: process.stderr});
	try {
		const key = await rl.question('Enter your API Key (lh_sk_...): ');
		const trimmed = key.trim();

		if (!validateApiKey(trimmed)) {
			console.error('✗ Invalid API Key format. Must start with "lh_sk_".');
			process.exit(1); // eslint-disable-line unicorn/no-process-exit
		}

		await saveOpenAPIConfig({apiKey: trimmed});
		const keyId = trimmed.split('_').slice(0, 3).join('_');
		console.log(`✓ API Key saved (${keyId}_***)`);
	} finally {
		rl.close();
	}
}

async function runShow(json: boolean): Promise<void> {
	const envKey = process.env['LISTENHUB_API_KEY'];
	if (envKey) {
		const keyId = envKey.split('_').slice(0, 3).join('_');
		if (json) {
			console.log(JSON.stringify({source: 'env', keyId}, null, 2));
		} else {
			console.log(`✓ API Key configured (source: env)`);
			console.log(`  Key ID: ${keyId}_***`);
		}

		return;
	}

	const config = await loadOpenAPIConfig();
	if (config?.apiKey) {
		const keyId = config.apiKey.split('_').slice(0, 3).join('_');
		if (json) {
			console.log(JSON.stringify({source: 'file', keyId}, null, 2));
		} else {
			console.log(`✓ API Key configured (source: file)`);
			console.log(`  Key ID: ${keyId}_***`);
		}

		return;
	}

	if (json) {
		console.log(JSON.stringify({source: null}, null, 2));
	} else {
		console.log(
			'No API Key configured. Run `listenhub openapi config set-key` or set LISTENHUB_API_KEY.',
		);
	}

	process.exit(1); // eslint-disable-line unicorn/no-process-exit
}

async function runClear(): Promise<void> {
	await deleteOpenAPIConfig();
	console.log('✓ API Key cleared');
}

export function register(openapi: Command) {
	const config = openapi.command('config').description('Manage API Key configuration');

	config
		.command('set-key')
		.description('Set your API Key interactively')
		.action(async () => {
			try {
				await runSetKey();
			} catch (error) {
				handleError(error, false);
			}
		});

	config
		.command('show')
		.description('Show current API Key status')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {json: boolean}) => {
			try {
				await runShow(options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	config
		.command('clear')
		.description('Remove stored API Key')
		.action(async () => {
			try {
				await runClear();
			} catch (error) {
				handleError(error, false);
			}
		});
}
