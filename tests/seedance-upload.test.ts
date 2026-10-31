import {afterEach, describe, expect, it, vi} from 'vitest';
import {resolveFileOrUrl} from '../source/_shared/upload.js';
const file = vi.hoisted(() => ({size: 0}));
vi.mock('node:fs/promises', () => ({
	access: vi.fn(),
	stat: vi.fn(async () => ({size: file.size})),
	readFile: vi.fn(async () => Buffer.from('video')),
}));
afterEach(() => vi.unstubAllGlobals());
const client = {
	createFileUpload: vi.fn(async () => ({
		presignedUrl: 'https://upload.example.com',
		fileUrl: 'https://media.example.com/file',
	})),
};
describe('Seedance 2.5 upload limits', () => {
	it('accepts a 60 MB video only with the model-specific 200 MB limit', async () => {
		file.size = 60 * 1024 * 1024;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', {status: 200})),
		);
		await expect(
			resolveFileOrUrl(client, '/tmp/reference.mp4', {
				accept: 'video',
				maxSizeBytes: 200 * 1024 * 1024,
			}),
		).resolves.toBe('https://media.example.com/file');
		await expect(resolveFileOrUrl(client, '/tmp/reference.mp4', {accept: 'video'})).rejects.toThrow(
			/max 50/,
		);
	});
	it('rejects over 200 MB before requesting an upload', async () => {
		file.size = 201 * 1024 * 1024;
		await expect(
			resolveFileOrUrl(client, '/tmp/reference.mov', {
				accept: 'video',
				maxSizeBytes: 200 * 1024 * 1024,
			}),
		).rejects.toThrow(/max 200/);
	});
	it('rejects audio over 15 MB and unsupported audio codecs', async () => {
		file.size = 16 * 1024 * 1024;
		await expect(
			resolveFileOrUrl(client, '/tmp/reference.mp3', {
				accept: 'audio',
				maxSizeBytes: 15 * 1024 * 1024,
				extensions: ['.mp3', '.wav'],
			}),
		).rejects.toThrow(/max 15/);
		file.size = 100;
		await expect(
			resolveFileOrUrl(client, '/tmp/reference.flac', {
				accept: 'audio',
				maxSizeBytes: 15 * 1024 * 1024,
				extensions: ['.mp3', '.wav'],
			}),
		).rejects.toThrow(/Unsupported audio format/);
	});
});
