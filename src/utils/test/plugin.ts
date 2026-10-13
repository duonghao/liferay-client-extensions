import { EventEmitter } from 'node:events';
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite';

export const call = (hook: unknown, ...args: unknown[]) =>
	(hook as (...a: unknown[]) => void).apply({}, args);

export const setup = (plugin: Plugin, root: string) =>
	call(plugin.configResolved, { root } as ResolvedConfig);

export const createServer = () => {
	const watcher = new EventEmitter();

	return {
		watcher,
		server: { watcher } as unknown as ViteDevServer,
	};
};
