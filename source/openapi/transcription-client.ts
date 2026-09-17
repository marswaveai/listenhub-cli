import {getOpenAPIClient} from './client.js';

export type TranscriptionTask = {
	id: string;
	fileName: string;
	status: 'queued' | 'transcribing' | 'completed' | 'failed';
	originalDurationMs: number;
	speechDurationMs: number;
	reservedCredits: number;
	chargedCredits: number;
	errorCode?: string;
	result?: Transcript;
};

export type Transcript = {
	text: string;
	originalDurationMs: number;
	speechDurationMs: number;
	channels: number[];
	detectedLanguage?: string;
	model: string;
	region: string;
	sentences: Array<{
		startMs: number;
		endMs: number;
		text: string;
		speakerId?: number;
		words: Array<{
			startMs: number;
			endMs: number;
			text: string;
			punctuation?: string;
			confidence?: number;
		}>;
	}>;
};

export type TranscriptionUpload = {
	fileKey: string;
	presignedUrl: string;
	fileUrl: string;
	headers: Record<string, string>;
};

type JsonResponse = {json<T>(): Promise<T>};
type TranscriptionTransport = {
	get(path: string): JsonResponse;
	post(path: string, options: {json: unknown}): JsonResponse;
};

export function transcriptionClient(client: unknown) {
	// ponytail: SDK 0.0.22 has no public transcription methods. Keep its auth,
	// domain selection and errors here until those methods replace this adapter.
	const transport = (client as {api?: Partial<TranscriptionTransport>} | null)?.api;
	if (typeof transport?.get !== 'function' || typeof transport.post !== 'function') {
		throw new Error(
			'Installed ListenHub SDK has no compatible OpenAPI transport for transcription',
		);
	}
	const api = transport as TranscriptionTransport;
	const base = 'v1/audio-transcriptions';
	return {
		async estimate(durationMs: number) {
			return api
				.post(`${base}/estimate-credits`, {json: {durationMs}})
				.json<{durationMs: number; credits: number}>();
		},
		async upload(params: {fileName: string; contentType: string; fileSize: number}) {
			return api.post(`${base}/uploads`, {json: params}).json<TranscriptionUpload>();
		},
		async create(params: {
			fileKey: string;
			fileName: string;
			durationMs: number;
			idempotencyKey: string;
			terms: string[];
		}) {
			return api.post(base, {json: params}).json<TranscriptionTask>();
		},
		async get(id: string) {
			return api.get(`${base}/${encodeURIComponent(id)}`).json<TranscriptionTask>();
		},
		async transcript(id: string) {
			return api.get(`${base}/${encodeURIComponent(id)}/transcript`).json<Transcript>();
		},
	};
}

export async function getTranscriptionClient() {
	return transcriptionClient(await getOpenAPIClient());
}
