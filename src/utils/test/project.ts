import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const createProject = () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-elements-'));

	return {
		root,
		touch: (relativePath: string) => {
			const file = path.join(root, relativePath);

			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, '');

			return file;
		},
		read: (relativePath: string) =>
			fs.readFileSync(path.join(root, relativePath), 'utf8'),
		remove: () => fs.rmSync(root, { recursive: true, force: true })
	};
};

export type Project = ReturnType<typeof createProject>;
