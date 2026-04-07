import type {Command} from 'commander';
import {handleError} from '../_shared/output.js';
import {runLogin, runLogout, runStatus} from './auth.js';

export function register(program: Command) {
	const auth = program.command('auth').description('Manage authentication');

	auth
		.command('login')
		.description('Log in via browser OAuth')
		.action(async () => {
			try {
				await runLogin();
			} catch (error) {
				handleError(error, false);
			}
		});

	auth
		.command('logout')
		.description('Log out and revoke tokens')
		.action(async () => {
			try {
				await runLogout();
			} catch (error) {
				handleError(error, false);
			}
		});

	auth
		.command('status')
		.description('Show current login status')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: {json: boolean}) => {
			try {
				await runStatus(options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
