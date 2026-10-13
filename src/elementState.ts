import { createContext, useContext } from 'react';

export interface ElementState {
	element: HTMLElement;
	search: unknown;
}

export const ElementStateContext = createContext<ElementState | null>(null);

export const useElementState = () => {
	const state = useContext(ElementStateContext);

	if (!state) {
		throw new Error('Must be used inside an element created by createElement');
	}

	return state;
};
