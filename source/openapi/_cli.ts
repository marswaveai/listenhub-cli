import type {Command} from 'commander';
import {register as registerConfig} from './config-cmd.js';
import {register as registerSpeakers} from './speakers.js';
import {register as registerTts} from './tts.js';

export function register(program: Command) {
	const openapi = program.command('openapi').description('OpenAPI Key–based commands');
	registerConfig(openapi);
	registerSpeakers(openapi);
	registerTts(openapi);
}
