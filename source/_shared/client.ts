import {ListenHubClient} from '@marswave/listenhub-sdk';
import {loadCredentials, saveCredentials} from './credentials.js';
import {resolveApiBaseURL} from './domain.js';
import {CliAuthError} from './output.js';

// 只在用户钉死了域时才传 baseURL。传了 SDK 就完全按它发，自动选域会被关掉。
function clientOptions(accessToken: string): {accessToken: string; baseURL?: string} {
	const baseURL = resolveApiBaseURL();
	return {accessToken, ...(baseURL ? {baseURL} : {})};
}

const refreshBufferMs = 60_000;

// Single-flight: if a refresh is already in progress, reuse the same promise
let refreshPromise: Promise<void> | undefined;

async function ensureFreshCredentials(): Promise<void> {
	const creds = await loadCredentials();
	if (!creds) {
		throw new CliAuthError('Not logged in. Run `listenhub auth login` first.');
	}

	if (creds.expiresAt - Date.now() >= refreshBufferMs) {
		return; // Still fresh
	}

	const temporaryClient = new ListenHubClient(clientOptions(creds.accessToken));
	const tokens = await temporaryClient.refresh({
		refreshToken: creds.refreshToken,
	});
	await saveCredentials({
		...creds,
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken,
		expiresAt: Date.now() + tokens.expiresIn * 1000,
	});
}

export async function getClient(): Promise<ListenHubClient> {
	// Single-flight: concurrent callers share one refresh
	refreshPromise ??= ensureFreshCredentials().finally(() => {
		refreshPromise = undefined;
	});

	await refreshPromise;

	const creds = await loadCredentials();
	if (!creds) {
		throw new CliAuthError('Not logged in. Run `listenhub auth login` first.');
	}

	return new ListenHubClient(clientOptions(creds.accessToken));
}
