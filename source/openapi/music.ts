import type {Command} from 'commander';
import type {
	CreateMusicGenerateParams,
	CreateMusicInstrumentalParams,
	CreateMusicSoundtrackParams,
	CreateMusicTrackParams,
	CreateMusicRemixParams,
	MusicModel,
	MusicTaskDetail,
	MusicTaskStatus,
} from '@marswave/listenhub-sdk';
import {handleError, printDetail, printJson, printTable} from '../_shared/output.js';
import {formatDuration, printMusicDetail, readFileAsBlob, toSeconds} from '../music/music.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

// All commands here authenticate with an OpenAPI key (lh_sk_…) against the
// /openapi base, mirroring the OAuth-based top-level `music` command group.
// Default provider is Mureka. Async commands poll GET /v1/music/tasks/:id.

type WaitOptions = {wait: boolean; timeout: string; json: boolean};

async function emitTask(taskId: string, options: WaitOptions, label: string): Promise<void> {
	const client = await getOpenAPIClient();
	if (!options.wait) {
		if (options.json) {
			printJson({taskId});
		} else {
			console.log(`✓ Music task submitted: ${taskId}`);
		}

		return;
	}

	const task = await pollOpenAPI<MusicTaskDetail>({
		getStatus: async () => client.getMusicTask(taskId),
		isDone: (r) => r.status === 'success',
		isFailed: (r) => r.status === 'failed',
		getErrorMessage: (r) => r.errorMessage ?? `${label} failed`,
		options: {timeout: Number(options.timeout), label, json: options.json},
	});

	if (options.json) {
		printJson(task);
	} else {
		printMusicDetail(task);
	}
}

