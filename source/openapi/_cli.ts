import type {Command} from 'commander';
import {register as registerConfig} from './config-cmd.js';
import {register as registerSpeakers} from './speakers.js';
import {register as registerTts} from './tts.js';
import {register as registerFlowSpeech} from './flow-speech.js';
import {register as registerPodcast} from './podcast.js';
import {register as registerStorybook} from './storybook.js';
import {register as registerImage} from './image.js';
import {register as registerVideo} from './video.js';

export function register(program: Command) {
	const openapi = program.command('openapi').description('OpenAPI Key–based commands');
	registerConfig(openapi);
	registerSpeakers(openapi);
	registerTts(openapi);
	registerFlowSpeech(openapi);
	registerPodcast(openapi);
	registerStorybook(openapi);
	registerImage(openapi);
	registerVideo(openapi);
}
