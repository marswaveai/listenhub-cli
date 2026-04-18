import type {
	AIImageAspectRatio,
	AIImageSize,
	ImageModel,
	ImagePromptLanguage,
	ListenHubClient,
} from '@marswave/listenhub-sdk';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollImageUntilDone} from '../_shared/polling.js';
import {resolveFileOrUrl} from '../_shared/upload.js';

export type ImageCreateOptions = {
	prompt: string;
	model?: ImageModel;
	lang?: ImagePromptLanguage;
	aspectRatio: AIImageAspectRatio;
	size: AIImageSize;
	reference: string[];
	referenceUrl: string[];
	wait: boolean;
	timeout: number;
	json: boolean;
};

export async function createImage(
	client: ListenHubClient,
	options: ImageCreateOptions,
): Promise<void> {
	const allReferences = [...options.reference, ...options.referenceUrl];

	if (allReferences.length > 5) {
		throw new Error('Too many reference images (max 5)');
	}

	const referenceImageUrls =
		allReferences.length > 0
			? await Promise.all(
					allReferences.map(async (ref) => resolveFileOrUrl(client, ref, {accept: 'image'})),
				)
			: undefined;

	const {imageId} = await client.createAIImage({
		prompt: options.prompt,
		...(options.model && {model: options.model}),
		...(options.lang && {language: options.lang}),
		aspectRatio: options.aspectRatio,
		imageSize: options.size,
		...(referenceImageUrls && {referenceImageUrls}),
	});

	if (!options.wait) {
		if (options.json) {
			printJson({imageId});
		} else {
			console.log(`\u2713 Image submitted: ${imageId}`);
		}

		return;
	}

	const item = await pollImageUntilDone(client, imageId, {
		timeout: options.timeout,
		json: options.json,
	});

	if (options.json) {
		printJson(item);
	} else {
		printDetail('Image created', [
			['ID:', item.id],
			['URL:', item.imageUrl],
			['Status:', item.status],
		]);
	}
}

export type ImageListOptions = {page: number; pageSize: number; json: boolean};

export async function listImages(
	client: ListenHubClient,
	options: ImageListOptions,
): Promise<void> {
	const {items} = await client.listAIImages({
		page: options.page,
		pageSize: options.pageSize,
	});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['ID', 'Prompt', 'Status', 'Created'];
	const rows = items.map((image) => [
		image.id,
		image.prompt.slice(0, 40),
		image.status,
		new Date(image.createdAt).toISOString().slice(0, 10),
	]);
	printTable(headers, rows);
}

export async function getImage(
	client: ListenHubClient,
	imageId: string,
	json: boolean,
): Promise<void> {
	const item = await client.getAIImage(imageId);

	if (json) {
		printJson(item);
		return;
	}

	printDetail('Image details', [
		['ID:', item.id],
		['Prompt:', item.prompt],
		['URL:', item.imageUrl],
		['Size:', item.imageSize],
		['Ratio:', item.aspectRatio],
		['Status:', item.status],
		['Created:', new Date(item.createdAt).toISOString()],
	]);
}
