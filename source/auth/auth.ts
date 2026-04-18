import process from 'node:process';
import {ListenHubClient} from '@marswave/listenhub-sdk';
import {deleteCredentials, loadCredentials, saveCredentials} from '../_shared/credentials.js';
import {startCallbackServer} from './login-server.js';

export async function runLogin(): Promise<void> {
	const server = await startCallbackServer();
	try {
		const client = new ListenHubClient();
		const {sessionId, authUrl} = await client.connectInit({
			callbackPort: server.port,
		});

		console.error('Opening browser for login...');
		// Dynamic import because `open` is ESM-only
		const {default: open} = await import('open');
		await open(authUrl);

		const {code} = await server.waitForCode();
		const tokens = await client.connectToken({sessionId, code});

		await saveCredentials({
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			expiresAt: Date.now() + tokens.expiresIn * 1000,
		});

		// Fetch username to confirm
		const authedClient = new ListenHubClient({
			accessToken: tokens.accessToken,
		});
		const user = await authedClient.getCurrentUser();
		console.log(`\u2713 Logged in as ${user.nickname || user.email || 'user'}`);
	} finally {
		server.close();
	}
}

export async function runLogout(): Promise<void> {
	const creds = await loadCredentials();
	if (creds?.refreshToken) {
		try {
			const client = new ListenHubClient({accessToken: creds.accessToken});
			await client.revoke({refreshToken: creds.refreshToken});
		} catch {
			console.error('Warning: remote revoke failed, local credentials cleared');
		}
	}

	await deleteCredentials();
	console.log('\u2713 Logged out');
}

export async function runStatus(json: boolean): Promise<void> {
	const creds = await loadCredentials();
	if (!creds) {
		if (json) {
			console.log(JSON.stringify({loggedIn: false}));
		} else {
			console.log('Not logged in');
		}

		process.exit(1); // eslint-disable-line unicorn/no-process-exit
	}

	try {
		const client = new ListenHubClient({accessToken: creds.accessToken});
		const user = await client.getCurrentUser();
		const expiresAt = new Date(creds.expiresAt).toISOString();

		if (json) {
			console.log(
				JSON.stringify(
					{
						loggedIn: true,
						user: user.nickname,
						email: user.email,
						expiresAt,
					},
					null,
					2,
				),
			);
		} else {
			console.log(`\u2713 Logged in as ${user.nickname || 'user'}`);
			console.log(`  Email:      ${user.email}`);
			console.log(`  Expires at: ${expiresAt}`);
		}
	} catch {
		if (json) {
			console.log(JSON.stringify({loggedIn: false, error: 'Token expired or invalid'}));
		} else {
			console.log('Not logged in (token expired or invalid)');
		}

		process.exit(1); // eslint-disable-line unicorn/no-process-exit
	}
}
