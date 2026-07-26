import type {Command} from 'commander';
import process from 'node:process';
import {
	DOMAIN_CHOICES,
	effectiveBaseURLs,
	loadDomainChoice,
	resolveApiBaseURL,
	resolveOpenAPIBaseURL,
	saveDomainChoice,
	type DomainChoice,
} from '../_shared/domain.js';
import {handleError, printJson} from '../_shared/output.js';

function isDomainChoice(value: string): value is DomainChoice {
	return (DOMAIN_CHOICES as string[]).includes(value);
}

function runSetDomain(value: string): void {
	if (!isDomainChoice(value)) {
		console.error(`✗ Unknown domain "${value}". Expected one of: ${DOMAIN_CHOICES.join(', ')}`);
		process.exit(1); // eslint-disable-line unicorn/no-process-exit
	}

	saveDomainChoice(value);
	if (value === 'auto') {
		console.log('✓ Domain set to auto — the SDK picks a reachable domain when the default fails');
	} else {
		console.log(`✓ Domain pinned to "${value}"`);
		console.log(`  Commands:         ${resolveApiBaseURL()}`);
		console.log(`  openapi commands: ${resolveOpenAPIBaseURL()}`);
	}
}

function runShow(json: boolean): void {
	const choice = loadDomainChoice();
	const {api, openapi} = effectiveBaseURLs();

	if (json) {
		printJson({
			domain: choice,
			apiBaseUrl: api.url,
			apiBaseUrlSource: api.source,
			openapiBaseUrl: openapi.url,
			openapiBaseUrlSource: openapi.source,
			nodeVersion: process.version,
		});
		return;
	}

	console.log(`Domain:           ${choice}`);
	console.log(`Commands:         ${api.url} (${api.source})`);
	console.log(`openapi commands: ${openapi.url} (${openapi.source})`);
	console.log(`Node.js:          ${process.version}`);
}

export function register(program: Command) {
	const config = program.command('config').description('Inspect and pin CLI configuration');

	config
		.command('set-domain <domain>')
		.description(`Pin the API domain (${DOMAIN_CHOICES.join(' | ')})`)
		.action((domain: string) => {
			try {
				runSetDomain(domain);
			} catch (error) {
				handleError(error, false);
			}
		});

	config
		.command('show')
		.description('Show the effective Base URLs and domain selection')
		.option('-j, --json', 'Output JSON', false)
		.action((options: {json: boolean}) => {
			try {
				runShow(options.json);
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
