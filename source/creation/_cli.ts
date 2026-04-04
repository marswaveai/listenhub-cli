import type {Command} from 'commander';
import {getClient} from '../_shared/client.js';
import {handleError} from '../_shared/output.js';
import {deleteCreations, getCreation} from './creation.js';

export function register(program: Command) {
	const cmd = program.command('creation').description('Manage creations');

	cmd
		.command('get <id>')
		.description('Get creation details')
		.option('-j, --json', 'Output JSON', false)
		.action(async (id: string, options: {json: boolean}) => {
			try {
				const client = await getClient();
				await getCreation(client, id, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});

	cmd
		.command('delete <id...>')
		.description('Delete one or more creations')
		.option('-j, --json', 'Output JSON', false)
		.action(async (ids: string[], options: {json: boolean}) => {
			try {
				const client = await getClient();
				await deleteCreations(client, ids, options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
