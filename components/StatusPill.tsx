const STATUS_STYLE: Record<string, string> = {
  pending: "border-border-color text-muted",
  open: "border-emerald-700/50 text-emerald-700 dark:border-emerald-400/50 dark:text-emerald-400",
  won: "border-emerald-700/50 text-emerald-700 dark:border-emerald-400/50 dark:text-emerald-400",
  locked: "border-gold/50 text-gold",
  lost: "border-red-700/50 text-red-700 dark:border-red-400/50 dark:text-red-400",
  final: "border-border-color text-muted",
  push: "border-border-color text-muted",
  cancelled: "border-border-color text-muted line-through",
};

export default function StatusPill({ status, label }: { status: string; label?: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm border px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-widest ${style}`}
    >
      {label ?? status}
    </span>
  );
}
