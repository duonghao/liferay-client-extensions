import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
	collectAssets,
	resolveClientExtensionOptions,
	writeClientExtensionEnvironments,
	writeClientExtensionProduction,
	writeIfChanged,
	type ClientExtensionOptions
} from './clientExtension';

export type * from './clientExtension';

export interface CustomElementsPluginOptions {
	appDir?: string;
	output?: string;
	typeName?: string;
	entryName?: string;
	extensions?: string[];
	ignore?: string[];
	separator?: string;
	/** Client-extension yaml generation; every field falls back to a default. */
	clientExtension?: ClientExtensionOptions;
}

const DEFAULT_IGNORE = ['shared', 'components', 'utils', 'hooks', 'widgets'];

const resolveOptions = (options: CustomElementsPluginOptions) => ({
	appDir: options.appDir ?? 'src/app',
	output: options.output ?? 'src/elementId.gen.ts',
	typeName: options.typeName ?? 'ElementId',
	entryName: options.entryName ?? 'index',
	extensions: options.extensions ?? ['ts', 'tsx', 'js', 'jsx'],
	ignore: options.ignore ?? DEFAULT_IGNORE,
	separator: options.separator ?? '-'
});

type ResolvedOptions = ReturnType<typeof resolveOptions>;

const walk = (dir: string, ignore: Set<string>, files: string[] = []) => {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			if (!ignore.has(entry.name) && entry.name !== 'node_modules') {
				walk(fullPath, ignore, files);
			}
		} else {
			files.push(fullPath);
		}
	}

	return files;
};

export const scanElements = (
	root: string,
	options: CustomElementsPluginOptions = {}
): Record<string, string> => {
	const { appDir, entryName, extensions, ignore, separator } =
		resolveOptions(options);
	const absoluteAppDir = path.resolve(root, appDir);

	if (!fs.existsSync(absoluteAppDir)) return {};

	const entryFiles = new Set(extensions.map(ext => `${entryName}.${ext}`));

	return Object.fromEntries(
		walk(absoluteAppDir, new Set(ignore))
			.filter(file => entryFiles.has(path.basename(file)))
			.map(file => {
				const id = path
					.relative(absoluteAppDir, path.dirname(file))
					.split(path.sep)
					.join(separator);

				return [id, path.relative(root, file).split(path.sep).join('/')];
			})
			.filter(([id]) => id !== '')
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
	);
};

export const renderElementIdType = (ids: string[], typeName = 'ElementId') =>
	ids.length
		? `export type ${typeName} =\n${ids.map(id => `\t| '${id}'`).join('\n')};\n`
		: `export type ${typeName} = never;\n`;

const generate = (root: string, options: CustomElementsPluginOptions) => {
	const { output, typeName } = resolveOptions(options);
	const outputPath = path.resolve(root, output);
	const content = renderElementIdType(
		Object.keys(scanElements(root, options)),
		typeName
	);

	writeIfChanged(outputPath, content);
};

const isEntryFile = (
	file: string,
	root: string,
	{ appDir, entryName, extensions, ignore }: ResolvedOptions
) => {
	const relative = path.relative(path.resolve(root, appDir), file);

	if (relative.startsWith('..') || path.isAbsolute(relative)) return false;

	const segments = relative.split(path.sep);
	const base = segments[segments.length - 1];

	return (
		extensions.some(ext => base === `${entryName}.${ext}`) &&
		!segments.slice(0, -1).some(segment => ignore.includes(segment))
	);
};

export function customElements(
	options: CustomElementsPluginOptions = {}
): Plugin {
	const resolved = resolveOptions(options);
	let clientExtension = resolveClientExtensionOptions(
		options.clientExtension ?? {}
	);
	let root = process.cwd();
	let server: { port?: number; https?: unknown } = {};

	const generateEnvironments = () => {
		writeClientExtensionEnvironments(
			root,
			scanElements(root, options),
			clientExtension,
			server
		);
	};

	return {
		name: 'custom-elements',
		configResolved(config) {
			root = config.root;
			server = config.server ?? {};
			clientExtension = resolveClientExtensionOptions(
				options.clientExtension ?? {},
				{ root, outDir: config.build?.outDir ?? 'dist' }
			);
		},
		buildStart() {
			generate(root, options);
			generateEnvironments();
		},
		generateBundle(_, bundle) {
			const elements = scanElements(root, options);

			writeClientExtensionProduction(
				root,
				elements,
				collectAssets(bundle, root, elements),
				clientExtension
			);
		},
		configureServer(devServer) {
			generate(root, options);
			generateEnvironments();

			const onChange = (file: string) => {
				if (!isEntryFile(file, root, resolved)) return;

				generate(root, options);
				generateEnvironments();
			};

			devServer.watcher.on('add', onChange);
			devServer.watcher.on('unlink', onChange);
		}
	};
}
