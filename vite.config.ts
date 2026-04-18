import {defineConfig} from 'vite-plus';

export default defineConfig({
	pack: {
		entry: ['source/cli.ts'],
		platform: 'node',
		format: ['esm'],
	},
	fmt: {
		useTabs: true,
		singleQuote: true,
		bracketSpacing: false,
	},
	lint: {
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
});
