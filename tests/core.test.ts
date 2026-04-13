import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  createFileRoutes,
  validateFileRouteModules,
  type FileRouteModule,
  type FileRouteModules,
} from '../src/index';

describe('createFileRoutes', () => {
  it('builds nested routes from layout.tsx and page.tsx files', () => {
    const routes = createFileRoutes(
      createRouteModuleLoaders([
        './routes/layout.tsx',
        './routes/page.tsx',
        './routes/dashboard/layout.tsx',
        './routes/dashboard/page.tsx',
        './routes/dashboard/settings/page.tsx',
        './routes/not-found/page.tsx',
      ])
    );

    const rootRoute = routes[0]!;
    const rootChildren = rootRoute.children!;
    const dashboardRoute = rootChildren[1]!;
    const dashboardChildren = dashboardRoute.children!;

    expect(rootRoute).toMatchObject({ path: '/' });
    expect(rootRoute.lazy).toBeTypeOf('function');
    expect(rootChildren[0]).toMatchObject({ index: true });
    expect(dashboardRoute).toMatchObject({ path: 'dashboard' });
    expect(dashboardChildren[0]).toMatchObject({ index: true });
    expect(dashboardChildren[1]).toMatchObject({ path: 'settings' });
    expect(rootChildren[2]).toMatchObject({ path: '*' });
  });

  it('creates a structural parent route when a folder has page.tsx and children but no layout.tsx', () => {
    const routes = createFileRoutes(
      createRouteModuleLoaders([
        './routes/layout.tsx',
        './routes/transactions/page.tsx',
        './routes/transactions/customers/page.tsx',
        './routes/transactions/[transactionId]/page.tsx',
      ])
    );

    const transactionsRoute = routes[0]!.children![0]!;

    expect(transactionsRoute).toMatchObject({ path: 'transactions' });
    expect(transactionsRoute.lazy).toBeUndefined();
    expect(transactionsRoute.children?.[0]).toMatchObject({ index: true });
    expect(transactionsRoute.children?.[1]).toMatchObject({
      path: 'customers',
    });
    expect(transactionsRoute.children?.[2]).toMatchObject({
      path: ':transactionId',
    });
  });

  it('maps lazy route exports to React Router data APIs automatically', async () => {
    const loader = vi.fn();
    const action = vi.fn();
    const Component = () => null;

    const routes = createFileRoutes({
      './routes/orders/page.tsx': async () => ({
        action,
        default: Component,
        loader,
      }),
    });

    const lazyModule = await routes[0]!.children![0]!.lazy?.();

    expect(lazyModule?.Component).toBe(Component);
    expect(lazyModule?.loader).toBe(loader);
    expect(lazyModule?.action).toBe(action);
  });

  it('ignores route-group folders in generated paths', () => {
    const routes = createFileRoutes(
      createRouteModuleLoaders([
        './routes/(marketing)/about/page.tsx',
        './routes/(app)/dashboard/settings/page.tsx',
        './routes/(shop)/products/[id]/page.tsx',
      ])
    );

    const rootChildren = routes[0]!.children!;

    expect(rootChildren[0]).toMatchObject({
      children: [{ path: 'about' }],
    });
    expect(rootChildren[1]).toMatchObject({
      children: [{ path: 'dashboard' }],
    });
    expect(rootChildren[2]).toMatchObject({
      children: [{ path: 'products' }],
    });
    expect(
      rootChildren[2]!.children?.[0]!.children?.[0]
    ).toMatchObject({ path: ':id' });
  });

  it('creates pathless grouped layouts for nested pages', () => {
    const routes = createFileRoutes(
      createRouteModuleLoaders([
        './routes/(app)/layout.tsx',
        './routes/(app)/home/page.tsx',
        './routes/(app)/settings/page.tsx',
      ])
    );

    const groupedRoute = routes[0]!.children![0]!;

    expect(groupedRoute.path).toBeUndefined();
    expect(groupedRoute.lazy).toBeTypeOf('function');
    expect(groupedRoute.children?.[0]).toMatchObject({ path: 'home' });
    expect(groupedRoute.children?.[1]).toMatchObject({ path: 'settings' });
  });

  it('renders a grouped layout with nested pages when there is no top-level layout', async () => {
    const routes = createFileRoutes({
      './routes/(authenticated)/layout.tsx': async () => ({
        default: function AuthenticatedLayout() {
          return createElement('div', null, 'auth', createElement(Outlet));
        },
      }),
      './routes/(authenticated)/home/page.tsx': async () => ({
        default: function Home() {
          return createElement('div', null, 'home');
        },
      }),
    });

    const router = createMemoryRouter(routes, {
      initialEntries: ['/home'],
    });

    await new Promise<void>((resolve) => {
      const unsubscribe = router.subscribe((state) => {
        if (state.initialized) {
          unsubscribe();
          resolve();
        }
      });
    });

    expect(
      renderToString(createElement(RouterProvider, { router }))
    ).toContain('home');
  });

  it('fails fast when a top-level route group contains page.tsx directly', () => {
    expect(() =>
      createFileRoutes(
        createRouteModuleLoaders([
          './routes/(authenticated)/page.tsx',
        ])
      )
    ).toThrow(/Top-level route groups cannot contain page\.tsx directly/);
  });

  it('treats grouped not-found folders as normal routes', () => {
    const routes = createFileRoutes(
      createRouteModuleLoaders([
        './routes/(group)/not-found/page.tsx',
      ])
    );

    const groupedRoute = routes[0]!.children![0]!;

    expect(groupedRoute).toMatchObject({
      children: [{ path: 'not-found' }],
    });
    expect(routes[0]!.children).toHaveLength(1);
  });

  it('fails fast when two dynamic siblings collide at the same level', () => {
    expect(() =>
      createFileRoutes(
        createRouteModuleLoaders([
          './routes/layout.tsx',
          './routes/orders/[id]/page.tsx',
          './routes/orders/[slug]/page.tsx',
        ])
      )
    ).toThrow(/Conflicting route folders/);
  });

  it('fails fast when grouped and non-grouped folders resolve to the same path', () => {
    expect(() =>
      createFileRoutes(
        createRouteModuleLoaders([
          './routes/shop/page.tsx',
          './routes/(group)/shop/page.tsx',
        ])
      )
    ).toThrow(/Conflicting route folders/);
  });

  it('fails fast when a grouped index collides with a real index route', () => {
    expect(() =>
      createFileRoutes(
        createRouteModuleLoaders([
          './routes/page.tsx',
          './routes/(app)/page.tsx',
        ])
      )
    ).toThrow(/Top-level route groups cannot contain page\.tsx directly/);
  });

  it('fails fast when a route module has no default export during validation', async () => {
    await expect(
      validateFileRouteModules({
        './routes/page.tsx': async () => ({ loader: vi.fn() }),
      })
    ).rejects.toThrow(/must default export/);
  });
});

function createRouteModuleLoaders(modulePaths: string[]): FileRouteModules {
  return Object.fromEntries(
    modulePaths.map((modulePath) => [
      modulePath,
      async () =>
        ({
          default: () => null,
        }) satisfies FileRouteModule,
    ])
  );
}
