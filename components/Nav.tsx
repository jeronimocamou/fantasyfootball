"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted hover:bg-accent-soft hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Nav({ seasons }: { seasons: number[] }) {
  const pathname = usePathname();
  const onSeasonPage = pathname.startsWith("/season") || pathname.startsWith("/draft");

  return (
    <header className="sticky top-0 z-10 border-b border-border-color bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-lg text-accent-foreground">
              🏈
            </span>
            <div>
              <div className="text-lg font-bold leading-tight tracking-tight">Crackyard FFL</div>
              <div className="text-xs text-muted">League history &amp; analytics since 2021</div>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink href="/">All-Time</NavLink>
            <NavLink href="/analytics">Analytics</NavLink>
            <NavLink href="/predictions">2026 Predictions</NavLink>
            <NavLink href="/records">Records</NavLink>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border-color pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Season</span>
          {seasons.map((s) => (
            <Link
              key={s}
              href={`/season/${s}`}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                onSeasonPage && pathname.includes(String(s))
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-accent-soft hover:text-foreground"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
