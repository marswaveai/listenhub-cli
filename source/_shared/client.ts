import {ListenHubClient} from '@marswave/listenhub-sdk';
import {loadCredentials, saveCredentials} from './credentials.js';
import {CliAuthError} from './output.js';

const refreshBufferMs = 60_000;

export async function getClient(): Promise<ListenHubClient> {
	let creds = await loadCredentials();
	if (!creds) {
		throw new CliAuthError('Not logged in. Run `listenhub auth login` first.');
	}

	if (creds.expiresAt - Date.now() < refreshBufferMs) {
		const temporaryClient = new ListenHubClient({
			accessToken: creds.accessToken,
		});
		const tokens = await temporaryClient.refresh({
			refreshToken: creds.refreshToken,
		});
		creds = {
			...creds,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			expiresAt: Date.now() + tokens.expiresIn * 1000,
		};
		await saveCredentials(creds);
	}

	return new ListenHubClient({accessToken: creds.accessToken});
}
