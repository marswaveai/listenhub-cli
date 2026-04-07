import {access, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import type {ListenHubClient} from '@marswave/listenhub-sdk';

type FileAcceptType = 'audio' | 'image';

const audioExtensions = new Set([
	'.mp3',
	'.wav',
	'.flac',
	'.m4a',
	'.ogg',
	'.aac',
]);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const maxSizeBytes: Record<FileAcceptType, number> = {
	audio: 20 * 1024 * 1024,
	image: 10 * 1024 * 1024,
};

const categoryForType: Record<FileAcceptType, string> = {
	audio: 'episode',
	image: 'banana',
};

const mimeTypes = new Map<string, string>([
	['.mp3', 'audio/mpeg'],
	['.wav', 'audio/wav'],
	['.flac', 'audio/flac'],
	['.m4a', 'audio/mp4'],
	['.ogg', 'audio/ogg'],
	['.aac', 'audio/aac'],
	['.jpg', 'image/jpeg'],
	['.jpeg', 'image/jpeg'],
	['.png', 'image/png'],
	['.webp', 'image/webp'],
	['.gif', 'image/gif'],
]);

function allowedExtensions(accept: FileAcceptType): Set<string> {
	return accept === 'audio' ? audioExtensions : imageExtensions;
}

export async function resolveFileOrUrl(
	client: ListenHubClient,
	input: string,
	options: {accept: FileAcceptType},
): Promise<string> {
	const trimmed = input.trim();

	// URL — pass through
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}

	// Local file — resolve to absolute path
	const filePath = path.resolve(trimmed);

	// Existence check
	try {
		await access(filePath);
	} catch {
		throw new Error(`File not found: ${trimmed}`);
	}

	// Extension check
	const ext = path.extname(filePath).toLowerCase();
	const allowed = allowedExtensions(options.accept);
	if (!allowed.has(ext)) {
		const expected = [...allowed].join(', ');
		throw new Error(
			`Unsupported ${options.accept} format: ${ext} (expected: ${expected})`,
		);
	}

	// Size check
	const fileStat = await stat(filePath);
	const maxBytes = maxSizeBytes[options.accept];
	if (fileStat.size > maxBytes) {
		const sizeMb = (fileStat.size / (1024 * 1024)).toFixed(1);
		const maxMb = maxBytes / (1024 * 1024);
		throw new Error(
			`File too large: ${sizeMb} MB (max ${String(maxMb)} MB for ${options.accept})`,
		);
	}

	// Get presigned upload URL
	const contentType = mimeTypes.get(ext)!;
	const fileKey = path.basename(filePath);
	const category = categoryForType[options.accept];
	const {presignedUrl, fileUrl} = await client.createFileUpload({
		fileKey,
		contentType,
		category,
	});

	// Upload to GCS
	const buffer = await readFile(filePath);
	const response = await fetch(presignedUrl, {
		method: 'PUT',
		body: buffer,
		headers: {
			'Content-Type': contentType,
			'Content-Length': String(buffer.length),
		},
	});

	if (!response.ok) {
		throw new Error(
			`Upload failed: ${String(response.status)} ${response.statusText}`,
		);
	}

	// Get presigned download URL (fileUrl is not publicly accessible)
	const {downloadUrl} = await client.getFileDownloadUrl(fileUrl);
	return downloadUrl;
}
