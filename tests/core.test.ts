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