export function register(openapi: Command) {
	const music = openapi.command('music').description('AI music generation (Mureka)');

	music
		.command('generate')
		.description('Generate music from a text prompt and/or lyrics')
		.option('--prompt <text>', 'Music description')
		.option('--lyrics <text>', 'Song lyrics')
		.option('--style <text>', 'Music style/mood')
		.option('--title <text>', 'Track title')
		.option('--model <model>', 'Model: auto, mureka-7.6, mureka-8, mureka-9, mureka-o2')
		.option('--instrumental', 'Instrumental only, no vocals', false)
		.option('--vocal-id <id>', 'Reusable vocal id')
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', '600')
		.option('-j, --json', 'Output JSON', false)
		.action(
			async (
				options: WaitOptions & {
					prompt?: string;
					lyrics?: string;
					style?: string;
					title?: string;
					model?: string;
					instrumental: boolean;
					vocalId?: string;
				},
			) => {
				try {
					if (!options.prompt && !options.lyrics) {
						throw new Error('Provide at least one of: --prompt, --lyrics');
					}

					const params: CreateMusicGenerateParams = {
						...(options.prompt && {prompt: options.prompt}),
						...(options.lyrics && {lyrics: options.lyrics}),
						...(options.style && {style: options.style}),
						...(options.title && {title: options.title}),
						...(options.model && {model: options.model as MusicModel}),
						...(options.instrumental && {instrumental: true}),
						...(options.vocalId && {vocalId: options.vocalId}),
					};
					const client = await getOpenAPIClient();
					const {taskId} = await client.createMusicGenerate(params);
					await emitTask(taskId, options, 'Generating music');
				} catch (error) {
					handleError(error, options.json);
				}
			},
		);

	music
		.command('remix [audio]')
		.description('Remix an existing song with new lyrics')
		.option('--audio-url <url>', 'Reference audio URL instead of a file')
		.option('--provider-song-id <id>', 'Mureka song id instead of a file')
		.requiredOption('--lyrics <text>', 'Lyrics for the remixed song')
		.requiredOption('--prompt <text>', 'Music description')
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', '600')
		.option('-j, --json', 'Output JSON', false)
		.action(
			async (
				audio: string | undefined,
				options: WaitOptions & {
					audioUrl?: string;
					providerSongId?: string;
					lyrics: string;
					prompt: string;
				},
			) => {
				try {
					const sources = [audio, options.audioUrl, options.providerSongId].filter(Boolean);
					if (sources.length !== 1) {
						throw new Error(
							'Provide exactly one of: <audio file>, --audio-url, --provider-song-id',
						);
					}

					const params: CreateMusicRemixParams = {lyrics: options.lyrics, prompt: options.prompt};
					if (audio) {
						const {blob, filename} = await readFileAsBlob(audio, 'audio');
						params.audio = blob;
						params.audioFilename = filename;
					} else if (options.audioUrl) {
						params.audioUrl = options.audioUrl;
					} else if (options.providerSongId) {
						params.providerSongId = options.providerSongId;
					}

					const client = await getOpenAPIClient();
					const {taskId} = await client.createMusicRemix(params);
					await emitTask(taskId, options, 'Remixing music');
				} catch (error) {
					handleError(error, options.json);
				}
			},
		);

	music
		.command('instrumental')
		.description('Generate a standalone instrumental')
		.option('--prompt <text>', 'Music description')
		.option('--reference-audio <path>', 'Reference audio file (mp3/m4a, max 10MB)')
		.option('--model <model>', 'Model: auto, mureka-7.6, mureka-8, mureka-9, mureka-o2')
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', '600')
		.option('-j, --json', 'Output JSON', false)
		.action(
			async (options: WaitOptions & {prompt?: string; referenceAudio?: string; model?: string}) => {
				try {
					if (Boolean(options.prompt) === Boolean(options.referenceAudio)) {
						throw new Error('Provide exactly one of: --prompt, --reference-audio <file>');
					}

					const params: CreateMusicInstrumentalParams = {
						...(options.model && {model: options.model as MusicModel}),
					};
					if (options.prompt) {
						params.prompt = options.prompt;
					} else if (options.referenceAudio) {
						const {blob, filename} = await readFileAsBlob(options.referenceAudio, 'audio');
						params.referenceAudio = blob;
						params.referenceAudioFilename = filename;
					}

					const client = await getOpenAPIClient();
					const {taskId} = await client.createMusicInstrumental(params);
					await emitTask(taskId, options, 'Generating instrumental');
				} catch (error) {
					handleError(error, options.json);
				}
			},
		);

	music
		.command('soundtrack')
		.description('Generate music from an image or video')
		.option('--image <path>', 'Source image (jpg/jpeg/png/webp, max 10MB)')
		.option('--video <path>', 'Source video (mp4/mov/avi/mkv/webm, max 10MB)')
		.option('--prompt <text>', 'Music description')
		.option('--model <model>', 'Model: auto, mureka-7.6, mureka-8, mureka-9, mureka-o2')
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', '600')
		.option('-j, --json', 'Output JSON', false)
		.action(
			async (
				options: WaitOptions & {image?: string; video?: string; prompt?: string; model?: string},
			) => {
				try {
					if (Boolean(options.image) === Boolean(options.video)) {
						throw new Error('Provide exactly one of: --image <file>, --video <file>');
					}

					const params: CreateMusicSoundtrackParams = {
						...(options.prompt && {prompt: options.prompt}),
						...(options.model && {model: options.model as MusicModel}),
					};
					if (options.image) {
						const {blob, filename} = await readFileAsBlob(options.image, 'image');
						params.image = blob;
						params.imageFilename = filename;
					} else if (options.video) {
						const {blob, filename} = await readFileAsBlob(options.video, 'video');
						params.video = blob;
						params.videoFilename = filename;
					}

					const client = await getOpenAPIClient();
					const {taskId} = await client.createMusicSoundtrack(params);
					await emitTask(taskId, options, 'Generating soundtrack');
				} catch (error) {
					handleError(error, options.json);
				}
			},
		);

	music
		.command('track [audio]')
		.description('Generate a single instrument/vocal track')
		.option('--provider-song-id <id>', 'Mureka song id instead of a file')
		.requiredOption('--generate-type <type>', 'Vocals, Instrumental, Drums, Bass, Guitar, ...')
		.requiredOption('--prompt <text>', 'Music description')
		.option('--lyrics <text>', 'Lyrics (required when --generate-type is Vocals)')
		.option('--vocal-gender <gender>', 'male or female')
		.option('--generate-start <seconds>', 'Range start in seconds', Number)
		.option('--generate-end <seconds>', 'Range end in seconds', Number)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', '600')
		.option('-j, --json', 'Output JSON', false)
		.action(
			async (
				audio: string | undefined,
				options: WaitOptions & {
					providerSongId?: string;
					generateType: string;
					prompt: string;
					lyrics?: string;
					vocalGender?: string;
					generateStart?: number;
					generateEnd?: number;
				},
			) => {
				try {
					if (Boolean(audio) === Boolean(options.providerSongId)) {
						throw new Error('Provide exactly one of: <audio file>, --provider-song-id');
					}

					if (options.generateType === 'Vocals' && !options.lyrics) {
						throw new Error('--lyrics is required when --generate-type is Vocals');
					}

					const params: CreateMusicTrackParams = {
						generateType: options.generateType as CreateMusicTrackParams['generateType'],
						prompt: options.prompt,
						...(options.lyrics && {lyrics: options.lyrics}),
						...(options.vocalGender && {
							vocalGender: options.vocalGender as CreateMusicTrackParams['vocalGender'],
						}),
						...(options.generateStart !== undefined && {generateStart: options.generateStart}),
						...(options.generateEnd !== undefined && {generateEnd: options.generateEnd}),
					};
					if (audio) {
						const {blob, filename} = await readFileAsBlob(audio, 'audio', {audioWav: true});
						params.audio = blob;
						params.audioFilename = filename;
					} else if (options.providerSongId) {
						params.providerSongId = options.providerSongId;
					}

					const client = await getOpenAPIClient();
					const {taskId} = await client.createMusicTrack(params);
					await emitTask(taskId, options, 'Generating track');
				} catch (error) {
					handleError(error, options.json);
				}
			},
		);

	music
		.command('recognize')
		.description('Recognize lyrics (with timestamps) from audio')
		.requiredOption('--audio <path>', 'Audio file (mp3/m4a, max 10MB)')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {audio: string; json: boolean}) => {
			try {
				const {blob, filename} = await readFileAsBlob(options.audio, 'audio');
				const client = await getOpenAPIClient();
				const result = await client.recognizeMusic({audio: blob, audioFilename: filename});
				if (options.json) {
					printJson(result);
					return;
				}

				printDetail('Music recognition', [
					['ID:', result.id],
					['Duration:', formatDuration(toSeconds(result.result.duration))],
					['Sections:', result.result.lyricsSections.length],
					['Credit cost:', result.creditCost],
				]);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	music
		.command('describe')
		.description('Analyze audio: description, tags, genres, instruments')
		.requiredOption('--audio <path>', 'Audio file (mp3/m4a, max 10MB)')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {audio: string; json: boolean}) => {
			try {
				const {blob, filename} = await readFileAsBlob(options.audio, 'audio');
				const client = await getOpenAPIClient();
				const result = await client.describeMusic({audio: blob, audioFilename: filename});
				if (options.json) {
					printJson(result);
					return;
				}

				printDetail('Music description', [
					['ID:', result.id],
					['Description:', result.result.description],
					['Tags:', result.result.tags.join(', ') || '—'],
					['Genres:', result.result.genres.join(', ') || '—'],
					['Instruments:', result.result.instruments.join(', ') || '—'],
					['Credit cost:', result.creditCost],
				]);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	music
		.command('stem')
		.description('Separate audio into stems, returns download URLs')
		.requiredOption('--audio <path>', 'Audio file (mp3/m4a, max 10MB)')
		.option('--model <model>', 'audio-separation-1 or audio-separation-2')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {audio: string; model?: string; json: boolean}) => {
			try {
				const {blob, filename} = await readFileAsBlob(options.audio, 'audio');
				const client = await getOpenAPIClient();
				const result = await client.stemMusic({
					audio: blob,
					audioFilename: filename,
					...(options.model && {
						model: options.model as 'audio-separation-1' | 'audio-separation-2',
					}),
				});
				if (options.json) {
					printJson(result);
					return;
				}

				printDetail('Music stems', [
					['ID:', result.id],
					['Stems (zip):', result.result.zipUrl],
					['MIDI (zip):', result.result.midiZipUrl ?? '—'],
					['Credit cost:', result.creditCost],
				]);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	music
		.command('list')
		.description('List music tasks')
		.option('--page <n>', 'Page number', '1')
		.option('--page-size <n>', 'Items per page', '20')
		.option('--status <status>', 'Filter: pending, generating, uploading, success, failed')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {page: string; pageSize: string; status?: string; json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				const {items} = await client.listMusicTasks({
					page: Number(options.page),
					pageSize: Number(options.pageSize),
					...(options.status && {status: options.status as MusicTaskStatus}),
				});
				if (options.json) {
					printJson({items});
					return;
				}

				printTable(
					['ID', 'Type', 'Status', 'Title', 'Tracks', 'Created'],
					items.map((task) => [
						task.id,
						task.taskType.toLowerCase(),
						task.status,
						task.tracks[0]?.title ?? task.params.title ?? '—',
						String(task.tracks.length),
						new Date(task.createdAt).toLocaleDateString('sv-SE'),
					]),
				);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	music
		.command('get <taskId>')
		.description('Get music task details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				const task = await client.getMusicTask(taskId);
				if (options.json) {
					printJson(task);
				} else {
					printMusicDetail(task);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
