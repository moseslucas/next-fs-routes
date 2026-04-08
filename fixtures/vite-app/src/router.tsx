import {
  type FileRouteModule,
} from '@moseslucaspogi/next-fs-routes';
import { createViteFileRoutesRouter } from '@moseslucaspogi/next-fs-routes/browser-router';

const routeModules = import.meta.glob<FileRouteModule>(
  './routes/**/{layout,page}.tsx'
);

export const router = createViteFileRoutesRouter({
  routeModules,
  validateInDev: import.meta.env.DEV,
});
