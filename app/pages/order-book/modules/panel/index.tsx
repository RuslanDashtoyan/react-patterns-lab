import type { ReactNode, Ref } from "react";

interface PanelProps {
  title: ReactNode;
  /** From useCommitCount() — shows how often this panel re-renders */
  renderRef?: Ref<HTMLSpanElement>;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const Panel = ({ title, renderRef, actions, children, className = "" }: PanelProps) => (
  <section
    className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-950 ${className}`}
  >
    <header className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="flex items-center gap-2">
        {actions}
        {renderRef && (
          <span
            ref={renderRef}
            title="How many times this panel has rendered"
            className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          />
        )}
      </div>
    </header>
    {children}
  </section>
);
