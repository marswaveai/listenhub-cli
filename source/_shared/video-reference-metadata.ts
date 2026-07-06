export type VideoReferenceImageRole = 'first_frame' | 'last_frame' | 'reference_image';

export type VideoReferenceImageMeta = {
	role: VideoReferenceImageRole;
	width: number;
	height: number;
	size?: number;
};

export type VideoReferenceVideoMeta = {
	role: 'reference_video';
	width: number;
	height: number;
	duration?: number;
	fps?: number;
	size?: number;
};

export function parseImageMeta(
	value: string,
	role: VideoReferenceImageRole,
): VideoReferenceImageMeta {
	const match = /^(\d+)x(\d+)(?::(\d+))?$/.exec(value.trim());
	if (!match) {
		throw new Error('Image metadata must be WIDTHxHEIGHT[:SIZE], for example 1080x1920:3600000');
	}

	const [, width, height, size] = match;
	return {
		role,
		width: Number(width),
		height: Number(height),
		...(size !== undefined && {size: Number(size)}),
	};
}

export function parseVideoMeta(value: string): VideoReferenceVideoMeta {
	const match = /^(\d+)x(\d+)(?::(\d+(?:\.\d+)?))?(?::(\d+(?:\.\d+)?))?(?::(\d+))?$/.exec(
		value.trim(),
	);
	if (!match) {
		throw new Error(
			'Video metadata must be WIDTHxHEIGHT[:DURATION[:FPS[:SIZE]]], for example 1280x720:5:30:8000000',
		);
	}

	const [, width, height, duration, fps, size] = match;
	return {
		role: 'reference_video',
		width: Number(width),
		height: Number(height),
		...(duration !== undefined && {duration: Number(duration)}),
		...(fps !== undefined && {fps: Number(fps)}),
		...(size !== undefined && {size: Number(size)}),
	};
}

export function isSeedanceVideoModel(model: string | undefined, defaultModel: string): boolean {
	return (model ?? defaultModel).startsWith('doubao-seedance');
}
