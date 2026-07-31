import type {
	ListenHubClient,
	VoiceCloneGender,
	VoiceCloneLanguage,
	VoiceCloneTaskDetail,
} from '@marswave/listenhub-sdk';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollTask} from '../_shared/polling.js';
import {readReferenceAudio} from '../_shared/reference-audio.js';

export type VoiceCloneCreateOptions = {
	file: string[];
	lang: VoiceCloneLanguage;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export async function createVoiceClone(
	client: ListenHubClient,
	options: VoiceCloneCreateOptions,
): Promise<void> {
	const {files, filenames} = await readReferenceAudio(options.file);
	const {taskId, status} = await client.createVoiceClone({
		audioFiles: files,
		audioFilenames: filenames,
		language: options.lang,
	});

	if (!options.wait) {
		if (options.json) {
			printJson({taskId, status});
		} else {
			console.log(`✓ Voice clone task submitted: ${taskId} (${status})`);
		}

		return;
	}

	const task = await pollTask<VoiceCloneTaskDetail>({
		getStatus: async () => client.getVoiceCloneTask(taskId),
		isDone: (result) => result.status === 'completed',
		isFailed: (result) => result.status === 'failed',
		getErrorMessage: () => 'Voice cloning failed',
		options: {timeout: options.timeout, label: 'Cloning voice', json: options.json},
	});

	if (options.json) {
		printJson({taskId, ...task});
		return;
	}

	printDetail('Voice cloned', [
		['Task ID', taskId],
		['Status', task.status],
		['Preview', task.demoAudioUrl],
	]);
	console.log(
		`\n  Keep it by confirming the task:\n    listenhub voice-clone confirm --task-id ${taskId} --name <name> --gender <male|female|other>`,
	);
}

export type VoiceCloneGetOptions = {json: boolean};

export async function getVoiceCloneTask(
	client: ListenHubClient,
	taskId: string,
	options: VoiceCloneGetOptions,
): Promise<void> {
	const task = await client.getVoiceCloneTask(taskId);

	if (options.json) {
		printJson(task);
		return;
	}

	printDetail('Voice clone task', [
		['Task ID', taskId],
		['Status', task.status],
		['Preview', task.demoAudioUrl],
	]);
}

export type VoiceCloneConfirmOptions = {
	taskId: string;
	name: string;
	gender: VoiceCloneGender;
	useCredits: boolean;
	json: boolean;
};

export async function confirmVoiceClone(
	client: ListenHubClient,
	options: VoiceCloneConfirmOptions,
): Promise<void> {
	await client.confirmVoiceClone({
		taskId: options.taskId,
		name: options.name,
		gender: options.gender,
		useCredits: options.useCredits,
	});

	if (options.json) {
		printJson({taskId: options.taskId, confirmed: true});
		return;
	}

	console.log(`✓ Voice confirmed: ${options.name}`);
	console.log('  Run `listenhub voice-clone speakers` to get its speaker ID.');
}

export type VoiceCloneSpeakersOptions = {json: boolean};

export async function listVoiceCloneSpeakers(
	client: ListenHubClient,
	options: VoiceCloneSpeakersOptions,
): Promise<void> {
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
}

export type VoiceCloneSpeakerOptions = {json: boolean};

export async function getVoiceCloneSpeaker(
	client: ListenHubClient,
	speakerId: string,
	options: VoiceCloneSpeakerOptions,
): Promise<void> {
	const speaker = await client.getVoiceCloneSpeaker(speakerId);

	if (options.json) {
		printJson(speaker);
		return;
	}

	printDetail('Voice clone speaker', [
		['ID', speaker.id],
		['Name', speaker.name],
		['Language', speaker.language],
		['Gender', speaker.gender],
		['Preview', speaker.demoAudioUrl],
	]);
}

export type VoiceCloneUpdateOptions = {
	name?: string;
	gender?: VoiceCloneGender;
	json: boolean;
};

export async function updateVoiceCloneSpeaker(
	client: ListenHubClient,
	speakerId: string,
	options: VoiceCloneUpdateOptions,
): Promise<void> {
	if (!options.name && !options.gender) {
		throw new Error('Provide --name or --gender');
	}

	const speaker = await client.updateVoiceCloneSpeaker(speakerId, {
		...(options.name && {name: options.name}),
		...(options.gender && {gender: options.gender}),
	});

	if (options.json) {
		printJson(speaker);
		return;
	}

	printDetail('Voice clone speaker updated', [
		['ID', speaker.id],
		['Name', speaker.name],
		['Gender', speaker.gender],
	]);
}

export type VoiceCloneDeleteOptions = {json: boolean};

export async function deleteVoiceCloneSpeaker(
	client: ListenHubClient,
	speakerId: string,
	options: VoiceCloneDeleteOptions,
): Promise<void> {
	const result = await client.deleteVoiceCloneSpeaker(speakerId);

	if (options.json) {
		printJson(result);
		return;
	}

	console.log(`✓ Voice clone speaker deleted: ${result.speakerId}`);
}
