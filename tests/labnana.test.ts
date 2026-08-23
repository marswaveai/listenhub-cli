import {describe, expect, it, vi} from 'vitest';
import {createLabnanaImage, type LabnanaImageCreateOptions} from '../source/labnana/image.js';

type FakeClient = {
	createBananaImage: ReturnType<typeof vi.fn>;
	getBananaImage: ReturnType<typeof vi.fn>;
};

function makeOptions(
	overrides: Partial<LabnanaImageCreateOptions> = {},
): LabnanaImageCreateOptions {
	return {
		prompt: 'a cat',
		aspectRatio: '1:1',
		size: '2K',
		reference: [],
		n: 1,
		public: false,
		wait: false,
		timeout: 120,
		json: true,
		...overrides,
	};
}

function makeClient(ids: string[]): FakeClient {
	let index = 0;
	return {
		createBananaImage: vi.fn(async () => {
			const imageId = ids[index] ?? `img-${String(index)}`;
			index += 1;
			return {imageId};
		}),
		getBananaImage: vi.fn(async () => ({id: 'img', status: 'success'})),
	};
}

describe('labnana image create', () => {
	it('n>1 发出 n 个请求且共享同一个 batchId（后端没有张数入参）', async () => {
		const client = makeClient(['a', 'b', 'c']);
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		await createLabnanaImage(client as never, makeOptions({n: 3}));

		expect(client.createBananaImage).toHaveBeenCalledTimes(3);
		const batchIds = client.createBananaImage.mock.calls.map(
			([params]) => (params as {batchId?: string}).batchId,
		);
		expect(new Set(batchIds).size).toBe(1);
		expect(batchIds[0]).toBeTruthy();
		log.mockRestore();
	});

	it('n=1 不带 batchId，与网页端单图生成行为一致', async () => {
		const client = makeClient(['a']);
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		await createLabnanaImage(client as never, makeOptions({n: 1}));

		const [params] = client.createBananaImage.mock.calls[0] as [{batchId?: string}];
		expect(params.batchId).toBeUndefined();
		log.mockRestore();
	});

	it('撞限流的分片按失败计并报出，不静默吞，进程以非零码退出', async () => {
		const client = makeClient(['a', 'b']);
		client.createBananaImage
			.mockImplementationOnce(async () => ({imageId: 'a'}))
			.mockImplementationOnce(async () => {
				const error = new Error('Too many image generation requests.');
				Object.assign(error, {status: 429, code: '429'});
				throw error;
			});
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

		await createLabnanaImage(client as never, makeOptions({n: 2, json: false}));

		expect(exit).toHaveBeenCalledWith(1);
		const reported = errorLog.mock.calls.flat().join(' ');
		expect(reported).toContain('Too many image generation requests');
		log.mockRestore();
		errorLog.mockRestore();
		exit.mockRestore();
	});

	it('拒绝越界的 -n，而不是静默截断', async () => {
		const client = makeClient([]);
		await expect(createLabnanaImage(client as never, makeOptions({n: 0}))).rejects.toThrow(
			/between 1 and 10/,
		);
		await expect(createLabnanaImage(client as never, makeOptions({n: 11}))).rejects.toThrow(
			/between 1 and 10/,
		);
		expect(client.createBananaImage).not.toHaveBeenCalled();
	});

	it('参考图超过 banana 的 14 张上限时先在客户端拒绝', async () => {
		const client = makeClient([]);
		const reference = Array.from({length: 15}, (_, i) => `https://example.test/${String(i)}.png`);
		await expect(createLabnanaImage(client as never, makeOptions({reference}))).rejects.toThrow(
			/max 14/,
		);
		expect(client.createBananaImage).not.toHaveBeenCalled();
	});
});
