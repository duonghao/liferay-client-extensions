import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'yaml';
import { titleCase } from './utils/titleCase';
import { toGlob } from './utils/toGlob';

const PORTLET_CATEGORY_NAME = 'category.client-extensions';

/**
 * One entry of the `assemble` block, copying files from the build into the
 * client extension package.
 *
 * @example
 * { from: 'final-build', include: ['**\/*.js', '**\/*.css'], into: 'static/' }
 */
export interface AssembleEntry {
	/** Source directory, relative to the client extension root. */
	from: string;
	/** Glob patterns of the files to copy. */
	include: string[];
	/** Destination directory inside the package. */
	into: string;
}

/**
 * The Liferay custom element definition generated for one element.
 *
 * @example
 * {
 *   name: 'Booking Record',
 *   description: 'Booking Record',
 *   portletCategoryName: 'category.client-extensions',
 *   friendlyURLMapping: 'booking-record',
 *   htmlElementName: 'booking-record',
 *   instanceable: false,
 *   useESM: true,
 *   sourceCodeURL: 'https://github.com/org/repo/tree/main/src/app/booking/record',
 *   properties: {},
 *   cssURLs: ['booking-record.*.css'],
 *   urls: ['booking-record.*.js'],
 * }
 */
export interface ElementConfig {
	/**
	 * Display name.
	 * @example 'Booking Record'
	 */
	name: string;
	/**
	 * Description shown in Liferay.
	 * @example 'Lists the bookings of a customer'
	 */
	description: string;
	/**
	 * Widget category in the page editor. Always `category.client-extensions`,
	 * the only category supported.
	 */
	portletCategoryName: typeof PORTLET_CATEGORY_NAME;
	/**
	 * URL segment the element is mapped to.
	 * @example 'booking-record'
	 */
	friendlyURLMapping: string;
	/**
	 * Tag name the element is rendered as.
	 * @example 'booking-record'
	 */
	htmlElementName: string;
	/** Whether the element can be placed on a page more than once. */
	instanceable: boolean;
	/** Whether the scripts are loaded as ES modules. */
	useESM: boolean;
	/**
	 * Link to the element's source.
	 * @example 'https://github.com/org/repo/tree/main/src/app/booking/record'
	 */
	sourceCodeURL: string;
	/**
	 * Values made available to the element.
	 * @example { apiUrl: 'https://api.example.com' }
	 */
	properties: Record<string, unknown>;
	/**
	 * Stylesheets to load. `*` stands in for the build hash.
	 * @example ['booking-record.*.css', 'shared.*.css']
	 */
	cssURLs: string[];
	/**
	 * Scripts to load. `*` stands in for the build hash.
	 * @example ['booking-record.*.js']
	 */
	urls: string[];
}

/**
 * What an environment changes compared with production.
 *
 * @example
 * {
 *   properties: { apiUrl: 'https://uat.example.com' },
 *   elements: { 'booking-record': { name: 'Booking Record (UAT)' } },
 * }
 */
export interface EnvironmentConfig {
	/**
	 * Properties applied to every element in this environment.
	 * @example { apiUrl: 'https://uat.example.com' }
	 */
	properties?: Record<string, unknown>;
	/**
	 * Per-element overrides, keyed by element id.
	 * @example { 'booking-record': { instanceable: true } }
	 */
	elements?: Record<string, Partial<ElementConfig>>;
}

/**
 * Options for generating the `client-extension*.yaml` files. Every field is
 * optional and falls back to a default.
 *
 * @example
 * customElements({
 *   clientExtension: {
 *     sourceCodeURL: 'https://github.com/org/repo/tree/main',
 *     environments: {
 *       dev: { properties: { apiUrl: 'https://dev.example.com' } },
 *       uat: { properties: { apiUrl: 'https://uat.example.com' } },
 *     },
 *   },
 * });
 */
