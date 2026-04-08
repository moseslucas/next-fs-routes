import type { ComponentType } from 'react';
import type {
  ActionFunction,
  LoaderFunction,
  RouteObject,
} from 'react-router-dom';

export interface FileRouteModule {
  default?: ComponentType;
  action?: ActionFunction;
  loader?: LoaderFunction;
  ErrorBoundary?: ComponentType;
}

export type FileRouteModuleLoader = () => Promise<FileRouteModule>;

export type FileRouteModules = Record<string, FileRouteModuleLoader>;

export interface FileRouteOptions {
  routesRoot?: string;
  notFoundSegment?: string;
}

type FileRouteNode = {
  children: Map<string, FileRouteNode>;
  layoutModulePath?: string;
  pageModulePath?: string;
  rawSegment: string | null;
};

type FileRouteTree = {
  notFoundModulePath?: string;
  root: FileRouteNode;
};

type LazyRoute = NonNullable<RouteObject['lazy']>;

const ROUTE_KIND_PATTERN = /^(?:(.*)\/)?(layout|page)\.tsx$/;
const SUPPORTED_DYNAMIC_SEGMENT_PATTERN = /^\[([^\][/.]+)\]$/;

export function createFileRoutes(
  routeModules: FileRouteModules,
  options: FileRouteOptions = {}
): RouteObject[] {
  const tree = createRouteTree(Object.keys(routeModules), options);

  return materializeRoutes(tree, (modulePath) =>
    createLazyRoute(modulePath, routeModules)
  );
}

export async function validateFileRouteModules(
  routeModules: FileRouteModules,
  options: FileRouteOptions = {}
) {
  createRouteTree(Object.keys(routeModules), options);

  const loadedModules = await Promise.all(
    Object.entries(routeModules).map(async ([modulePath, loadModule]) => [
      modulePath,
      await loadModule(),
    ] as const)
  );

  for (const [modulePath, routeModule] of loadedModules) {
    assertHasDefaultExport(routeModule, modulePath);
  }
}

function createRouteTree(
  modulePaths: string[],
  options: FileRouteOptions
): FileRouteTree {
  const root = createNode(null);
  let notFoundModulePath: string | undefined;
  const routesRoot = normalizeRoutesRoot(options.routesRoot);
  const notFoundSegment = options.notFoundSegment ?? 'not-found';

  for (const modulePath of modulePaths) {
    const parsedModulePath = parseRouteModulePath(modulePath, routesRoot);
    const segments = parsedModulePath.directory === ''
      ? []
      : parsedModulePath.directory.split('/');

    if (segments.length === 1 && segments[0] === notFoundSegment) {
      if (parsedModulePath.fileKind !== 'page') {
        throw new Error(
          `The special "${notFoundSegment}" route only supports page.tsx, received "${modulePath}".`
        );
      }

      if (notFoundModulePath) {
        throw new Error(
          `Duplicate ${notFoundSegment} route detected: "${notFoundModulePath}" and "${modulePath}".`
        );
      }

      notFoundModulePath = modulePath;
      continue;
    }

    let currentNode = root;

    for (const segment of segments) {
      const nextNode = currentNode.children.get(segment) ?? createNode(segment);
      currentNode.children.set(segment, nextNode);
      currentNode = nextNode;
    }

    if (parsedModulePath.fileKind === 'layout') {
      if (currentNode.layoutModulePath) {
        throw new Error(
          `Duplicate layout.tsx detected for "${parsedModulePath.directory || '/'}".`
        );
      }

      currentNode.layoutModulePath = modulePath;
      continue;
    }

    if (currentNode.pageModulePath) {
      throw new Error(
        `Duplicate page.tsx detected for "${parsedModulePath.directory || '/'}".`
      );
    }

    currentNode.pageModulePath = modulePath;
  }

  return { root, notFoundModulePath };
}

function materializeRoutes(
  tree: FileRouteTree,
  createLazy: (modulePath: string) => LazyRoute
): RouteObject[] {
  const rootChildren = buildChildRoutes(tree.root, createLazy);

  if (tree.root.pageModulePath) {
    rootChildren.unshift({
      index: true,
      lazy: createLazy(tree.root.pageModulePath),
    });
  }

  if (tree.notFoundModulePath) {
    rootChildren.push({
      path: '*',
      lazy: createLazy(tree.notFoundModulePath),
    });
  }

  const rootRoute: RouteObject = {
    path: '/',
    children: rootChildren,
  };

  if (tree.root.layoutModulePath) {
    rootRoute.lazy = createLazy(tree.root.layoutModulePath);
  }

  return [rootRoute];
}

function buildChildRoutes(
  node: FileRouteNode,
  createLazy: (modulePath: string) => LazyRoute
): RouteObject[] {
  validateSiblingSegments(node);

  return [...node.children.values()]
    .sort(compareNodes)
    .map((childNode) => buildNodeRoute(childNode, createLazy));
}

