import {
  createBrowserRouter,
  type RouteObject,
} from 'react-router-dom';

import {
  createFileRoutes,
  validateFileRouteModules,
  type FileRouteModules,
  type FileRouteOptions,
} from './core';

export interface CreateViteFileRoutesRouterOptions {
  routeModules: FileRouteModules;
  validateInDev?: boolean;
  options?: FileRouteOptions;
}

export function createViteFileRoutesRouter({
  routeModules,
  validateInDev = false,
  options,
}: CreateViteFileRoutesRouterOptions): ReturnType<typeof createBrowserRouter> {
  if (validateInDev) {
    void validateFileRouteModules(routeModules, options).catch((error) => {
      setTimeout(() => {
        throw error;
      });
    });
  }

  return createBrowserRouter(
    createFileRoutes(routeModules, options) as RouteObject[]
  );
}
