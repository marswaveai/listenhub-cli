import type {Command} from 'commander';
import type {
	OpenAPIVoiceCloneGender,
	OpenAPIVoiceCloneLanguage,
	OpenAPIVoiceCloneTaskDetail,
} from '@marswave/listenhub-sdk';
import {handleError, printDetail, printJson, printTable} from '../_shared/output.js';
import {readReferenceAudio} from '../_shared/reference-audio.js';
import {getOpenAPIClient} from './client.js';
import {pollOpenAPI} from './polling.js';

// Voice cloning over an OpenAPI key (lh_sk_…). Upload mode only — the chat-mode
// recording flow belongs to the web app. Every create must carry --consent: the
// server rejects the request without an explicit consent declaration.

type CreateOptions = {
	file: string[];
	lang: OpenAPIVoiceCloneLanguage;
	consent: boolean;
	autoConfirm: boolean;
	name?: string;
	gender?: OpenAPIVoiceCloneGender;
	useCredits: boolean;
	wait: boolean;
	timeout: string;
	json: boolean;
};

/** Print whichever of the three terminal shapes the task ended in. */
function printTaskDetail(taskId: string, task: OpenAPIVoiceCloneTaskDetail): void {
	if (task.status === 'failed') {
		printDetail('Voice clone failed', [
			['Task ID', taskId],
			['Status', task.status],
			['Error code', task.errorCode],
			['Error', task.errorMessage],
		]);
		return;
	}

	printDetail('Voice clone task', [
		['Task ID', taskId],
		['Status', task.status],
		['Preview', task.demoAudioUrl],
		['Speaker ID', task.speakerId],
		['Confirm error', task.confirmError],
	]);

	if (task.status === 'completed' && !task.speakerId && !task.confirmError) {
		console.log(
			`\n  Keep it by confirming the task:\n    listenhub openapi voice-clone confirm --task-id ${taskId} --name <name> --gender <male|female|other>`,
		);
	}
}

