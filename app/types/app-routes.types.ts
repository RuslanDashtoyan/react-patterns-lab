export interface IAppRoutes {
  path: string;
  label: string;
  file: string;
  layout?: boolean;
  routes?: IAppRoutes[];
}
