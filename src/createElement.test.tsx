// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from './createElement';
import { useElementState } from './elementState';
import { mount, setSearch, uniqueId } from './utils/test/element';

afterEach(() => {
	document.body.innerHTML = '';
	setSearch('');
});

describe('createElement', () => {
	it('returns the id', () => {
		const id = uniqueId();

		expect(createElement(id, { component: () => null }).id).toBe(id);
	});

	it('defines the custom element', () => {
		const id = uniqueId();

		createElement(id, { component: () => null });

		expect(customElements.get(id)).toBeDefined();
	});

	it('does not redefine an existing custom element', () => {
		const id = uniqueId();

		createElement(id, { component: () => <span>first</span> });

		const first = customElements.get(id);

		expect(() =>
			createElement(id, { component: () => <span>second</span> })
		).not.toThrow();
		expect(customElements.get(id)).toBe(first);
	});

	it('renders the component when connected', async () => {
		const id = uniqueId();

		createElement(id, { component: () => <span>hello</span> });

		const element = mount(id);

		await vi.waitFor(() =>
			expect(element.innerHTML).toBe('<span>hello</span>')
		);
	});

	it('exposes the raw search params through useSearch', async () => {
		const id = uniqueId();

		setSearch('?page=2&q=abc');

		const definition = createElement(id, {
			component: () => <span>{JSON.stringify(definition.useSearch())}</span>,
		});

		const element = mount(id);

		await vi.waitFor(() =>
			expect(element.textContent).toBe('{"page":"2","q":"abc"}')
		);
	});

	it('exposes validated search params', async () => {
		const id = uniqueId();

		setSearch('?page=2');

		const definition = createElement(id, {
			component: () => <span>{definition.useSearch().page + 1}</span>,
			validateSearch: raw => ({ page: Number(raw['page']) }),
		});

		const element = mount(id);

		await vi.waitFor(() => expect(element.textContent).toBe('3'));
	});

	it('exposes the host element through useElement', async () => {
		const id = uniqueId();
		const seen = vi.fn();

		const definition = createElement(id, {
			component: () => {
				seen(definition.useElement());

				return null;
			},
		});

		const element = mount(id);

		await vi.waitFor(() => expect(seen).toHaveBeenCalledWith(element));
	});

	it('waits for beforeLoad before rendering', async () => {
		const id = uniqueId();
		const order: string[] = [];
		let release: () => void = () => undefined;

		createElement(id, {
			component: () => {
				order.push('render');

				return <span>ready</span>;
			},
			beforeLoad: () =>
				new Promise<void>(resolve => {
					order.push('beforeLoad');
					release = resolve;
				}),
		});

		const element = mount(id);

		await vi.waitFor(() => expect(order).toEqual(['beforeLoad']));
		expect(element.innerHTML).toBe('');

		release();

		await vi.waitFor(() =>
			expect(element.innerHTML).toBe('<span>ready</span>')
		);
		expect(order).toEqual(['beforeLoad', 'render']);
	});

	it('passes the element and validated search to beforeLoad', async () => {
		const id = uniqueId();
		const beforeLoad = vi.fn().mockResolvedValue(undefined);

		setSearch('?id=7');

		createElement(id, {
			component: () => null,
			validateSearch: raw => ({ id: Number(raw['id']) }),
			beforeLoad,
		});

		const element = mount(id);

		await vi.waitFor(() =>
			expect(beforeLoad).toHaveBeenCalledWith({ element, search: { id: 7 } })
		);
	});

	it('does not render when disconnected before beforeLoad resolves', async () => {
		const id = uniqueId();
		const component = vi.fn(() => <span>late</span>);
		let release: () => void = () => undefined;
		const started = vi.fn();

		createElement(id, {
			component,
			beforeLoad: () =>
				new Promise<void>(resolve => {
					started();
					release = resolve;
				}),
		});

		const element = mount(id);

		await vi.waitFor(() => expect(started).toHaveBeenCalled());
		element.remove();
		release();
		await new Promise(resolve => setTimeout(resolve, 20));

		expect(component).not.toHaveBeenCalled();
		expect(element.innerHTML).toBe('');
	});

	it('only renders the latest connection when reconnected during beforeLoad', async () => {
		const id = uniqueId();
		const component = vi.fn(() => <span>done</span>);
		const releases: Array<() => void> = [];

		createElement(id, {
			component,
			beforeLoad: () =>
				new Promise<void>(resolve => {
					releases.push(resolve);
				}),
		});

		const element = mount(id);

		await vi.waitFor(() => expect(releases).toHaveLength(1));
		element.remove();
		document.body.appendChild(element);
		await vi.waitFor(() => expect(releases).toHaveLength(2));

		releases.forEach(release => release());

		await vi.waitFor(() => expect(element.innerHTML).toBe('<span>done</span>'));
		expect(component).toHaveBeenCalledTimes(1);
	});

	it('unmounts the component when disconnected', async () => {
		const id = uniqueId();
		const cleanup = vi.fn();

		const Component = () => {
			useEffect(() => cleanup, []);

			return <span>mounted</span>;
		};

		createElement(id, { component: Component });

		const element = mount(id);

		await vi.waitFor(() =>
			expect(element.innerHTML).toBe('<span>mounted</span>')
		);

		element.remove();

		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(element.innerHTML).toBe('');
	});

	it('renders again when reconnected', async () => {
		const id = uniqueId();

		createElement(id, { component: () => <span>again</span> });

		const element = mount(id);

		await vi.waitFor(() =>
			expect(element.innerHTML).toBe('<span>again</span>')
		);

		element.remove();
		expect(element.innerHTML).toBe('');

		document.body.appendChild(element);

		await vi.waitFor(() =>
			expect(element.innerHTML).toBe('<span>again</span>')
		);
	});

	it('renders each instance independently', async () => {
		const id = uniqueId();

		const definition = createElement(id, {
			component: () => <span>{definition.useElement().id}</span>,
		});

		const first = mount(id);
		const second = mount(id);

		first.id = 'first';
		second.id = 'second';

		await vi.waitFor(() => expect(first.textContent).toBe('first'));
		await vi.waitFor(() => expect(second.textContent).toBe('second'));
	});
});

describe('useElementState', () => {
	it('throws outside an element created by createElement', () => {
		const Component = () => {
			useElementState();

			return null;
		};
		const errors = vi
			.spyOn(console, 'error')
			.mockImplementation(() => undefined);
		const container = document.createElement('div');

		return import('react-dom').then(({ render }) => {
			expect(() => render(<Component />, container)).toThrow(
				'Must be used inside an element created by createElement'
			);
			errors.mockRestore();
		});
	});
});
