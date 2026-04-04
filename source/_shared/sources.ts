import type {ContentSource} from '@marswave/listenhub-sdk';

export function buildSources(
	urls?: string[],
	texts?: string[],
): ContentSource[] {
	const sources: ContentSource[] = [];
	for (const uri of urls ?? []) {
		sources.push({type: 'url', uri});
	}

	for (const content of texts ?? []) {
		sources.push({type: 'text', content});
	}

	return sources;
}
