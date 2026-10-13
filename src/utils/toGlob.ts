// Strips the content hash Vite adds, leaving a glob: `a.1b2c3d4e.js` -> `a.*.js`
const HASHED = /^(.*?)([.-])[A-Za-z0-9_-]{8}(\.[^.]+)$/;

export const toGlob = (fileName: string) => {
	const match = HASHED.exec(fileName);

	return match ? `${match[1]}${match[2]}*${match[3]}` : fileName;
};

