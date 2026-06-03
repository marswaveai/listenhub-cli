import {describe, expect, it} from 'vitest';
import {normalizeVideoTaskId} from '../source/_shared/video-task-id.js';

describe('normalizeVideoTaskId', () => {
	it('accepts a single 24-character hex task id', () => {
		expect(normalizeVideoTaskId('6a2016607ebd26d050c585ca')).toBe('6a2016607ebd26d050c585ca');
	});

	it('trims surrounding whitespace around a single task id', () => {
		expect(normalizeVideoTaskId('  6a2016607ebd26d050c585ca\n')).toBe('6a2016607ebd26d050c585ca');
	});

	it('rejects concatenated task ids', () => {
		expect(() => normalizeVideoTaskId('6a2016607ebd26d050c585ca 6a201660b9fc373811288f09')).toThrow(
			/multiple values/,
		);
	});

	it('rejects comma-separated task ids', () => {
		expect(() => normalizeVideoTaskId('6a2016607ebd26d050c585ca,6a201660b9fc373811288f09')).toThrow(
			/multiple values/,
		);
	});

	it('rejects non-object-id values', () => {
		expect(() => normalizeVideoTaskId('vid-001')).toThrow(/24-character hex string/);
	});
});