export interface ClientExtensionOptions {
	/**
	 * Directory the yaml files are written to, relative to the project root.
	 * @default '.'
	 * @example 'client-extension'
	 */
	output?: string;
	/**
	 * Base file name, producing `<fileName>.yaml` and `<fileName>.<env>.yaml`.
	 * @default 'client-extension'
	 * @example 'my-extension' // my-extension.yaml, my-extension.dev.yaml
	 */
	fileName?: string;
	/**
	 * Applied to every element.
	 * @default true
	 */
	useESM?: boolean;
	/**
	 * Applied to every element.
	 * @default false
	 */
	instanceable?: boolean;
	/**
	 * Applied to every element.
	 * @default {}
	 * @example { apiUrl: 'https://api.example.com' }
	 */
	properties?: Record<string, unknown>;
	/**
	 * Repository URL prefix; each element's source directory is appended.
	 * Left empty when omitted.
	 * @example 'https://github.com/org/repo/tree/main'
	 */
	sourceCodeURL?: string;
	/**
	 * The `assemble` block of the production file. Replaces the default.
	 * `from` is relative to the directory the yaml is written to.
	 * @default Copies css, js, json, png, jpeg and svg from Vite's `build.outDir`
	 * (as a path relative to `output`) into `static/`.
	 * @example [{ from: 'dist', include: ['**\/*'], into: 'static/' }]
	 */
	assemble?: AssembleEntry[];
	/**
	 * Overrides for the production file, keyed by element id.
	 * @example { 'booking-record': { name: 'Bookings', instanceable: true } }
	 */
	elements?: Record<string, Partial<ElementConfig>>;
	/**
	 * Extra environments, each written to `<fileName>.<env>.yaml`.
	 * @example { dev: { properties: { apiUrl: 'https://dev.example.com' } } }
	 */
	environments?: Record<string, EnvironmentConfig>;
	/**
	 * Write `<fileName>.local.yaml`, pointing every element at the Vite dev
	 * server (`http://localhost:<server.port>`). Pass `false` to skip it.
	 * @default true
	 */
	local?: boolean;
}

/** Built files for one element, as globs. */
export interface ElementAssets {
	cssURLs: string[];
	urls: string[];
}

/** Packages the Vite build output (`from`) into `static/`. */
export const defaultAssemble = (from: string): AssembleEntry[] => [
	{
		from,
		include: [
			'**/*.css',
			'**/*.js',
			'**/*.json',
			'**/*.png',
			'**/*.jpeg',
			'**/*.svg',
		],
		into: 'static/',
	},
];

export const resolveClientExtensionOptions = (
	options: ClientExtensionOptions,
	build: { root: string; outDir: string } = { root: '.', outDir: 'dist' }
) => {
	const output = options.output ?? '.';
	const from =
		path
			.relative(
				path.resolve(build.root, output),
				path.resolve(build.root, build.outDir)
			)
			.split(path.sep)
			.join('/') || '.';

	return {
		output,
		fileName: options.fileName ?? 'client-extension',
		useESM: options.useESM ?? true,
		instanceable: options.instanceable ?? false,
		properties: options.properties ?? {},
		sourceCodeURL: options.sourceCodeURL,
		assemble: options.assemble ?? defaultAssemble(from),
		elements: options.elements ?? {},
		environments: options.environments ?? {},
		local: options.local ?? true,
	};
};

export type ResolvedClientExtensionOptions = ReturnType<
	typeof resolveClientExtensionOptions
>;

const buildElement = (
	id: string,
	entry: string,
	assets: ElementAssets,
	options: ResolvedClientExtensionOptions
): ElementConfig => {
	const name = titleCase(id);
	const base = options.sourceCodeURL?.replace(/\/+$/, '');

	return {
		name,
		type: 'customElement',
		portletCategoryName: PORTLET_CATEGORY_NAME,
		friendlyURLMapping: id,
		htmlElementName: id,
		instanceable: options.instanceable,
		properties: options.properties,
		description: name,
		useESM: options.useESM,
		sourceCodeURL: base ? `${base}/${path.posix.dirname(entry)}` : '',
		cssURLs: assets.cssURLs,
		urls: assets.urls,
		...options.elements[id],
	} as ElementConfig;
};

const dump = (value: unknown) =>
	stringify(value, { lineWidth: 0, aliasDuplicateObjects: false });

