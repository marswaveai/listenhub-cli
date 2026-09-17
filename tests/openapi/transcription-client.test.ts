import {createServer, type Server} from 'node:http';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {ListenHubError, OpenAPIClient} from '@marswave/listenhub-sdk';
import {transcriptionClient} from '../../source/openapi/transcription-client.js';

let server: Server;
let client: ReturnType<typeof transcriptionClient>;
let responseStatus: number;
let responseBody: unknown;
const requests: Array<{path: string; method: string; authorization?: string; body: unknown}> = [];

beforeEach(async () => {
	requests.length = 0;
	responseStatus = 200;
	responseBody = {code: 0, data: {}};
	server = createServer((request, response) => {
		const chunks: Buffer[] = [];
		request.on('data', (chunk: Buffer) => chunks.push(chunk));
		request.on('end', () => {
			const body = Buffer.concat(chunks).toString();
			requests.push({
				path: request.url!,
				method: request.method!,
				authorization: request.headers.authorization,
				body: body ? JSON.parse(body) : undefined,
			});
			response.writeHead(responseStatus, {'Content-Type': 'application/json'});
			response.end(JSON.stringify(responseBody));
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Missing test server address');
	client = transcriptionClient(
		new OpenAPIClient({
			apiKey: 'lh_sk_test',
			baseURL: `http://127.0.0.1:${address.port}/openapi`,
			maxRetries: 0,
		}),
	);
});

afterEach(async () => {
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
});

describe('transcription adapter with installed SDK transport', () => {
	it('uses SDK authentication, API prefix and response unwrapping for every route', async () => {
		const payload = {id: 'task-1', status: 'queued', reservedCredits: 2};
		responseBody = {code: 0, data: payload};
		const upload = {fileName: 'voice.wav', contentType: 'audio/wav', fileSize: 32};
		const create = {
			fileKey: 'uploads/user/source.wav',
			fileName: 'voice.wav',
			durationMs: 60001,
			idempotencyKey: 'stable-key',
			terms: ['ListenHub'],
		};
		expect(await client.estimate(60001)).toEqual(payload);
		expect(await client.upload(upload)).toEqual(payload);
		expect(await client.create(create)).toEqual(payload);
		expect(await client.get('task-1')).toEqual(payload);
		expect(await client.transcript('task-1')).toEqual(payload);
		expect(requests).toEqual([
			{
				path: '/openapi/v1/audio-transcriptions/estimate-credits',
				method: 'POST',
				authorization: 'Bearer lh_sk_test',
				body: {durationMs: 60001},
			},
			{
				path: '/openapi/v1/audio-transcriptions/uploads',
				method: 'POST',
				authorization: 'Bearer lh_sk_test',
				body: upload,
			},
			{
				path: '/openapi/v1/audio-transcriptions',
				method: 'POST',
				authorization: 'Bearer lh_sk_test',
				body: create,
			},
			{
				path: '/openapi/v1/audio-transcriptions/task-1',
				method: 'GET',
				authorization: 'Bearer lh_sk_test',
				body: undefined,
			},
			{
				path: '/openapi/v1/audio-transcriptions/task-1/transcript',
				method: 'GET',
				authorization: 'Bearer lh_sk_test',
				body: undefined,
			},
		]);
	});

	it('preserves SDK errors for auth failures', async () => {
		responseStatus = 401;
		responseBody = {code: 401, message: 'Invalid API key', request_id: 'request-1'};
		await expect(client.get('task-1')).rejects.toMatchObject({
			name: 'ListenHubError',
			status: 401,
			code: '401',
			message: 'Invalid API key',
			requestId: 'request-1',
		});
	});

	it('preserves SDK business errors instead of treating them as successful data', async () => {
		responseBody = {code: 40001, message: 'Insufficient credits'};
		await expect(client.estimate(1000)).rejects.toBeInstanceOf(ListenHubError);
	});

	it('encodes task ids as a single path segment', async () => {
		await client.transcript('unsafe/../id?x=1');
		expect(requests[0]!.path).toBe(
			'/openapi/v1/audio-transcriptions/unsafe%2F..%2Fid%3Fx%3D1/transcript',
		);
	});

	it('fails clearly if a future SDK removes the expected transport', () => {
		for (const value of [null, {}, {api: {}}, {api: {get() {}}}]) {
			expect(() => transcriptionClient(value)).toThrow('no compatible OpenAPI transport');
		}
	});
});
