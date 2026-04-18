import type {ImageSize, Language, ListenHubClient, SlideAspectRatio} from '@marswave/listenhub-sdk';
import {inferLanguage} from '../_shared/language.js';
import {printDetail, printJson, printTable} from '../_shared/output.js';
import {pollUntilDone} from '../_shared/polling.js';
import {buildSources} from '../_shared/sources.js';
import {resolveSpeakers} from '../_shared/speaker-resolver.js';

export type ExplainerCreateOptions = {
	query?: string;
	sourceUrl?: string[];
	sourceText?: string[];
	mode: 'info' | 'story';
	lang?: Language;
	speaker?: string;
	speakerId?: string;
	skipAudio: boolean;
	imageSize: ImageSize;
	aspectRatio: SlideAspectRatio;
	style?: string;
	wait: boolean;
	timeout: number;
	json: boolean;
};

export async function createExplainer(
	client: ListenHubClient,
	options: ExplainerCreateOptions,
): Promise<void> {
	const lang = options.lang ?? inferLanguage(options.query);
	const speakers = await resolveSpeakers(client, {
		speakerNames: options.speaker ? [options.speaker] : undefined,
		speakerIds: options.speakerId ? [options.speakerId] : undefined,
		language: lang,
		count: 1,
	});

	const size = options.imageSize;
	const {aspectRatio} = options;

	const {episodeId} = await client.createExplainerVideo({
		query: options.query,
		sources: buildSources(options.sourceUrl, options.sourceText),
		style: options.style,
		skipAudio: options.skipAudio,
		imageConfig: {size, aspectRatio},
		template: {
			type: 'storybook',
			mode: options.mode,
			speakers,
			language: lang,
			style: options.style,
			size,
			aspectRatio,
		},
	});

	if (!options.wait) {
		if (options.json) {
			printJson({episodeId});
		} else {
			console.log(`\u2713 Explainer submitted: ${episodeId}`);
		}

		return;
	}

	const detail = await pollUntilDone(client, episodeId, {
		timeout: options.timeout,
		label: 'Creating explainer',
		json: options.json,
	});

	if (options.json) {
		printJson(detail);
	} else {
		printDetail('Explainer created', [
			['ID:', detail.id],
			['Title:', detail.topicDetail.title.data],
			['Status:', detail.processStatus],
		]);
	}
}

export type ExplainerListOptions = {
	page: number;
	pageSize: number;
	json: boolean;
};

export async function listExplainerVideos(
	client: ListenHubClient,
	options: ExplainerListOptions,
): Promise<void> {
	const {items} = await client.listExplainerVideos({
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
