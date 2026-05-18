import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

export interface OpenAPIConfig {
	apiKey: string;
}

function getConfigDir(): string {
	const xdg = process.env['XDG_CONFIG_HOME'];
	return path.join(xdg ?? path.join(os.homedir(), '.config'), 'listenhub');
}

function getConfigPath(): string {
	return path.join(getConfigDir(), 'openapi.json');
}

export function validateApiKey(key: string): boolean {
	return key.startsWith('lh_sk_') && key.length > 6;
}

export async function loadOpenAPIConfig(): Promise<OpenAPIConfig | undefined> {
	const filePath = getConfigPath();
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(raw) as OpenAPIConfig;
	} catch {
		return undefined;
	}
}

export async function saveOpenAPIConfig(config: OpenAPIConfig): Promise<void> {
	const dir = getConfigDir();
	fs.mkdirSync(dir, {recursive: true});

	const filePath = getConfigPath();
	const tmpPath = `${filePath}.tmp.${process.pid}`;

	fs.writeFileSync(tmpPath, JSON.stringify(config, null, '\t'), {mode: 0o600});
	fs.renameSync(tmpPath, filePath);
}

export async function deleteOpenAPIConfig(): Promise<void> {
	const filePath = getConfigPath();
	try {
		fs.unlinkSync(filePath);
	} catch (error) {
		if (
			error instanceof Error &&
			'code' in error &&
			(error as NodeJS.ErrnoException).code === 'ENOENT'
		) {
			return;
		}

		throw error;
	}
}
