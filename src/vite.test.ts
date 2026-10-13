import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { call, createServer, setup } from './utils/test/plugin';
import { createProject, type Project } from './utils/test/project';
import { customElements, renderElementIdType, scanElements } from './vite';

let project: Project;

beforeEach(() => {
	project = createProject();
});

afterEach(() => {
	project.remove();
});

describe('scanElements', () => {
	it('derives ids from folder paths', () => {
		project.touch('src/app/home/index.ts');
		project.touch('src/app/booking/booking-record/index.ts');

		expect(scanElements(project.root)).toEqual({
			'booking-booking-record': 'src/app/booking/booking-record/index.ts',
			home: 'src/app/home/index.ts'
		});
	});

	it('returns ids sorted', () => {
		project.touch('src/app/zeta/index.ts');
		project.touch('src/app/alpha/index.ts');
		project.touch('src/app/mid/index.ts');

		expect(Object.keys(scanElements(project.root))).toEqual([
			'alpha',
			'mid',
			'zeta'
		]);
	});

	it('supports every default extension', () => {
		project.touch('src/app/a/index.ts');
		project.touch('src/app/b/index.tsx');
		project.touch('src/app/c/index.js');
		project.touch('src/app/d/index.jsx');

		expect(Object.keys(scanElements(project.root))).toEqual([
			'a',
			'b',
			'c',
			'd'
		]);
	});

	it('ignores files that are not entry files', () => {
		project.touch('src/app/home/index.ts');
		project.touch('src/app/home/Widget.tsx');
		project.touch('src/app/home/index.test.ts');
		project.touch('src/app/home/index.scss');

		expect(Object.keys(scanElements(project.root))).toEqual(['home']);
	});

	it('ignores the entry file at the app root', () => {
		project.touch('src/app/index.ts');
		project.touch('src/app/home/index.ts');

		expect(Object.keys(scanElements(project.root))).toEqual(['home']);
	});

	it('skips ignored directories at any depth', () => {
		project.touch('src/app/home/index.ts');
		project.touch('src/app/shared/index.ts');
		project.touch('src/app/home/widgets/index.ts');
		project.touch('src/app/home/widgets/pending/index.ts');
		project.touch('src/app/home/components/Card/index.ts');
		project.touch('src/app/home/hooks/index.ts');
		project.touch('src/app/home/utils/index.ts');
		project.touch('src/app/node_modules/pkg/index.ts');

		expect(Object.keys(scanElements(project.root))).toEqual(['home']);
	});

	it('returns an empty result when the app directory is missing', () => {
		expect(scanElements(project.root)).toEqual({});
	});

	it('honours appDir', () => {
		project.touch('src/app/ignored/index.ts');
		project.touch('src/elements/booking/index.ts');

		expect(
			Object.keys(scanElements(project.root, { appDir: 'src/elements' }))
		).toEqual(['booking']);
	});

	it('honours ignore', () => {
		project.touch('src/app/home/index.ts');
		project.touch('src/app/legacy/index.ts');
		project.touch('src/app/shared/index.ts');

		expect(
			Object.keys(scanElements(project.root, { ignore: ['legacy'] }))
		).toEqual(['home', 'shared']);
	});

	it('honours separator', () => {
		project.touch('src/app/booking/record/index.ts');

		expect(Object.keys(scanElements(project.root, { separator: '_' }))).toEqual(
			['booking_record']
		);
	});

	it('honours entryName and extensions', () => {
		project.touch('src/app/a/element.ts');
		project.touch('src/app/b/element.tsx');
		project.touch('src/app/c/index.ts');

		expect(
			Object.keys(
				scanElements(project.root, { entryName: 'element', extensions: ['ts'] })
			)
		).toEqual(['a']);
	});
});

describe('renderElementIdType', () => {
	it('renders a union type', () => {
		expect(renderElementIdType(['a', 'b'])).toBe(
			"export type ElementId =\n\t| 'a'\n\t| 'b';\n"
		);
	});

	it('renders never when there are no ids', () => {
		expect(renderElementIdType([])).toBe('export type ElementId = never;\n');
	});

	it('honours the type name', () => {
		expect(renderElementIdType(['a'], 'WidgetId')).toBe(
			"export type WidgetId =\n\t| 'a';\n"
		);
	});
});

