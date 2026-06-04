import {type Command, Option} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {
	type MusicCoverOptions,
	type MusicDescribeOptions,
	type MusicExtendOptions,
	type MusicGenerateOptions,
	type MusicInstrumentalOptions,
	type MusicListOptions,
	type MusicRecognizeOptions,
	type MusicRegionEditOptions,
	type MusicRemixOptions,
	type MusicSoundtrackOptions,
	type MusicStemOptions,
	type MusicTrackOptions,
	type MusicVocalCloneOptions,
	createCover,
	createExtend,
	createGenerate,
	createInstrumental,
	createRegionEdit,
	createRemix,
	createSoundtrack,
	createTrack,
	describe,
	getTask,
	listTasks,
	recognize,
	stem,
	vocalClone,
} from './music.js';

export function register(program: Command) {
	const cmd = program.command('music').description('Music generation');

	cmd
		.command('generate')
		.description('Generate music from a text prompt')
		.requiredOption('--prompt <text>', 'Music description')
		.option('--style <text>', 'Music style/mood')
		.option('--title <text>', 'Track title')
		.option('--instrumental', 'Instrumental only, no vocals', false)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicGenerateOptions) => {
			try {
				const client = await getClient();
				await createGenerate(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('cover')
		.description('Create a cover from reference audio')
		.requiredOption('--audio <path-or-url>', 'Reference audio file or URL')
		.option('--prompt <text>', 'Music description')
		.option('--style <text>', 'Music style/mood')
		.option('--title <text>', 'Track title')
		.option('--instrumental', 'Instrumental only, no vocals', false)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicCoverOptions) => {
			try {
				const client = await getClient();
				await createCover(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('extend')
		.description('Extend music from reference audio')
		.requiredOption('--audio <path-or-url>', 'Reference audio file or URL')
		.requiredOption('--model <version>', 'Model version (V4, V4_5, V4_5PLUS, V4_5ALL, V5, V5_5)')
		.requiredOption('--continue-at <seconds>', 'Start extending from this time point', Number)
		.option('--prompt <text>', 'Lyrics or description')
		.option('--style <text>', 'Music style/mood')
		.option('--title <text>', 'Track title')
		.option('--instrumental', 'Instrumental only, no vocals', false)
		.option('--negative-tags <text>', 'Styles to exclude')
		.option('--vocal-gender <gender>', 'Vocal gender (m or f)')
		.option('--style-weight <weight>', 'Style guidance weight (0-1)', Number)
		.option('--weirdness <weight>', 'Creativity/weirdness constraint (0-1)', Number)
		.option('--audio-weight <weight>', 'Input audio influence weight (0-1)', Number)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicExtendOptions) => {
			try {
				const client = await getClient();
				await createExtend(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('remix')
		.description('Remix an existing song with new lyrics (Mureka)')
		.argument('[audio]', 'Reference audio file (mp3/m4a, max 10MB)')
		.option('--audio-url <url>', 'Reference audio URL instead of a file')
		.option('--provider-song-id <id>', 'Mureka song id instead of a file')
		.requiredOption('--lyrics <text>', 'Lyrics for the remixed song')
		.requiredOption('--prompt <text>', 'Music description')
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (audio: string | undefined, options: MusicRemixOptions) => {
			try {
				const client = await getClient();
				await createRemix(client, {...options, audio});
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('instrumental')
		.description('Generate a standalone instrumental (Mureka)')
		.option('--prompt <text>', 'Music description')
		.option('--reference-audio <path>', 'Reference audio file (mp3/m4a, max 10MB)')
		.addOption(
			new Option('--model <version>', 'Model version').choices([
				'auto',
				'mureka-7.6',
				'mureka-8',
				'mureka-o2',
			]),
		)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicInstrumentalOptions) => {
			try {
				const client = await getClient();
				await createInstrumental(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('soundtrack')
		.description('Generate music from an image or video (Mureka)')
		.option('--image <path>', 'Source image (jpg/jpeg/png/webp, max 10MB)')
		.option('--video <path>', 'Source video (mp4/mov/avi/mkv/webm, max 10MB)')
		.option('--prompt <text>', 'Music description')
		.addOption(
			new Option('--model <version>', 'Model version').choices([
				'auto',
				'mureka-7.6',
				'mureka-8',
				'mureka-9',
				'mureka-o2',
			]),
		)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicSoundtrackOptions) => {
			try {
				const client = await getClient();
				await createSoundtrack(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('track')
		.description('Generate a single instrument/vocal track (Mureka)')
		.argument('[audio]', 'Reference audio file (mp3/m4a/wav, max 10MB)')
		.option('--provider-song-id <id>', 'Mureka song id instead of a file')
		.addOption(
			new Option('--generate-type <type>', 'Track type to generate')
				.choices([
					'Vocals',
					'Instrumental',
					'Drums',
					'Bass',
					'Guitar',
					'Keyboard',
					'Percussion',
					'Strings',
					'Synth',
					'FX',
					'Brass',
					'Woodwinds',
				])
				.makeOptionMandatory(),
		)
		.requiredOption('--prompt <text>', 'Music description')
		.option('--lyrics <text>', 'Lyrics (required when --generate-type is Vocals)')
		.addOption(new Option('--vocal-gender <gender>', 'Vocal gender').choices(['male', 'female']))
		.option('--generate-start <ms>', 'Range start in milliseconds', Number)
		.option('--generate-end <ms>', 'Range end in milliseconds', Number)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (audio: string | undefined, options: MusicTrackOptions) => {
			try {
				const client = await getClient();
				await createTrack(client, {...options, audio});
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('region-edit')
		.description('Rewrite a region of an existing song (Mureka)')
		.argument('[audio]', 'Reference audio file (mp3/m4a/wav, max 10MB)')
		.option('--provider-song-id <id>', 'Mureka song id instead of a file')
		.requiredOption('--lyrics <text>', 'Lyrics for the edited region')
		.requiredOption('--edit-start <ms>', 'Edit window start in ms (>=12000)', Number)
		.requiredOption('--edit-end <ms>', 'Edit window end in ms (end - start >= 3000)', Number)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (audio: string | undefined, options: MusicRegionEditOptions) => {
			try {
				const client = await getClient();
				await createRegionEdit(client, {...options, audio});
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('recognize')
		.description('Recognize lyrics (with timestamps) from audio (Mureka)')
		.requiredOption('--audio <path>', 'Audio file (mp3/m4a, max 10MB)')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicRecognizeOptions) => {
			try {
				const client = await getClient();
				await recognize(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('describe')
		.description('Analyze audio: description, tags, genres, instruments (Mureka)')
		.requiredOption('--audio <path>', 'Audio file (mp3/m4a, max 10MB)')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicDescribeOptions) => {
			try {
				const client = await getClient();
				await describe(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('stem')
		.description('Separate audio into stems, returns download URLs (Mureka)')
		.requiredOption('--audio <path>', 'Audio file (mp3/m4a, max 10MB)')
		.addOption(
			new Option('--model <model>', 'Separation model').choices([
				'audio-separation-1',
				'audio-separation-2',
			]),
		)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicStemOptions) => {
			try {
				const client = await getClient();
				await stem(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('vocal-clone')
		.description('Clone a voice from an audio sample into a reusable Vocal ID (Mureka)')
		.requiredOption('--audio <path>', 'Audio file (mp3/m4a, max 10MB)')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicVocalCloneOptions) => {
			try {
				const client = await getClient();
				await vocalClone(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('list')
		.description('List music tasks')
		.option('--page <n>', 'Page number', Number, 1)
		.option('--page-size <n>', 'Items per page', Number, 20)
		.option(
			'--status <status>',
			'Filter by status (pending, generating, uploading, success, failed)',
		)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: MusicListOptions) => {
			try {
				const client = await getClient();
				await listTasks(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('get <taskId>')
		.description('Get music task details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: {json: boolean}) => {
			try {
				const client = await getClient();
				await getTask(client, taskId, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
