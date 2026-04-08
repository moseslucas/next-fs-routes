import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createBrowserRouterMock } = vi.hoisted(() => ({
  createBrowserRouterMock: vi.fn((routes) => ({
    navigate: vi.fn(),
    routes,
  })),
}));

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    createBrowserRouter: createBrowserRouterMock,
  };
});

import { createViteFileRoutesRouter } from '../src/browser-router';

describe('createViteFileRoutesRouter', () => {
  beforeEach(() => {
    createBrowserRouterMock.mockClear();
  });

  it('returns the browser router created from generated file routes', () => {
    const router = createViteFileRoutesRouter({
      routeModules: {
        './routes/layout.tsx': async () => ({ default: () => null }),
        './routes/page.tsx': async () => ({ default: () => null }),
        './routes/posts/[postId]/page.tsx': async () => ({ default: () => null }),
      },
    });

    expect(createBrowserRouterMock).toHaveBeenCalledTimes(1);

    const routes = createBrowserRouterMock.mock.calls[0]![0];

    expect(routes[0]).toMatchObject({ path: '/' });
    expect(routes[0].children[0]).toMatchObject({ index: true });
    expect(routes[0].children[1]).toMatchObject({ path: 'posts' });
    expect(routes[0].children[1].children[0]).toMatchObject({
      path: ':postId',
    });
    expect(router).toMatchObject({ routes });
  });
});
