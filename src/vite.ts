import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface CustomElementsPluginOptions {
	appDir?: string;
	output?: string;
	typeName?: string;
	entryName?: string;
	extensions?: string[];
	ignore?: string[];
	separator?: string;
}

const DEFAULT_IGNORE = ['shared', 'components', 'utils', 'hooks', 'widgets'];

const resolveOptions = (options: CustomElementsPluginOptions) => ({
	appDir: options.appDir ?? 'src/app',
	output: options.output ?? 'src/elementId.gen.ts',
	typeName: options.typeName ?? 'ElementId',
	entryName: options.entryName ?? 'index',
	extensions: options.extensions ?? ['ts', 'tsx', 'js', 'jsx'],
	ignore: options.ignore ?? DEFAULT_IGNORE,
	separator: options.separator ?? '-',
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

	if (
		fs.existsSync(outputPath) &&
		fs.readFileSync(outputPath, 'utf8') === content
	) {
		return;
	}

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, content);
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
	let root = process.cwd();

	return {
		name: 'custom-elements',
		configResolved(config) {
			root = config.root;
		},
		buildStart() {
			generate(root, options);
		},
		configureServer(server) {
			generate(root, options);

			const onChange = (file: string) => {
				if (isEntryFile(file, root, resolved)) generate(root, options);
			};

			server.watcher.on('add', onChange);
			server.watcher.on('unlink', onChange);
		},
	};
}
