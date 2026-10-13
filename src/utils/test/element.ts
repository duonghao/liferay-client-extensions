let counter = 0;

export const uniqueId = () => `test-element-${++counter}`;

export const setSearch = (search: string) =>
	window.history.replaceState({}, '', `/${search}`);

export const mount = (id: string) => {
	const element = document.createElement(id);

	document.body.appendChild(element);

	return element;
};
