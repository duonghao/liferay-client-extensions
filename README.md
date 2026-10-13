# Liferay Custom Elements

Build Liferay widgets with folders, not config.

Create a folder, export an element, and your `client-extension.yaml` is generated for you. Inspired by the file-based routing of TanStack Router and Next.js.

```
src/app/
  home/index.tsx            -> <home>
  booking/
    record/index.tsx        -> <booking-record>
```

## Install

```sh
pnpm add liferay-custom-element
```

## Quick start

Add the plugin to Vite:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { customElements } from 'liferay-custom-element/vite';

export default defineConfig({
	plugins: [customElements()]
});
```

Create an element:

```tsx
// src/app/booking/record/index.tsx
import { createElement } from 'liferay-custom-element';

const Record = () => <h1>Booking {booking.useSearch().id}</h1>;

export const booking = createElement('booking-record', {
	component: Record,
	validateSearch: raw => ({ id: raw.id ?? '' })
});
```

Run `vite`. The plugin writes everything else:

| File                          | Purpose                                 |
| ----------------------------- | --------------------------------------- |
| `client-extension.yaml`       | Production config, one entry per folder |
| `client-extension.local.yaml` | Points every element at your dev server |
| `client-extension.<env>.yaml` | Per-environment overrides (see below)   |
| `src/elementId.gen.ts`        | Union type of all element ids           |

Add a folder and it appears. Delete it and it is gone.

## Elements

`createElement(id, options)` registers the custom element and renders your component into it.

| Option           | Description                                  |
| ---------------- | -------------------------------------------- |
| `component`      | The React component to render                |
| `validateSearch` | Parse and type the URL query params          |
| `beforeLoad`     | Async hook that runs before the first render |

Inside the component, `useSearch()` returns the validated params and `useElement()` returns the host element.

Type the id with the generated `ElementId` to catch folder and id mismatches at compile time:

```ts
import type { ElementId } from '../../../elementId.gen';

createElement<ElementId>('booking-record', { ... });
```

## Configuration

Defaults work out of the box. The common reason to configure is per-environment properties:

```ts
customElements({
	clientExtension: {
		sourceCodeURL: 'https://github.com/org/repo/tree/main',
		environments: {
			dev: { properties: { apiUrl: 'https://dev.example.com' } },
			uat: { properties: { apiUrl: 'https://uat.example.com' } }
		}
	}
});
```

Other options, including `appDir`, `ignore`, `instanceable` and per-element overrides, are documented in the types.

## Conventions

- Folders named `shared`, `components`, `utils`, `hooks` and `widgets` are never elements.
- Nested folders join with `-`, so `booking/record` becomes `<booking-record>`.
