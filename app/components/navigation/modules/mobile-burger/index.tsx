import type { Dispatch, SetStateAction } from "react";

type MobileBurgerProps = {
  burgerBarClasses: string;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
};

export const MobileBurger = ({
  burgerBarClasses,
  open,
  setOpen,
}: MobileBurgerProps) => {
  return (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      aria-expanded={open}
      aria-controls="mobile-nav-menu"
      aria-label="Toggle navigation menu"
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900 md:hidden"
    >
      <span
        aria-hidden
        className={`${burgerBarClasses} ${open ? "translate-y-0 rotate-45" : "-translate-y-1.5"}`}
      />
      <span
        aria-hidden
        className={`${burgerBarClasses} ${open ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"}`}
      />
      <span
        aria-hidden
        className={`${burgerBarClasses} ${open ? "translate-y-0 -rotate-45" : "translate-y-1.5"}`}
      />
    </button>
  );
};
