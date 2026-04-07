import type {Language, ListenHubClient} from '@marswave/listenhub-sdk';
import {inferLanguage} from '../_shared/language.js';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollUntilDone} from '../_shared/polling.js';
import {buildSources} from '../_shared/sources.js';
import {resolveSpeakers} from '../_shared/speaker-resolver.js';

export type TtsCreateOptions = {
	text?: string;
	sourceUrl?: string[];
	sourceText?: string[];
	mode: 'smart' | 'direct';
	lang?: Language;
	speaker?: string;
	speakerId?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export async function createTts(
	client: ListenHubClient,
	options: TtsCreateOptions,
): Promise<void> {
	const lang = options.lang ?? inferLanguage(options.text);
	const speakers = await resolveSpeakers(client, {
		speakerNames: options.speaker ? [options.speaker] : undefined,
		speakerIds: options.speakerId ? [options.speakerId] : undefined,
		language: lang,
		count: 1,
	});

	const sources = options.text
		? [{type: 'text' as const, content: options.text}]
		: buildSources(options.sourceUrl, options.sourceText);

	const {episodeId} = await client.createTTS({
		sources,
		template: {
			type: 'flowspeech',
			mode: options.mode,
			speakers,
			language: lang,
		},
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`\u2713 TTS submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollUntilDone(client, episodeId, {
		timeout: options.timeout,
		label: 'Creating TTS',
		json: options.json,
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('TTS created', [
			['ID:', detail.id],
			['Title:', detail.topicDetail.title.data],
			['Status:', detail.processStatus],
		]);
	}
}

export type TtsListOptions = {page: number; pageSize: number; json: boolean};

export async function listTts(
	client: ListenHubClient,
	options: TtsListOptions,
): Promise<void> {
	const {items} = await client.listTTS({
		page: options.page,
		pageSize: options.pageSize,
	});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['ID', 'Title', 'Status', 'Created'];
	const rows = items.map((episode) => [
		episode.id,
		episode.title,
		episode.processStatus,
		new Date(episode.createdAt).toISOString().slice(0, 10),
	]);
	printTable(headers, rows);
}
