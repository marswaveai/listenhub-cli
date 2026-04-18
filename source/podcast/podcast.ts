import type {Language, ListenHubClient} from '@marswave/listenhub-sdk';
import {inferLanguage} from '../_shared/language.js';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollUntilDone} from '../_shared/polling.js';
import {buildSources} from '../_shared/sources.js';
import {resolveSpeakers} from '../_shared/speaker-resolver.js';

export type PodcastCreateOptions = {
	query?: string;
	sourceUrl?: string[];
	sourceText?: string[];
	mode: 'quick' | 'deep' | 'debate';
	lang?: Language;
	speaker?: string[];
	speakerId?: string[];
	wait: boolean;
	timeout: number;
	json: boolean;
};

export async function createPodcast(
	client: ListenHubClient,
	options: PodcastCreateOptions,
): Promise<void> {
	const lang = options.lang ?? inferLanguage(options.query);
	const speakers = await resolveSpeakers(client, {
		speakerNames: options.speaker,
		speakerIds: options.speakerId,
		language: lang,
	});

	const {episodeId} = await client.createPodcast({
		type: speakers.length <= 1 ? 'podcast-solo' : 'podcast-duo',
		query: options.query,
		sources: buildSources(options.sourceUrl, options.sourceText),
		template: {
			type: 'podcast',
			mode: options.mode,
			speakers,
			language: lang,
		},
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`\u2713 Podcast submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollUntilDone(client, episodeId, {
		timeout: options.timeout,
		label: 'Creating podcast',
		json: options.json,
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Podcast created', [
			['ID:', detail.id],
			['Title:', detail.topicDetail.title.data],
			['Status:', detail.processStatus],
		]);
	}
}

export type PodcastListOptions = {
	page: number;
	pageSize: number;
	json: boolean;
};

export async function listPodcasts(
	client: ListenHubClient,
	options: PodcastListOptions,
): Promise<void> {
	const {items} = await client.listPodcasts({
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
