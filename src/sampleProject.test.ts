import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { call, setup } from './utils/test/plugin';
import { customElements } from './vite';

// Generates a browsable sample project into ./sample-project (gitignored)
// so the output files can be inspected after `npm test`.
const root = path.resolve(import.meta.dirname, '..', 'sample-project');

const chunk = (name: string, props: object) => ({
	type: 'chunk',
	fileName: name,
	imports: [],
	...props
});

it('generates a sample project to inspect', () => {
	fs.rmSync(root, { recursive: true, force: true });

	for (const file of [
		'src/app/home/index.ts',
		'src/app/booking/record/index.ts'
	]) {
		fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
		fs.writeFileSync(path.join(root, file), '');
	}

	const plugin = customElements({
		clientExtension: {
			sourceCodeURL: 'https://git/repo/tree/main',
			environments: {
				dev: { properties: { api: 'dev' } },
				uat: { elements: { home: { name: 'Home UAT' } } }
			}
		}
	});

	setup(plugin, root);
	call(plugin.buildStart);
	call(
		plugin.generateBundle,
		{},
		{
			'home.AbC12345.js': chunk('home.AbC12345.js', {
				isEntry: true,
				facadeModuleId: `${root}/src/app/home/index.ts`,
				imports: ['shared.ZzZ98765.js'],
				viteMetadata: { importedCss: new Set(['home.AbC12345.css']) }
			}),
			'shared.ZzZ98765.js': chunk('shared.ZzZ98765.js', {
				isEntry: false,
				facadeModuleId: null,
				viteMetadata: { importedCss: new Set(['shared.ZzZ98765.css']) }
			})
		}
	);

	for (const file of [
		'client-extension.yaml',
		'client-extension.local.yaml',
		'client-extension.dev.yaml',
		'client-extension.uat.yaml',
		'src/elementId.gen.ts'
	]) {
		expect(fs.existsSync(path.join(root, file)), file).toBe(true);
	}
});
