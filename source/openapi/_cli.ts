import type {Command} from 'commander';
import {register as registerConfig} from './config-cmd.js';

export function register(program: Command) {
	const openapi = program.command('openapi').description('OpenAPI Key–based commands');
	registerConfig(openapi);
}