/** Production file: `assemble` block plus every element with built asset globs. */
export const renderProduction = (
	elements: Record<string, string>,
	assets: Record<string, ElementAssets>,
	options: ResolvedClientExtensionOptions
) =>
	dump({
		assemble: options.assemble,
		...Object.fromEntries(
			Object.entries(elements).map(([id, entry]) => [
				id,
				buildElement(
					id,
					entry,
					assets[id] ?? { cssURLs: [], urls: [] },
					options
				),
			])
		),
	});

/** Named environment: only what differs from production. */
export const renderEnvironment = (
	elements: Record<string, string>,
	environment: EnvironmentConfig
) => {
	const entries = Object.keys(elements).flatMap(id => {
		const overrides = {
			...(environment.properties && { properties: environment.properties }),
			...environment.elements?.[id],
		};

		return Object.keys(overrides).length ? [[id, overrides]] : [];
	});

	return dump(Object.fromEntries(entries));
};

/** Local file: points every element at the Vite dev server. */
export const renderLocal = (
	elements: Record<string, string>,
	origin: string
) =>
	dump(
		Object.fromEntries(
			Object.entries(elements).map(([id, entry]) => [
				id,
				{ urls: [`${origin}/@vite/client`, `${origin}/${entry}`] },
			])
		)
	);

export const localOrigin = (server: { port?: number; https?: unknown }) =>
	`${server.https ? 'https' : 'http'}://localhost:${server.port ?? 5173}`;

interface BundleChunk {
	type: 'chunk';
	fileName: string;
	isEntry: boolean;
	facadeModuleId: string | null;
	imports: string[];
	viteMetadata?: { importedCss: Set<string> };
}

/** Collects the entry js and every css file reachable from it. */
export const collectAssets = (
	bundle: Record<string, { type: string }>,
	root: string,
	elements: Record<string, string>
): Record<string, ElementAssets> => {
	const chunks = Object.values(bundle).filter(
		(item): item is BundleChunk => item.type === 'chunk'
	);
	const byFile = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
	const byEntry = new Map(
		chunks
			.filter(chunk => chunk.isEntry && chunk.facadeModuleId)
			.map(chunk => [path.normalize(chunk.facadeModuleId!), chunk])
	);

	const collectCss = (
		chunk: BundleChunk,
		seen = new Set<string>(),
		css = new Set<string>()
	) => {
		if (seen.has(chunk.fileName)) return css;

		seen.add(chunk.fileName);
		chunk.viteMetadata?.importedCss.forEach(file => css.add(file));
		chunk.imports.forEach(file => {
			const imported = byFile.get(file);

			if (imported) collectCss(imported, seen, css);
		});

		return css;
	};

	return Object.fromEntries(
		Object.entries(elements).flatMap(([id, entry]) => {
			const chunk = byEntry.get(path.resolve(root, entry));

			return chunk
				? [
						[
							id,
							{
								cssURLs: [...collectCss(chunk)].map(toGlob),
								urls: [toGlob(chunk.fileName)],
							},
						],
					]
				: [];
		})
	);
};

export const writeIfChanged = (file: string, content: string) => {
	if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return;

	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
};

export const clientExtensionPath = (
	root: string,
	options: ResolvedClientExtensionOptions,
	environment?: string
) =>
	path.resolve(
		root,
		options.output,
		`${options.fileName}${environment ? `.${environment}` : ''}.yaml`
	);

/** Writes every file that does not depend on the build output. */
export const writeClientExtensionEnvironments = (
	root: string,
	elements: Record<string, string>,
	options: ResolvedClientExtensionOptions,
	server: { port?: number; https?: unknown }
) => {
	for (const [name, environment] of Object.entries(options.environments)) {
		writeIfChanged(
			clientExtensionPath(root, options, name),
			renderEnvironment(elements, environment)
		);
	}

	if (options.local) {
		writeIfChanged(
			clientExtensionPath(root, options, 'local'),
			renderLocal(elements, localOrigin(server))
		);
	}
};

export const writeClientExtensionProduction = (
	root: string,
	elements: Record<string, string>,
	assets: Record<string, ElementAssets>,
	options: ResolvedClientExtensionOptions
) =>
	writeIfChanged(
		clientExtensionPath(root, options),
		renderProduction(elements, assets, options)
	);