function buildNodeRoute(
  node: FileRouteNode,
  createLazy: (modulePath: string) => LazyRoute
): RouteObject {
  const childRoutes = buildChildRoutes(node, createLazy);
  const routePath = toRoutePath(node.rawSegment);
  const hasChildren = childRoutes.length > 0;
  const hasLayout = Boolean(node.layoutModulePath);
  const hasPage = Boolean(node.pageModulePath);

  if (hasLayout) {
    const route: RouteObject = {
      children: childRoutes,
      lazy: createLazy(node.layoutModulePath!),
      path: routePath,
    };

    if (hasPage) {
      route.children = [
        {
          index: true,
          lazy: createLazy(node.pageModulePath!),
        },
        ...childRoutes,
      ];
    }

    return route;
  }

  if (hasPage && !hasChildren) {
    return {
      lazy: createLazy(node.pageModulePath!),
      path: routePath,
    };
  }

  const route: RouteObject = {
    children: childRoutes,
    path: routePath,
  };

  if (hasPage) {
    route.children = [
      {
        index: true,
        lazy: createLazy(node.pageModulePath!),
      },
      ...childRoutes,
    ];
  }

  return route;
}

function createLazyRoute(
  modulePath: string,
  routeModules: FileRouteModules
): LazyRoute {
  return async () => {
    const loadModule = routeModules[modulePath];

    if (!loadModule) {
      throw new Error(`Unable to load route module "${modulePath}".`);
    }

    const routeModule = await loadModule();

    assertHasDefaultExport(routeModule, modulePath);

    return {
      action: routeModule.action,
      Component: routeModule.default,
      ErrorBoundary: routeModule.ErrorBoundary,
      loader: routeModule.loader,
    };
  };
}

function assertHasDefaultExport(
  routeModule: FileRouteModule,
  modulePath: string
): asserts routeModule is FileRouteModule & { default: ComponentType } {
  if (!routeModule.default) {
    throw new Error(
      `Route module "${modulePath}" must default export a React component.`
    );
  }
}

function validateSiblingSegments(node: FileRouteNode) {
  const seenSegments = new Map<string, string>();

  for (const childNode of node.children.values()) {
    const routePath = toRoutePath(childNode.rawSegment);
    const conflictKey = isDynamicRoutePath(routePath) ? ':dynamic' : routePath;
    const previousSegment = seenSegments.get(conflictKey);

    if (previousSegment) {
      throw new Error(
        `Conflicting route folders "${previousSegment}" and "${childNode.rawSegment}" both resolve to "${routePath}" at the same level.`
      );
    }

    seenSegments.set(conflictKey, childNode.rawSegment!);
  }
}

function compareNodes(left: FileRouteNode, right: FileRouteNode) {
  const leftPath = toRoutePath(left.rawSegment);
  const rightPath = toRoutePath(right.rawSegment);
  const leftIsDynamic = isDynamicRoutePath(leftPath);
  const rightIsDynamic = isDynamicRoutePath(rightPath);

  if (leftIsDynamic !== rightIsDynamic) {
    return leftIsDynamic ? 1 : -1;
  }

  return leftPath.localeCompare(rightPath);
}

function parseRouteModulePath(modulePath: string, routesRoot: string) {
  const prefix = `${routesRoot}/`;

  if (!modulePath.startsWith(prefix)) {
    throw new Error(
      `Unsupported route module "${modulePath}". Expected it to start with "${prefix}".`
    );
  }

  const relativePath = modulePath.slice(prefix.length);
  const match = relativePath.match(ROUTE_KIND_PATTERN);

  if (!match) {
    throw new Error(
      `Unsupported route module "${modulePath}". Expected a file under ${routesRoot}/**/page.tsx or ${routesRoot}/**/layout.tsx.`
    );
  }

  const [, directory = '', fileKind] = match;

  return {
    directory,
    fileKind: fileKind as 'layout' | 'page',
  };
}

function normalizeRoutesRoot(routesRoot = './routes') {
  return routesRoot.replace(/\/$/, '');
}

function toRoutePath(rawSegment: string | null) {
  if (!rawSegment) {
    return '';
  }

  const dynamicMatch = rawSegment.match(SUPPORTED_DYNAMIC_SEGMENT_PATTERN);

  if (dynamicMatch) {
    return `:${dynamicMatch[1]}`;
  }

  if (rawSegment.includes('[') || rawSegment.includes(']')) {
    throw new Error(
      `Unsupported route segment "${rawSegment}". Only single-segment dynamic folders like [id] are supported.`
    );
  }

  return rawSegment;
}

function isDynamicRoutePath(routePath: string) {
  return routePath.startsWith(':');
}

function createNode(rawSegment: string | null): FileRouteNode {
  return {
    children: new Map(),
    rawSegment,
  };
}