describe('customElements plugin', () => {
	it('is named custom-elements', () => {
		expect(customElements().name).toBe('custom-elements');
	});

	it('generates the type file on buildStart', () => {
		project.touch('src/app/home/index.ts');
		project.touch('src/app/booking/index.ts');

		const plugin = customElements();

		setup(plugin, project.root);
		call(plugin.buildStart);

		expect(project.read('src/elementId.gen.ts')).toBe(
			"export type ElementId =\n\t| 'booking'\n\t| 'home';\n"
		);
	});

	it('creates missing output directories', () => {
		project.touch('src/app/home/index.ts');

		const plugin = customElements({ output: 'generated/types/ids.ts' });

		setup(plugin, project.root);
		call(plugin.buildStart);

		expect(project.read('generated/types/ids.ts')).toContain("'home'");
	});

	it('honours typeName and appDir', () => {
		project.touch('src/elements/home/index.ts');

		const plugin = customElements({
			appDir: 'src/elements',
			typeName: 'WidgetId'
		});

		setup(plugin, project.root);
		call(plugin.buildStart);

		expect(project.read('src/elementId.gen.ts')).toBe(
			"export type WidgetId =\n\t| 'home';\n"
		);
	});

	it('does not rewrite an unchanged file', () => {
		project.touch('src/app/home/index.ts');

		const plugin = customElements();

		setup(plugin, project.root);
		call(plugin.buildStart);

		const output = path.join(project.root, 'src/elementId.gen.ts');
		const past = new Date(Math.floor(Date.now() / 1000) * 1000 - 60_000);

		fs.utimesSync(output, past, past);
		call(plugin.buildStart);

		expect(Math.round(fs.statSync(output).mtimeMs)).toBe(past.getTime());
	});

	it('rewrites the file when ids change', () => {
		project.touch('src/app/home/index.ts');

		const plugin = customElements();

		setup(plugin, project.root);
		call(plugin.buildStart);
		project.touch('src/app/booking/index.ts');
		call(plugin.buildStart);

		expect(project.read('src/elementId.gen.ts')).toContain("'booking'");
	});

	describe('config', () => {
		const configure = (plugin: Plugin, userConfig: UserConfig) =>
			call(plugin.config, userConfig) as UserConfig | undefined;

		it('sets one build input per element', () => {
			project.touch('src/app/home/index.ts');
			project.touch('src/app/booking/record/index.ts');

			const result = configure(customElements(), { root: project.root });

			expect(result?.build?.rollupOptions?.input).toEqual({
				'booking-record': path.join(
					project.root,
					'src/app/booking/record/index.ts'
				),
				home: path.join(project.root, 'src/app/home/index.ts')
			});
		});

		it('keeps an input the user already set', () => {
			project.touch('src/app/home/index.ts');

			const result = configure(customElements(), {
				root: project.root,
				build: { rollupOptions: { input: 'custom.html' } }
			});

			expect(result).toBeUndefined();
		});

		it('sets nothing when there are no elements', () => {
			expect(
				configure(customElements(), { root: project.root })
			).toBeUndefined();
		});
	});

	describe('dev server', () => {
		it('generates on startup', () => {
			project.touch('src/app/home/index.ts');

			const plugin = customElements();
			const { server } = createServer();

			setup(plugin, project.root);
			call(plugin.configureServer, server);

			expect(project.read('src/elementId.gen.ts')).toContain("'home'");
		});

		it('regenerates when an entry file is added', () => {
			project.touch('src/app/home/index.ts');

			const plugin = customElements();
			const { server, watcher } = createServer();

			setup(plugin, project.root);
			call(plugin.configureServer, server);

			watcher.emit('add', project.touch('src/app/booking/index.ts'));

			expect(project.read('src/elementId.gen.ts')).toContain("'booking'");
		});

		it('regenerates when an entry file is removed', () => {
			const home = project.touch('src/app/home/index.ts');

			project.touch('src/app/booking/index.ts');

			const plugin = customElements();
			const { server, watcher } = createServer();

			setup(plugin, project.root);
			call(plugin.configureServer, server);

			fs.rmSync(home);
			watcher.emit('unlink', home);

			expect(project.read('src/elementId.gen.ts')).not.toContain("'home'");
			expect(project.read('src/elementId.gen.ts')).toContain("'booking'");
		});

		it('ignores unrelated files', () => {
			project.touch('src/app/home/index.ts');

			const plugin = customElements();
			const { server, watcher } = createServer();

			setup(plugin, project.root);
			call(plugin.configureServer, server);

			const output = path.join(project.root, 'src/elementId.gen.ts');
			const before = project.read('src/elementId.gen.ts');

			fs.rmSync(output);
			watcher.emit('add', project.touch('src/app/home/Widget.tsx'));
			watcher.emit('add', project.touch('src/app/shared/index.ts'));
			watcher.emit('add', project.touch('src/other/index.ts'));

			expect(fs.existsSync(output)).toBe(false);

			watcher.emit('add', project.touch('src/app/new/index.ts'));

			expect(project.read('src/elementId.gen.ts')).not.toBe(before);
		});
	});
});
