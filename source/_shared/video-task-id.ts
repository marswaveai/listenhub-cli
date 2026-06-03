const videoTaskIdPattern = /^[0-9a-f]{24}$/i;
const multipleValuePattern = /[\s,]+/;

export function normalizeVideoTaskId(taskId: string): string {
	const normalized = taskId.trim();

	if (videoTaskIdPattern.test(normalized)) {
		return normalized;
	}

	if (multipleValuePattern.test(normalized)) {
		throw new Error(
			'Invalid video task id: expected a single 24-character task id, but received multiple values',
		);
	}

	throw new Error('Invalid video task id: expected a 24-character hex string');
}
