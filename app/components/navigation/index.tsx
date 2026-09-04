import { useState } from "react";
import { NavLink } from "react-router";
import { appRoutes } from "~/shared";
import type { IAppRoutes } from "~/types";
import { Svg } from "~/ui/components";
import { MobileBurger } from "~/components/navigation/modules/mobile-burger";

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white",
  ].join(" ");

const mobileLinkClasses = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-lg px-3 py-2 text-base font-medium transition-colors",
    isActive
      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white",
  ].join(" ");

const flattenLinks = (pages: IAppRoutes[]): IAppRoutes[] =>
  pages.flatMap((page) =>
    page.layout ? flattenLinks(page.routes ?? []) : [page],
  );

const links = flattenLinks(appRoutes);

const burgerBarClasses =
  "absolute h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-in-out";

export const Navigation = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky  top-0 z-10 border-b border-gray-200 bg-orange-10 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <nav className="mx-auto flex w-full items-center justify-between px-4 py-3">
        <NavLink
          to="/"
          end
          onClick={() => setOpen(false)}
          className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white"
        >
          <Svg src="logo.svg" className="h-8 w-auto md:h-9" />
        </NavLink>

        <div className="hidden items-center gap-1 md:flex">
          {links.map(({ path, label }) => {
            const to = path === "" ? "/" : `/${path}`;
            return (
              <NavLink
                key={to}
                to={to}
                end={path === ""}
                className={linkClasses}
              >
                {label}
              </NavLink>
            );
          })}
        </div>

        <MobileBurger
          burgerBarClasses={burgerBarClasses}
          open={open}
          setOpen={setOpen}
        />
      </nav>

      <div
        id="mobile-nav-menu"
        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out md:hidden ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-1 border-t border-gray-200 px-4 py-3 dark:border-gray-800">
            {links.map(({ path, label }) => {
              const to = path === "" ? "/" : `/${path}`;
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={path === ""}
                  onClick={() => setOpen(false)}
                  className={mobileLinkClasses}
                >
                  {label}
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
