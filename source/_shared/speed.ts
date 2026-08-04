import {InvalidArgumentError} from 'commander';

/** Generation speed range shared with the API and the TTS engine. */
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 2;
export const SPEED_DEFAULT = 1;

export const SPEED_FLAG_DESCRIPTION = `Generation speed multiplier ${SPEED_MIN}-${SPEED_MAX} (max two decimals, default ${SPEED_DEFAULT})`;

/**
 * Commander option parser for `--speed`. Rejects out-of-range, over-precise and
 * non-numeric input instead of silently correcting it, so the CLI never sends a
 * speed the caller did not ask for.
 */
export function parseSpeed(value: string): number {
	// Number('') and Number(' ') are 0, which would otherwise surface as a range error.
	const speed = value.trim() === '' ? Number.NaN : Number(value);
	if (!Number.isFinite(speed)) {
		throw new InvalidArgumentError('--speed must be a number');
	}

	if (speed < SPEED_MIN || speed > SPEED_MAX) {
		throw new InvalidArgumentError(`--speed must be between ${SPEED_MIN} and ${SPEED_MAX}`);
	}

	if (Math.round(speed * 100) !== speed * 100) {
		throw new InvalidArgumentError('--speed accepts at most two decimals');
	}

	return speed;
}
