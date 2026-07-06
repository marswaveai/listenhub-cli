import {getOpenAPIOptions} from './client.js';

type CreateFileUploadParams = {
	fileKey: string;
	contentType: string;
	category: string;
};

type CreateFileUploadResponse = {
	presignedUrl: string;
	fileUrl: string;
};

export async function createOpenAPIFileUpload(
	params: CreateFileUploadParams,
): Promise<CreateFileUploadResponse> {
	const {apiKey, baseURL} = await getOpenAPIOptions();
	const response = await fetch(`${baseURL.replace(/\/$/, '')}/v1/files`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(params),
	});

	const body = (await response.json()) as {
		code?: number;
		message?: string;
		data?: CreateFileUploadResponse;
	};

	if (!response.ok || body.code !== 0 || body.data === undefined) {
		throw new Error(body.message ?? `File upload URL request failed: ${String(response.status)}`);
	}

	return body.data;
}

export function getOpenAPIUploadClient() {
	return {createFileUpload: createOpenAPIFileUpload};
}
