import type {Command} from 'commander';
import type {OpenAPISubscriptionInfo} from '@marswave/listenhub-sdk';
import {handleError, printJson, printDetail} from '../_shared/output.js';
import {getOpenAPIClient} from './client.js';

type SubscriptionOptions = {
	json: boolean;
};

function printSubscriptionDetail(result: OpenAPISubscriptionInfo): void {
	printDetail('Subscription', [
		['Credits', result.totalAvailableCredits],
		['Monthly', result.usageAvailableMonthlyCredits !== undefined
			? `${String(result.usageAvailableMonthlyCredits)} / ${String(result.usageTotalMonthlyCredits)}`
			: undefined],
		['Permanent', result.usageAvailablePermanentCredits],
		['Plan', result.subscriptionPlan?.name],
		['Expires', result.subscriptionExpiresAt !== undefined
			? new Date(result.subscriptionExpiresAt * 1000).toISOString()
			: undefined],
	]);
}

export function register(openapi: Command) {
	openapi
		.command('subscription')
		.description('Show subscription and credits info')
		.option('-j, --json', 'Output JSON', false)
		.action(async (options: SubscriptionOptions) => {
			try {
				const client = await getOpenAPIClient();
				const result = await client.getSubscription();

				if (options.json) {
					printJson(result);
				} else {
					printSubscriptionDetail(result);
				}
			} catch (error) {
				handleError(error, options.json);
			}
		});
}
