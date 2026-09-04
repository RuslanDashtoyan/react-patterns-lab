import { Navigation } from "~/components";
import { Outlet } from "react-router";

export default function MainLayout() {
  return (
    <div className=" min-h-dvh">
      <Navigation />

      <div className="p-3">
        <Outlet />
      </div>
    </div>
  );
}
