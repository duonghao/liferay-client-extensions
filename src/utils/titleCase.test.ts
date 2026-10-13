import { describe, expect, it } from 'vitest';
import { titleCase } from './titleCase';

describe('titleCase', () => {
	it('capitalises each dash separated word', () => {
		expect(titleCase('booking-record')).toBe('Booking Record');
	});

	it('splits on underscores too', () => {
		expect(titleCase('booking_record')).toBe('Booking Record');
	});

	it('handles a single word', () => {
		expect(titleCase('home')).toBe('Home');
	});

	it('collapses repeated and edge separators', () => {
		expect(titleCase('-home--page-')).toBe('Home Page');
	});

	it('keeps existing capitals', () => {
		expect(titleCase('shipment-SI-review')).toBe('Shipment SI Review');
	});
});
