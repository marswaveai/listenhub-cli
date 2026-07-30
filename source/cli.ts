#!/usr/bin/env node
import {Command} from 'commander';
import {register as registerAuth} from './auth/_cli.js';
import {register as registerConfig} from './config/_cli.js';
import {register as registerCreation} from './creation/_cli.js';
import {register as registerExplainer} from './explainer/_cli.js';
import {register as registerImage} from './image/_cli.js';
import {register as registerLyrics} from './lyrics/_cli.js';
import {register as registerMusic} from './music/_cli.js';
import {register as registerPodcast} from './podcast/_cli.js';
import {register as registerSlides} from './slides/_cli.js';
import {register as registerSpeakers} from './speakers/_cli.js';
import {register as registerTts} from './tts/_cli.js';
import {register as registerVideo} from './video/_cli.js';
import {register as registerVoiceClone} from './voice-clone/_cli.js';
import {register as registerOpenApi} from './openapi/_cli.js';
import {checkForUpdate} from './_shared/update-check.js';

// Best-effort update notice; fully guarded and non-blocking (see update-check.ts).
// Fire-and-forget: if the command finishes first, the check is simply dropped.
void checkForUpdate();

const program = new Command();
program.name('listenhub').description('ListenHub CLI').version('0.1.0');

registerAuth(program);
registerPodcast(program);
registerTts(program);
registerExplainer(program);
registerSlides(program);
registerImage(program);
registerMusic(program);
registerLyrics(program);
registerSpeakers(program);
registerVoiceClone(program);
registerVideo(program);
registerCreation(program);
registerConfig(program);
registerOpenApi(program);

program.parse();
