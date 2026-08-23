import {randomUUID} from 'node:crypto';
import process from 'node:process';
import type {
	AIImageAspectRatio,
	AIImageSize,
	BananaImageItem,
	BananaImageQuality,
	BananaImageScope,
	ImageModel,
	ImagePromptLanguage,
	ListenHubClient,
} from '@marswave/listenhub-sdk';
import {ListenHubError} from '@marswave/listenhub-sdk';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollBananaImageUntilDone} from '../_shared/polling.js';
import {resolveFileOrUrl} from '../_shared/upload.js';

/** 后端 Joi 对 referenceImageUrls 的硬上限；各模型另有更严的限制，由后端拒绝并报出。 */
const maxReferences = 14;

/**
 * `-n` 的上限。后端没有张数入参，n 是客户端扇出；再往上一定撞 IP/用户限流
 * （非订阅用户 10 次 / 10 分钟），与其把限流错误当常态，不如先在客户端挡住。
 */
const maxFanOut = 10;

export type LabnanaImageCreateOptions = {
	prompt: string;
	model?: ImageModel;
	lang?: ImagePromptLanguage;
	aspectRatio: AIImageAspectRatio;
	size: AIImageSize;
	quality?: BananaImageQuality;
	reference: string[];
	n: number;
	public: boolean;
	wait: boolean;
	timeout: number;
	json: boolean;
};

type ShardFailure = {
	index: number;
	message: string;
	code?: string;
	status?: number;
	rateLimited: boolean;
};

function describeFailure(index: number, error: unknown): ShardFailure {
	if (error instanceof ListenHubError) {
		return {
			index,
			message: error.message,
			code: error.code,
			status: error.status,
			rateLimited: error.status === 429,
		};
	}

	return {
		index,
		message: error instanceof Error ? error.message : String(error),
		rateLimited: false,
	};
}

export async function createLabnanaImage(
	client: ListenHubClient,
	options: LabnanaImageCreateOptions,
): Promise<void> {
	if (!Number.isInteger(options.n) || options.n < 1 || options.n > maxFanOut) {
		throw new Error(`-n must be an integer between 1 and ${String(maxFanOut)}`);
	}

	if (options.reference.length > maxReferences) {
		throw new Error(`Too many reference images (max ${String(maxReferences)})`);
	}

	// 参考图只上传一次，n 个请求复用同一批 URL。
	const referenceImageUrls =
		options.reference.length > 0
			? await Promise.all(
					options.reference.map(async (ref) => resolveFileOrUrl(client, ref, {accept: 'image'})),
				)
			: undefined;

	// 只有真正扇出时才带 batchId：n=1 时不带，行为与网页端单图生成逐字一致。
	const batchId = options.n > 1 ? randomUUID() : undefined;

	const params = {
		prompt: options.prompt,
		...(options.model && {model: options.model}),
		...(options.lang && {language: options.lang}),
		aspectRatio: options.aspectRatio,
		imageSize: options.size,
		...(options.quality && {quality: options.quality}),
		...(options.public && {isPublic: true}),
		...(referenceImageUrls && {referenceImageUrls}),
		...(batchId && {batchId}),
	};

	// n=1 走原样抛错，保留既有退出码语义（2=auth、3=timeout）。
	if (options.n === 1) {
		const {imageId} = await client.createBananaImage(params);
		await reportSingle(client, imageId, batchId, options);
		return;
	}

	const settled = await Promise.allSettled(
		Array.from({length: options.n}, async () => client.createBananaImage(params)),
	);

	const created: string[] = [];
	const failed: ShardFailure[] = [];
	settled.forEach((result, index) => {
		if (result.status === 'fulfilled') {
			created.push(result.value.imageId);
		} else {
			failed.push(describeFailure(index, result.reason));
		}
	});

	const items = options.wait ? await pollAll(client, created, options) : [];

	if (options.json) {
		printJson({
			batchId,
			requested: options.n,
			created: items.length > 0 ? items : created.map((imageId) => ({imageId})),
			failed,
		});
	} else {
		console.log(
			`✓ Batch ${batchId ?? '-'}: ${String(created.length)}/${String(options.n)} submitted`,
		);
		for (const imageId of created) {
			const item = items.find((entry) => entry.id === imageId);
			console.log(`  ${imageId}${item?.imageUrl ? ` -> ${item.imageUrl}` : ''}`);
		}

		for (const failure of failed) {
			const tag = failure.rateLimited ? 'rate limited' : (failure.code ?? 'error');
			console.error(`  ✗ #${String(failure.index + 1)} (${tag}): ${failure.message}`);
		}
	}

	if (failed.length > 0) {
		// 撞限流按失败计并报出，不静默吞：部分成功也要让调用方看到非零退出码。
		process.exit(1); // eslint-disable-line unicorn/no-process-exit
	}
}

async function reportSingle(
	client: ListenHubClient,
	imageId: string,
	batchId: string | undefined,
	options: LabnanaImageCreateOptions,
): Promise<void> {
	if (!options.wait) {
		if (options.json) {
			printJson({batchId, imageId});
		} else {
			console.log(`✓ Image submitted: ${imageId}`);
		}

		return;
	}

	const item = await pollBananaImageUntilDone(client, imageId, {
		timeout: options.timeout,
		json: options.json,
	});

	if (options.json) {
		printJson(item);
	} else {
		printDetail('Labnana image created', [
			['ID:', item.id],
			['URL:', item.imageUrl],
			['Status:', item.status],
		]);
	}
}

async function pollAll(
	client: ListenHubClient,
	imageIds: string[],
	options: LabnanaImageCreateOptions,
): Promise<BananaImageItem[]> {
	// 多个 spinner 会互相盖掉，扇出时统一走无 spinner 轮询，结果一次性打印。
	const settled = await Promise.allSettled(
		imageIds.map(async (imageId) =>
			pollBananaImageUntilDone(client, imageId, {timeout: options.timeout, json: true}),
		),
	);

	return settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

export type LabnanaImageListOptions = {
	page: number;
	pageSize: number;
	scope: BananaImageScope;
	json: boolean;
};

export async function listLabnanaImages(
	client: ListenHubClient,
	options: LabnanaImageListOptions,
): Promise<void> {
	const {items} = await client.listBananaImages({
		page: options.page,
		pageSize: options.pageSize,
		scope: options.scope,
	});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['ID', 'Prompt', 'Model', 'Created'];
	const rows = items.map((image) => [
		image.id,
		image.prompt.slice(0, 40),
		image.modelName ?? '-',
		new Date(image.createdAt).toISOString().slice(0, 10),
	]);
	printTable(headers, rows);
}

export async function getLabnanaImage(
	client: ListenHubClient,
	imageId: string,
	json: boolean,
): Promise<void> {
	const item = await client.getBananaImage(imageId);

	if (json) {
		printJson(item);
		return;
	}

	printDetail('Labnana image details', [
		['ID:', item.id],
		['Prompt:', item.prompt],
		['URL:', item.imageUrl],
		['Size:', item.imageSize],
		['Ratio:', item.aspectRatio],
		['Model:', item.modelName],
		['Status:', item.status],
		['Created:', new Date(item.createdAt).toISOString()],
	]);
}
