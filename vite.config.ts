import {defineConfig} from 'vite-plus';

export default defineConfig({
	pack: {
		entry: ['source/cli.ts'],
		platform: 'node',
		format: ['esm'],
	},
	lint: {
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
});
