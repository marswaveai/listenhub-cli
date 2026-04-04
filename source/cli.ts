#!/usr/bin/env node
import {Command} from 'commander';
import {register as registerAuth} from './auth/_cli.js';
import {register as registerExplainer} from './explainer/_cli.js';
import {register as registerPodcast} from './podcast/_cli.js';
import {register as registerSpeakers} from './speakers/_cli.js';
import {register as registerTts} from './tts/_cli.js';

const program = new Command();
program.name('listenhub').description('ListenHub CLI').version('0.1.0');

registerAuth(program);
registerPodcast(program);
registerTts(program);
registerExplainer(program);
registerSpeakers(program);

program.parse();
