import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';

const mimeTypes = new Map<string, string>([
	['.mp3', 'audio/mpeg'],
	['.wav', 'audio/wav'],
	['.flac', 'audio/flac'],
	['.m4a', 'audio/mp4'],
	['.ogg', 'audio/ogg'],
	['.aac', 'audio/aac'],
]);

const maxFiles = 6;

export interface ReferenceAudio {
	files: Blob[];
	filenames: string[];
}

/**
 * Load local reference audio for a voice-clone request. Only the checks that
 * would otherwise waste a round trip run here — per-file and total size limits
 * stay with the server, which owns them.
 */
export async function readReferenceAudio(inputs: string[]): Promise<ReferenceAudio> {
	if (inputs.length === 0) {
		throw new Error('At least one reference audio file is required');
	}

	if (inputs.length > maxFiles) {
		throw new Error(`Too many reference audio files: ${inputs.length} (max ${maxFiles})`);
	}

	const files: Blob[] = [];
	const filenames: string[] = [];

	for (const input of inputs) {
		const filePath = path.resolve(input.trim());

		// eslint-disable-next-line no-await-in-loop
		const fileStat = await stat(filePath).catch(() => {
			throw new Error(`File not found: ${input}`);
		});

		if (!fileStat.isFile()) {
			throw new Error(`Not a file: ${input}`);
		}

		const ext = path.extname(filePath).toLowerCase();
		// eslint-disable-next-line no-await-in-loop
		const buffer = await readFile(filePath);
		files.push(new Blob([buffer], {type: mimeTypes.get(ext) ?? 'application/octet-stream'}));
		filenames.push(path.basename(filePath));
	}

	return {files, filenames};
}
