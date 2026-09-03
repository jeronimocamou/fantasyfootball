const STATUS_STYLE: Record<string, string> = {
  pending: "bg-foreground/5 text-muted",
  open: "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  won: "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  locked: "bg-amber-600/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  lost: "bg-red-600/10 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  final: "bg-foreground/5 text-muted",
  push: "bg-foreground/5 text-muted",
  cancelled: "bg-foreground/5 text-muted line-through",
};

const DOT_STYLE: Record<string, string> = {
  pending: "bg-muted",
  open: "bg-emerald-600 dark:bg-emerald-400",
  won: "bg-emerald-600 dark:bg-emerald-400",
  locked: "bg-amber-600 dark:bg-amber-400",
  lost: "bg-red-600 dark:bg-red-400",
  final: "bg-muted",
  push: "bg-muted",
  cancelled: "bg-muted",
};

export default function StatusPill({ status, label }: { status: string; label?: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  const dot = DOT_STYLE[status] ?? DOT_STYLE.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label ?? status}
    </span>
  );
}
