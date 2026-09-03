export default function CancelledDisclosure({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <details className="group mt-3">
      <summary className="flex w-fit cursor-pointer select-none items-center gap-1.5 text-xs text-muted hover:text-foreground">
        <svg
          className="h-3 w-3 transition-transform group-open:rotate-90"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        Show {count} cancelled
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
