import { useConnectionStore } from "../../store/connection-store";
import { selectStatus, useBookStore } from "../../store/book-store";

/** Re-renders only when connection/book STATUS changes, never on price ticks. */
export const ConnectionBadge = () => {
  const status = useConnectionStore((s) => s.status);
  const stale = useConnectionStore((s) => s.stale);
  const attempt = useConnectionStore((s) => s.reconnectAttempt);
  const bookStatus = useBookStore(selectStatus);

  const [label, color] =
    status !== "open"
      ? [status === "reconnecting" ? `Reconnecting (attempt ${attempt})` : "Connecting…", "bg-red-500"]
      : stale
        ? ["Stale — no data", "bg-amber-500"]
        : bookStatus === "resyncing"
          ? ["Resyncing book", "bg-amber-500"]
          : bookStatus === "live"
            ? ["Live", "bg-emerald-500"]
            : ["Loading book…", "bg-sky-500"];

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-800 dark:text-gray-300">
      <span className={`h-2 w-2 rounded-full ${color} ${label === "Live" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
};
