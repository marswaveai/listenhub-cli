import type {ListenHubClient} from '@marswave/listenhub-sdk';
import {printJson, printTable} from '../_shared/output.js';

export async function listSpeakers(
	client: ListenHubClient,
	options: {lang?: string; json: boolean},
): Promise<void> {
	const {items} = await client.listSpeakers({
		language: options.lang,
	});

	if (options.json) {
		printJson(items);
		return;
	}

	const headers = ['Name', 'ID', 'Gender', 'Personality'];
	const rows = items.map((s) => [
		s.name,
		s.speakerInnerId,
		s.gender,
		s.personality,
	]);
	printTable(headers, rows);
}
