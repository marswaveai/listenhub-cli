import {describe, expect, it} from 'vitest';
import {SPEED_MAX, SPEED_MIN, parseSpeed} from '../source/_shared/speed.js';

describe('parseSpeed', () => {
	it('accepts the shortcut values and the range boundaries', () => {
		for (const value of ['0.5', '0.75', '1', '1.25', '1.5', '2']) {
			expect(parseSpeed(value)).toBe(Number(value));
		}

		expect(parseSpeed(String(SPEED_MIN))).toBe(SPEED_MIN);
		expect(parseSpeed(String(SPEED_MAX))).toBe(SPEED_MAX);
	});

	it('accepts values that are not shortcut values', () => {
		expect(parseSpeed('0.85')).toBe(0.85);
		expect(parseSpeed('1.35')).toBe(1.35);
	});

	it('rejects out-of-range values instead of clamping', () => {
		expect(() => parseSpeed('0.49')).toThrow(/between 0.5 and 2/);
		expect(() => parseSpeed('2.01')).toThrow(/between 0.5 and 2/);
		expect(() => parseSpeed('0')).toThrow(/between 0.5 and 2/);
	});

	it('rejects more than two decimals instead of rounding', () => {
		expect(() => parseSpeed('1.234')).toThrow(/at most two decimals/);
	});

	it('rejects non-numeric input', () => {
		expect(() => parseSpeed('fast')).toThrow(/must be a number/);
		expect(() => parseSpeed('')).toThrow(/must be a number/);
	});
});
