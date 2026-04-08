import {
  createViteFileRoutesRouter,
  type FileRouteModule,
} from 'next-fs-routes';

const routeModules = import.meta.glob<FileRouteModule>(
  './routes/**/{layout,page}.tsx'
);

export const router = createViteFileRoutesRouter({
  routeModules,
  validateInDev: import.meta.env.DEV,
});
