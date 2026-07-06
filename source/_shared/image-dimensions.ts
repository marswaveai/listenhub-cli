import {readFile, stat} from 'node:fs/promises';
import type {VideoReferenceImageMeta, VideoReferenceImageRole} from './video-reference-metadata.js';

type ImageDimensions = {
	width: number;
	height: number;
};

function byte(data: Uint8Array, index: number): number {
	const value = data[index];
	if (typeof value !== 'number') throw new Error('Cannot read image dimensions: file is truncated');
	return value;
}

function readUint16BE(data: Uint8Array, offset: number): number {
	return (byte(data, offset) << 8) + byte(data, offset + 1);
}

function readUint16LE(data: Uint8Array, offset: number): number {
	return byte(data, offset) + (byte(data, offset + 1) << 8);
}

function readUint24LE(data: Uint8Array, offset: number): number {
	return byte(data, offset) + (byte(data, offset + 1) << 8) + (byte(data, offset + 2) << 16);
}

function readUint32BE(data: Uint8Array, offset: number): number {
	return (
		(byte(data, offset) << 24) +
		(byte(data, offset + 1) << 16) +
		(byte(data, offset + 2) << 8) +
		byte(data, offset + 3)
	);
}

function matches(data: Uint8Array, offset: number, text: string): boolean {
	return Array.from(text).every((char, index) => byte(data, offset + index) === char.charCodeAt(0));
}

function parsePng(data: Uint8Array): ImageDimensions | undefined {
	if (
		data.length < 24 ||
		byte(data, 0) !== 0x89 ||
		!matches(data, 1, 'PNG') ||
		!matches(data, 12, 'IHDR')
	) {
		return undefined;
	}

	return {width: readUint32BE(data, 16), height: readUint32BE(data, 20)};
}

function parseGif(data: Uint8Array): ImageDimensions | undefined {
	if (data.length < 10 || (!matches(data, 0, 'GIF87a') && !matches(data, 0, 'GIF89a'))) {
		return undefined;
	}

	return {width: readUint16LE(data, 6), height: readUint16LE(data, 8)};
}

function parseJpeg(data: Uint8Array): ImageDimensions | undefined {
	if (data.length < 4 || byte(data, 0) !== 0xff || byte(data, 1) !== 0xd8) return undefined;

	let offset = 2;
	while (offset + 9 < data.length) {
		if (byte(data, offset) !== 0xff) {
			offset += 1;
			continue;
		}

		let marker = byte(data, offset + 1);
		while (marker === 0xff) {
			offset += 1;
			marker = byte(data, offset + 1);
		}

		if (marker === 0xd9 || marker === 0xda) break;
		const length = readUint16BE(data, offset + 2);
		if (length < 2) break;

		const isStartOfFrame =
			(marker >= 0xc0 && marker <= 0xc3) ||
			(marker >= 0xc5 && marker <= 0xc7) ||
			(marker >= 0xc9 && marker <= 0xcb) ||
			(marker >= 0xcd && marker <= 0xcf);
		if (isStartOfFrame) {
			return {height: readUint16BE(data, offset + 5), width: readUint16BE(data, offset + 7)};
		}

		offset += 2 + length;
	}

	return undefined;
}

function parseWebp(data: Uint8Array): ImageDimensions | undefined {
	if (data.length < 30 || !matches(data, 0, 'RIFF') || !matches(data, 8, 'WEBP')) {
		return undefined;
	}

	const chunk = String.fromCharCode(byte(data, 12), byte(data, 13), byte(data, 14), byte(data, 15));
	if (chunk === 'VP8X') {
		return {width: readUint24LE(data, 24) + 1, height: readUint24LE(data, 27) + 1};
	}

	if (chunk === 'VP8 ' && matches(data, 23, '\u009d\u0001*')) {
		return {
			width: readUint16LE(data, 26) & 0x3fff,
			height: readUint16LE(data, 28) & 0x3fff,
		};
	}

	if (chunk === 'VP8L' && byte(data, 20) === 0x2f) {
		const b1 = byte(data, 21);
		const b2 = byte(data, 22);
		const b3 = byte(data, 23);
		const b4 = byte(data, 24);
		return {
			width: 1 + (((b2 & 0x3f) << 8) | b1),
			height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
		};
	}

	return undefined;
}

async function readImageDimensions(filePath: string): Promise<ImageDimensions> {
	const data = await readFile(filePath);
	const dimensions = parsePng(data) ?? parseGif(data) ?? parseJpeg(data) ?? parseWebp(data);
	if (!dimensions) {
		throw new Error('Cannot read image dimensions: unsupported or invalid image file');
	}

	return dimensions;
}

export async function readLocalImageMeta(
	filePath: string,
	role: VideoReferenceImageRole,
): Promise<VideoReferenceImageMeta> {
	const [{width, height}, fileStat] = await Promise.all([
		readImageDimensions(filePath),
		stat(filePath),
	]);
	return {role, width, height, size: fileStat.size};
}
