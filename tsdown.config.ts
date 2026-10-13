import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: { index: './src/index.ts', vite: './src/vite.ts' },
	exports: true,
	dts: true
});
