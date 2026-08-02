import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {
	type VoiceCloneConfirmOptions,
	type VoiceCloneCreateOptions,
	type VoiceCloneDeleteOptions,
	type VoiceCloneGetOptions,
	type VoiceCloneSpeakerOptions,
	type VoiceCloneSpeakersOptions,
	type VoiceCloneUpdateOptions,
	confirmVoiceClone,
	createVoiceClone,
	deleteVoiceCloneSpeaker,
	getVoiceCloneSpeaker,
	getVoiceCloneTask,
	listVoiceCloneSpeakers,
	updateVoiceCloneSpeaker,
} from './voice-clone.js';

export function register(program: Command) {
	const cmd = program
		.command('voice-clone')
		.description('Clone your own voice from reference audio (logged-in account)');

	cmd
		.command('create')
		.description('Create a voice clone task from reference audio')
		.requiredOption('--file <path...>', 'Reference audio file (1-6 files)')
		.requiredOption(
			'--lang <lang>',
			'Language of the audio: en, zh, ja, es, pt, fr, de, tr, ko, it, th, vi',
		)
		.option('--no-wait', 'Return immediately without polling')
		.option('--timeout <seconds>', 'Polling timeout', Number, 600)
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VoiceCloneCreateOptions) => {
			try {
				const client = await getClient();
				await createVoiceClone(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('get <taskId>')
		.description('Get a voice clone task status')
		.option('-j, --json', 'Output JSON', false)
		.action(async (taskId: string, options: VoiceCloneGetOptions) => {
			try {
				const client = await getClient();
				await getVoiceCloneTask(client, taskId, options);
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
		.action(async (options: VoiceCloneConfirmOptions) => {
			try {
				const client = await getClient();
				await confirmVoiceClone(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('speakers')
		.description('List your private cloned speakers with quota')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: VoiceCloneSpeakersOptions) => {
			try {
				const client = await getClient();
				await listVoiceCloneSpeakers(client, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('speaker <speakerId>')
		.description('Get one private cloned speaker')
		.option('-j, --json', 'Output JSON', false)
		.action(async (speakerId: string, options: VoiceCloneSpeakerOptions) => {
			try {
				const client = await getClient();
				await getVoiceCloneSpeaker(client, speakerId, options);
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
		.action(async (speakerId: string, options: VoiceCloneUpdateOptions) => {
			try {
				const client = await getClient();
				await updateVoiceCloneSpeaker(client, speakerId, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('delete <speakerId>')
		.description('Delete a cloned speaker and free one slot')
		.option('-j, --json', 'Output JSON', false)
		.action(async (speakerId: string, options: VoiceCloneDeleteOptions) => {
			try {
				const client = await getClient();
				await deleteVoiceCloneSpeaker(client, speakerId, options);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
