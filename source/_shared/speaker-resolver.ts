import type {Language, ListenHubClient} from '@marswave/listenhub-sdk';

// Default speaker innerIds per language (confirmed from skills shared/speaker-selection.md)
const defaultSpeakers: Record<Language, string[]> = {
	zh: ['CN-Man-Beijing-V2', 'gaoqing3-bfb5c88a'],
	en: ['cozy-man-english', 'travel-girl-english'],
	ja: ['tianzhongdunzi-5d612542', '1shenguhaoshivocals-c002bc47'],
};

export async function resolveSpeakers(
	client: ListenHubClient,
	options: {
		speakerNames?: string[];
		speakerIds?: string[];
		language: Language;
		count?: number;
	},
): Promise<string[]> {
	// Direct IDs bypass resolution
	if (options.speakerIds?.length) {
		return options.speakerIds;
	}

	// No speaker specified -> use defaults
	if (!options.speakerNames?.length) {
		const defaults = defaultSpeakers[options.language] ?? defaultSpeakers.en;
		const count = options.count ?? defaults.length;
		return defaults.slice(0, count);
	}

	// Resolve names via API
	const {items} = await client.listSpeakers({language: options.language});
	const resolved: string[] = [];

	for (const name of options.speakerNames) {
		const match = items.find(
			(s) => s.name.toLowerCase() === name.toLowerCase(),
		);
		if (!match) {
			const available = items.map((s) => s.name).join(', ');
			throw new Error(`Speaker "${name}" not found. Available: ${available}`);
		}

		resolved.push(match.speakerInnerId);
	}

	return resolved;
}
