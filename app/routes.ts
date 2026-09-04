import {
  index,
  layout,
  route,
  type RouteConfig,
  type RouteConfigEntry,
} from "@react-router/dev/routes";
import type { IAppRoutes } from "./types";
import { appRoutes } from "./shared";

const toRouteConfigEntry = (page: IAppRoutes): RouteConfigEntry =>
  page.layout
    ? layout(page.file, (page.routes ?? []).map(toRouteConfigEntry))
    : page.path === ""
      ? index(page.file)
      : route(page.path, page.file);

export default appRoutes.map(toRouteConfigEntry) satisfies RouteConfig;
