import type {Command} from 'commander';
import {register as registerConfig} from './config-cmd.js';
import {register as registerSpeakers} from './speakers.js';

export function register(program: Command) {
	const openapi = program.command('openapi').description('OpenAPI Key–based commands');
	registerConfig(openapi);
	registerSpeakers(openapi);
}
