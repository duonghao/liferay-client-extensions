import { describe, expect, it } from 'vitest';
import { toGlob } from './toGlob';

describe('toGlob', () => {
	it('replaces vite hashes, keeping the separator', () => {
		expect(toGlob('home.AbC12345.js')).toBe('home.*.js');
		expect(toGlob('assets/home-AbC12345.css')).toBe('assets/home-*.css');
		expect(toGlob('plain.js')).toBe('plain.js');
	});
});
