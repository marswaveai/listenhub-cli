import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import type {StoredCredentials} from '@marswave/listenhub-sdk';

function getConfigDir(): string {
	const xdg = process.env['XDG_CONFIG_HOME'];
	return path.join(xdg ?? path.join(os.homedir(), '.config'), 'listenhub');
}

function getCredentialsPath(): string {
	return path.join(getConfigDir(), 'credentials.json');
}

export async function loadCredentials(): Promise<StoredCredentials | undefined> {
	const filePath = getCredentialsPath();
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON structure matches StoredCredentials
		return JSON.parse(raw) as StoredCredentials;
	} catch {
		return undefined;
	}
}

export async function saveCredentials(creds: StoredCredentials): Promise<void> {
	const dir = getConfigDir();
	fs.mkdirSync(dir, {recursive: true});

	const filePath = getCredentialsPath();
	const temporaryPath = `${filePath}.tmp.${process.pid}`;

	fs.writeFileSync(temporaryPath, JSON.stringify(creds, null, '\t'), {
		mode: 0o600,
	});
	fs.renameSync(temporaryPath, filePath);
}

export async function deleteCredentials(): Promise<void> {
	const filePath = getCredentialsPath();
	try {
		fs.unlinkSync(filePath);
	} catch (error) {
		// ENOENT is fine (already gone), anything else is a real problem
		if (
			error instanceof Error &&
			'code' in error &&
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- checking errno code on Error with 'code' property
			(error as NodeJS.ErrnoException).code === 'ENOENT'
		) {
			return;
		}

		throw error;
	}
}
