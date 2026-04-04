#!/usr/bin/env node
import {Command} from 'commander';

const program = new Command();
program.name('listenhub').description('ListenHub CLI').version('0.1.0');

program.parse();