export function register(openapi: Command) {
	const cmd = openapi
		.command('voice-clone')
		.description('Clone a voice from reference audio with an API key');

	cmd
		.command('create')
		.description('Create a voice clone task from reference audio')
		.requiredOption('--file <path...>', 'Reference audio file (1-6 files)')
		.requiredOption('--lang <lang>', 'Language of the audio: zh, en, ja')
		.option(
			'--consent',
			'Declare that you hold the cloned person’s consent (required by the API)',
			false,
		)
		.option('--auto-confirm', 'Confirm the voice as soon as cloning completes', false)
		.option('--name <name>', 'Speaker name, required with --auto-confirm (max 50 chars)')
		.option('--gender <gender>', 'Speaker gender, required with --auto-confirm')
		.option('--use-credits', 'Authorize the 300-credit charge once the quota is used up', false)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', '600')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: CreateOptions) => {
			try {
				if (!options.consent) {
					throw new Error(
						'--consent is required: it declares you hold the cloned person’s consent',
					);
				}

				if (options.autoConfirm && (!options.name || !options.gender)) {
					throw new Error('--auto-confirm requires --name and --gender');
				}

				const client = await getOpenAPIClient();
				const {files, filenames} = await readReferenceAudio(options.file);
				const {taskId, status} = await client.createVoiceClone({
					audioFiles: files,
					audioFilenames: filenames,
					language: options.lang,
					consentConfirmed: true,
					...(options.autoConfirm && {
						autoConfirm: true,
						name: options.name,
						gender: options.gender,
					}),
					...(options.useCredits && {useCredits: true}),
				});

				if (!options.wait) {
					if (options.json) {
						printJson({taskId, status});
					} else {
						console.log(`✓ Voice clone task submitted: ${taskId} (${status})`);
					}

					return;
				}

				const task = await pollOpenAPI<OpenAPIVoiceCloneTaskDetail>({
					getStatus: async () => client.getVoiceCloneTask(taskId),
					isDone: (result) => result.status === 'completed',
					isFailed: (result) => result.status === 'failed',
					getErrorMessage: (result) =>
						`Voice cloning failed${result.errorMessage ? `: ${result.errorMessage}` : ''}`,
					options: {timeout: Number(options.timeout), label: 'Cloning voice', json: options.json},
				});

				if (options.json) {
					printJson({taskId, ...task});
				} else {
					printTaskDetail(taskId, task);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('get <taskId>')
		.description('Get a voice clone task; auto-confirms the task when it was created that way')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				const task = await client.getVoiceCloneTask(taskId);

				if (options.json) {
					printJson(task);
				} else {
					printTaskDetail(taskId, task);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('confirm')
		.description('Confirm a completed task into a reusable private speaker')
		.requiredOption('--task-id <id>', 'Voice clone task ID')
		.requiredOption('--name <name>', 'Speaker name (max 50 chars)')
		.requiredOption('--gender <gender>', 'Speaker gender: male, female, other')
		.option('--use-credits', 'Authorize the 300-credit charge once the quota is used up', false)
		.option('-j, --json', 'Output JSON', false)
		.action(
			async (options: {
				taskId: string;
				name: string;
				gender: OpenAPIVoiceCloneGender;
				useCredits: boolean;
				json: boolean;
			}) => {
				try {
					const client = await getOpenAPIClient();
					const result = await client.confirmVoiceClone({
						taskId: options.taskId,
						name: options.name,
						gender: options.gender,
						useCredits: options.useCredits,
					});

					if (options.json) {
						printJson(result);
					} else {
						printDetail('Voice confirmed', [
							['Name', options.name],
							['Speaker ID', result.speakerId],
						]);
					}
				} catch (error) {
					handleError(error, options.json);
				}
			},
		);

	cmd
		.command('speakers')
		.description('List private cloned speakers with quota')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				const result = await client.listVoiceCloneSpeakers();

				if (options.json) {
					printJson(result);
					return;
				}

				printTable(
					['ID', 'Speaker ID', 'Name', 'Language', 'Gender', 'Created'],
					result.speakers.map((speaker) => [
						speaker.id,
						speaker.speakerInnerId,
						speaker.name,
						speaker.language,
						speaker.gender,
						speaker.createdAt.slice(0, 10),
					]),
				);
				console.log(
					`\n  ${result.speakers.length}/${result.maxSpeakers} speakers, ` +
						`${result.remainingConfirmations} confirmation(s) left this period`,
				);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('speaker <speakerId>')
		.description('Get one private cloned speaker')
		.option('-j, --json', 'Output JSON', false)
		.action(async (speakerId: string, options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				const speaker = await client.getVoiceCloneSpeaker(speakerId);

				if (options.json) {
					printJson(speaker);
				} else {
					printDetail('Voice clone speaker', [
						['ID', speaker.id],
						['Speaker ID', speaker.speakerInnerId],
						['Name', speaker.name],
						['Language', speaker.language],
						['Gender', speaker.gender],
						['Preview', speaker.demoAudioUrl],
					]);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('update <speakerId>')
		.description('Rename a cloned speaker or change its gender')
		.option('--name <name>', 'New speaker name (max 50 chars)')
		.option('--gender <gender>', 'New gender: male, female, other')
		.option('-j, --json', 'Output JSON', false)
		.action(
			async (
				speakerId: string,
				options: {name?: string; gender?: OpenAPIVoiceCloneGender; json: boolean},
			) => {
				try {
					if (!options.name && !options.gender) {
						throw new Error('Provide --name or --gender');
					}

					const client = await getOpenAPIClient();
					const speaker = await client.updateVoiceCloneSpeaker(speakerId, {
						...(options.name && {name: options.name}),
						...(options.gender && {gender: options.gender}),
					});

					if (options.json) {
						printJson(speaker);
					} else {
						printDetail('Voice clone speaker updated', [
							['ID', speaker.id],
							['Name', speaker.name],
							['Gender', speaker.gender],
						]);
					}
				} catch (error) {
					handleError(error, options.json);
				}
			},
		);

	cmd
		.command('delete <speakerId>')
		.description('Delete a cloned speaker and free one slot')
		.option('-j, --json', 'Output JSON', false)
		.action(async (speakerId: string, options: {json: boolean}) => {
			try {
				const client = await getOpenAPIClient();
				const result = await client.deleteVoiceCloneSpeaker(speakerId);

				if (options.json) {
					printJson(result);
				} else {
					console.log(`✓ Voice clone speaker deleted: ${result.speakerId}`);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
