import fs from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import type {ReadableStream as NodeReadableStream} from 'node:stream/web';
import type {Command} from 'commander';
import type {OpenAPIClient} from '@marswave/listenhub-sdk';
import {handleError, printJson} from '../_shared/output.js';
import {SPEED_FLAG_DESCRIPTION, parseSpeed} from '../_shared/speed.js';
import {getOpenAPIClient} from './client.js';

type TtsOptions = {
	text: string;
	voice: string;
	output: string;
	format: string;
	speed?: number;
};

type SpeechOptions = {
	script: string;
	speakerId: string;
	speed?: number;
	json: boolean;
};

async function saveStreamingAudio(response: Response, outputFile: string): Promise<void> {
	const outputPath = path.resolve(outputFile);
	const body = response.body;
	if (!body) {
		throw new Error('Empty response body');
	}

	const writeStream = fs.createWriteStream(outputPath);
	await pipeline(Readable.fromWeb(body as NodeReadableStream), writeStream);

	const stat = fs.statSync(outputPath);
	console.log(`✓ Audio saved: ${outputPath} (${formatBytes(stat.size)})`);
}

async function runTts(client: OpenAPIClient, options: TtsOptions): Promise<void> {
	const response = await client.tts({
		input: options.text,
		voice: options.voice,
		response_format: options.format as 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | undefined,
		speed: options.speed,
	});
	await saveStreamingAudio(response, options.output);
}

async function runAudioSpeech(client: OpenAPIClient, options: TtsOptions): Promise<void> {
	const response = await client.audioSpeech({
		input: options.text,
		voice: options.voice,
		response_format: options.format as 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm' | undefined,
		speed: options.speed,
	});
	await saveStreamingAudio(response, options.output);
}

async function runSpeech(client: OpenAPIClient, options: SpeechOptions): Promise<void> {
	const result = await client.speech({
		scripts: [{content: options.script, speakerId: options.speakerId}],
		speed: options.speed,
	});

	if (options.json) {
		printJson(result);
		return;
	}

	console.log(`✓ Speech created`);
	console.log(`  Audio:    ${result.audioUrl}`);
	console.log(`  Duration: ${String(result.audioDuration)}s`);
	console.log(`  Credits:  ${String(result.credits)}`);
	if (result.subtitlesUrl) {
		console.log(`  Subs:     ${result.subtitlesUrl}`);
	}
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${String(bytes)}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function register(openapi: Command) {
	openapi
		.command('tts')
		.description('Text-to-speech (binary audio output)')
		.requiredOption('--text <text>', 'Text to convert')
		.requiredOption('--voice <speakerId>', 'Speaker ID')
		.requiredOption('--output <file>', 'Output file path')
		.option('--format <format>', 'Audio format: mp3, opus, aac, flac, wav, pcm', 'mp3')
		.option('--speed <multiplier>', SPEED_FLAG_DESCRIPTION, parseSpeed)
		.action(async (options: TtsOptions) => {
			try {
				const client = await getOpenAPIClient();
				await runTts(client, options);
			} catch (error) {
				handleError(error, false);
			}
		});

	openapi
		.command('audio-speech')
		.description('Text-to-speech (OpenAI /v1/audio/speech compatible)')
		.requiredOption('--text <text>', 'Text to convert')
		.requiredOption('--voice <speakerId>', 'Speaker ID')
		.requiredOption('--output <file>', 'Output file path')
		.option('--format <format>', 'Audio format: mp3, opus, aac, flac, wav, pcm', 'mp3')
		.option('--speed <multiplier>', SPEED_FLAG_DESCRIPTION, parseSpeed)
		.action(async (options: TtsOptions) => {
			try {
				const client = await getOpenAPIClient();
				await runAudioSpeech(client, options);
			} catch (error) {
				handleError(error, false);
			}
		});

	openapi
		.command('speech')
		.description('Create speech (returns audio URL)')
		.requiredOption('--script <content>', 'Script text')
		.requiredOption('--speaker-id <id>', 'Speaker ID')
		.option('--speed <multiplier>', SPEED_FLAG_DESCRIPTION, parseSpeed)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: SpeechOptions) => {
			try {
				const client = await getOpenAPIClient();
				await runSpeech(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
