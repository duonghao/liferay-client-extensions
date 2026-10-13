import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { collectAssets } from './clientExtension';
import { call, setup } from './utils/test/plugin';
import { createProject, type Project } from './utils/test/project';
import { customElements } from './vite';

let project: Project;

beforeEach(() => {
	project = createProject();
	project.touch('src/app/home/index.ts');
	project.touch('src/app/booking/record/index.ts');
});

afterEach(() => project.remove());

const run = (clientExtension: Parameters<typeof customElements>[0]) => {
	const plugin = customElements(clientExtension);

	setup(plugin, project.root);
	call(plugin.buildStart);

	return plugin;
};

describe('client extension files', () => {
	it('writes a local file pointing at the dev server', () => {
		run({ clientExtension: {} });

		expect(parse(project.read('client-extension.local.yaml'))).toEqual({
			'booking-record': {
				urls: [
					'http://localhost:5173/@vite/client',
					'http://localhost:5173/src/app/booking/record/index.ts',
				],
			},
			home: {
				urls: [
					'http://localhost:5173/@vite/client',
					'http://localhost:5173/src/app/home/index.ts',
				],
			},
		});
	});

	it('uses the vite port and reads it', () => {
		const plugin = customElements({ clientExtension: {} });

		call(plugin.configResolved, {
			root: project.root,
			server: { port: 3001 },
		});
		call(plugin.buildStart);

		expect(project.read('client-extension.local.yaml')).toContain(
			'http://localhost:3001/@vite/client'
		);
	});

	it('writes environment overlays', () => {
		run({
			clientExtension: {
				environments: {
					dev: { properties: { api: 'dev' } },
					uat: { elements: { home: { name: 'Home UAT' } } },
				},
			},
		});

		expect(parse(project.read('client-extension.dev.yaml'))).toEqual({
			'booking-record': { properties: { api: 'dev' } },
			home: { properties: { api: 'dev' } },
		});
		expect(parse(project.read('client-extension.uat.yaml'))).toEqual({
			home: { name: 'Home UAT' },
		});
	});

	it('writes shared properties in full without yaml aliases', () => {
		const plugin = run({
			clientExtension: {
				properties: { api: 'prod' },
				environments: { dev: { properties: { api: 'dev' } } },
			},
		});

		call(plugin.generateBundle, {}, {});

		for (const file of ['client-extension.yaml', 'client-extension.dev.yaml']) {
			const content = project.read(file);

			expect(content).not.toMatch(/[&*]a\d+/);
			expect(content.match(/api: (prod|dev)/g)).toHaveLength(2);
		}
	});

	it('writes production from the bundle', () => {
		const plugin = run({
			clientExtension: { sourceCodeURL: 'https://git/repo/tree/main' },
		});
		const entry = `${project.root}/src/app/home/index.ts`;
		const bundle = {
			'home.AbC12345.js': {
				type: 'chunk',
				fileName: 'home.AbC12345.js',
				isEntry: true,
				facadeModuleId: entry,
				imports: ['shared.ZzZ98765.js'],
				viteMetadata: { importedCss: new Set(['home.AbC12345.css']) },
			},
			'shared.ZzZ98765.js': {
				type: 'chunk',
				fileName: 'shared.ZzZ98765.js',
				isEntry: false,
				facadeModuleId: null,
				imports: [],
				viteMetadata: { importedCss: new Set(['shared.ZzZ98765.css']) },
			},
		};

		call(plugin.generateBundle, {}, bundle);

		const yaml = parse(project.read('client-extension.yaml'));

		expect(yaml.assemble).toMatchObject([{ from: 'dist', into: 'static/' }]);
		expect(yaml.home).toMatchObject({
			name: 'Home',
			type: 'customElement',
			htmlElementName: 'home',
			useESM: true,
			sourceCodeURL: 'https://git/repo/tree/main/src/app/home',
			cssURLs: ['home.*.css', 'shared.*.css'],
			urls: ['home.*.js'],
		});
		expect(yaml['booking-record']).toMatchObject({
			name: 'Booking Record',
			cssURLs: [],
			urls: [],
		});
	});
});

describe('assemble from', () => {
	it('follows build.outDir relative to the output directory', () => {
		const plugin = customElements({
			clientExtension: { output: 'extension' },
		});

		call(plugin.configResolved, {
			root: project.root,
			build: { outDir: 'build/vite' },
		});
		call(plugin.generateBundle, {}, {});

		expect(parse(project.read('extension/client-extension.yaml')).assemble[0]).toMatchObject({
			from: '../build/vite',
		});
	});
});

describe('collectAssets', () => {
	it('skips elements without a matching entry chunk', () => {
		expect(collectAssets({}, project.root, { home: 'src/app/home/index.ts' })).toEqual(
			{}
		);
	});
});
