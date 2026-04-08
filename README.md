# `@moseslucaspogi/next-fs-routes`

File-based routing helpers for Vite apps using React Router v6 data routes.

## Install

```bash
pnpm add @moseslucaspogi/next-fs-routes
```

## Usage

```ts
import { type FileRouteModule } from "@moseslucaspogi/next-fs-routes";
import { createViteFileRoutesRouter } from "@moseslucaspogi/next-fs-routes/browser-router";

const routeModules = import.meta.glob<FileRouteModule>(
  "./routes/**/{layout,page}.tsx",
);

export const router = createViteFileRoutesRouter({
  routeModules,
  validateInDev: import.meta.env.DEV,
});
```

## Conventions

- `routes/layout.tsx` creates the root layout route.
- `routes/page.tsx` creates the root index route.
- `routes/<segment>/page.tsx` creates `/<segment>`.
- `routes/<segment>/layout.tsx` creates a nested layout route.
- `routes/[id]/page.tsx` becomes `/:id`.
- `routes/not-found/page.tsx` becomes the catch-all `*`.

Route modules must default export a React component. They may also export
`loader`, `action`, and `ErrorBoundary`.

## API

### `createFileRoutes(routeModules, options?)`

Builds React Router `RouteObject[]` values from Vite route modules.

### `validateFileRouteModules(routeModules, options?)`

Loads each route module and fails fast when a module is invalid.

### `createViteFileRoutesRouter({ routeModules, validateInDev, options })`

Convenience helper that wraps `createBrowserRouter(createFileRoutes(...))`.

## Options

```ts
type FileRouteOptions = {
  routesRoot?: string;
  notFoundSegment?: string;
};
```

- `routesRoot` defaults to `./routes`
- `notFoundSegment` defaults to `not-found`

## Publish

Before the first publish, update the repository and homepage fields in
`package.json` if you want them on npm.

```bash
npm view @moseslucaspogi/next-fs-routes
npm login
pnpm type-check
pnpm test
pnpm build
pnpm test:fixture
npm pack
npm publish --access public
```
