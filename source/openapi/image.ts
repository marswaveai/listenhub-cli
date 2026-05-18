import fs from 'node:fs';
import path from 'node:path';
import type {Command} from 'commander';
import type {OpenAPIClient} from '@marswave/listenhub-sdk';
import {handleError, printJson} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';

type ImageCreateOptions = {
	prompt: string;
	provider: string;
	model?: string;
	size?: '1K' | '2K' | '4K';
	ratio?: '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9';
	reference: string[];
	json: boolean;
};

function collect(value: string, previous: string[]): string[] {
	return [...previous, value];
}

const mimeTypes: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.bmp': 'image/bmp',
};

function isUrl(value: string): boolean {
	return value.startsWith('http://') || value.startsWith('https://');
}

function resolveReference(ref: string) {
	if (isUrl(ref)) {
		const ext = path.extname(new URL(ref).pathname).toLowerCase();
		const mimeType = mimeTypes[ext] ?? 'image/png';
		return {fileData: {fileUri: ref, mimeType}};
	}

	const filePath = path.resolve(ref);
	const ext = path.extname(filePath).toLowerCase();
	const mimeType = mimeTypes[ext];
	if (!mimeType) {
		throw new Error(
			`Unsupported image format: ${ext}. Supported: ${Object.keys(mimeTypes).join(', ')}`,
		);
	}

	const data = fs.readFileSync(filePath).toString('base64');
	return {inlineData: {data, mimeType}};
}

async function createImage(client: OpenAPIClient, options: ImageCreateOptions): Promise<void> {
	const referenceImages =
		options.reference.length > 0
			? options.reference.map((ref) => resolveReference(ref))
			: undefined;

	const result = await client.createImage({
		provider: options.provider,
		model: options.model,
		prompt: options.prompt,
		referenceImages,
		imageConfig:
			(options.size ?? options.ratio)
				? {
						imageSize: options.size,
						aspectRatio: options.ratio,
					}
				: undefined,
	});

	if (options.json) {
		printJson(result);
		return;
	}

	console.log('✓ Image created');
	console.log(JSON.stringify(result, null, 2));
}

export function register(openapi: Command) {
	const image = openapi.command('image').description('AI image generation');
	image
		.command('create')
		.description('Create an AI image')
		.requiredOption('--prompt <text>', 'Image description')
		.requiredOption('--provider <provider>', 'Provider name')
		.option('--model <model>', 'Model name')
		.option('--size <size>', 'Image size: 1K, 2K, 4K')
		.option('--ratio <ratio>', 'Aspect ratio: 16:9, 4:3, 1:1, 3:4, 9:16, 21:9')
		.option('--reference <path-or-url>', 'Reference image (repeatable)', collect, [])
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: ImageCreateOptions) => {
			try {
				const client = await getOpenAPIClient();
				await createImage(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
