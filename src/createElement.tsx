import React, { ComponentType } from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { ElementStateContext, useElementState } from './elementState';

export type RawSearch = Record<string, string>;

export interface BeforeLoadContext<TSearch> {
	element: HTMLElement;
	search: TSearch;
}

export interface ElementOptions<TSearch = RawSearch> {
	component: ComponentType;
	validateSearch?: (raw: RawSearch) => TSearch;
	beforeLoad?: (ctx: BeforeLoadContext<TSearch>) => Promise<unknown>;
}

export interface ElementDefinition<TId extends string, TSearch = RawSearch> {
	id: TId;
	useSearch: () => TSearch;
	useElement: () => HTMLElement;
}

const parseSearch = (): RawSearch =>
	Object.fromEntries(new URLSearchParams(window.location.search));

export function createElement<TId extends string, TSearch = RawSearch>(
	id: TId,
	options: ElementOptions<TSearch>
): ElementDefinition<TId, TSearch> {
	const { component: Component, validateSearch, beforeLoad } = options;

	class CustomElement extends HTMLElement {
		private loadId = 0;

		connectedCallback() {
			const currentLoadId = ++this.loadId;
			const search = (
				validateSearch ? validateSearch(parseSearch()) : parseSearch()
			) as TSearch;

			Promise.resolve()
				.then(() => beforeLoad?.({ element: this, search }))
				.then(() => {
					if (currentLoadId !== this.loadId) return;

					render(
						<ElementStateContext.Provider value={{ element: this, search }}>
							<Component />
						</ElementStateContext.Provider>,
						this
					);
				});
		}

		disconnectedCallback() {
			this.loadId++;
			unmountComponentAtNode(this);
		}
	}

	if (!customElements.get(id)) {
		customElements.define(id, CustomElement);
	}

	return {
		id,
		useSearch: () => useElementState().search as TSearch,
		useElement: () => useElementState().element,
	};
}
