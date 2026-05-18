import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {pollOpenAPI} from '../../source/openapi/polling.js';

vi.mock('ora', () => ({
	default: () => ({start: () => ({text: '', succeed: vi.fn(), fail: vi.fn()})}),
}));

describe('pollOpenAPI', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('resolves when isDone returns true', async () => {
		const getStatus = vi.fn().mockResolvedValue({processStatus: 'success', audioUrl: 'x'});
		const promise = pollOpenAPI({
			getStatus,
			isDone: (r: {processStatus: string}) => r.processStatus === 'success',
			isFailed: (r: {processStatus: string}) => r.processStatus === 'failed',
			options: {timeout: 60, json: true},
		});

		const result = await promise;
		expect(result).toEqual({processStatus: 'success', audioUrl: 'x'});
		expect(getStatus).toHaveBeenCalledTimes(1);
	});

	it('throws on failure', async () => {
		const getStatus = vi.fn().mockResolvedValue({processStatus: 'failed', message: 'bad', failCode: 42});
		const promise = pollOpenAPI({
			getStatus,
			isDone: (r: {processStatus: string}) => r.processStatus === 'success',
			isFailed: (r: {processStatus: string}) => r.processStatus === 'failed',
			getErrorMessage: (r: {processStatus: string; message?: string; failCode?: number}) =>
				`${r.message ?? 'Unknown'} (code: ${String(r.failCode ?? 0)})`,
			options: {timeout: 60, json: true},
		});

		await expect(promise).rejects.toThrow('bad (code: 42)');
	});

	it('throws CliTimeoutError when timeout exceeded', async () => {
		const getStatus = vi.fn().mockImplementation(async () => {
			return {processStatus: 'processing'};
		});

		const promise = pollOpenAPI({
			getStatus,
			isDone: (r: {processStatus: string}) => r.processStatus === 'success',
			isFailed: (r: {processStatus: string}) => r.processStatus === 'failed',
			options: {timeout: 20, json: true},
		});

		// Advance past both poll intervals (2 attempts × 10s = 20s)
		// Attach rejection handler before advancing timers to avoid unhandled rejection
		const rejectionPromise = expect(promise).rejects.toThrow(/Timed out/);
		await vi.advanceTimersByTimeAsync(10_000);
		await vi.advanceTimersByTimeAsync(10_000);

		await rejectionPromise;
		expect(getStatus).toHaveBeenCalledTimes(2);
	});
});
