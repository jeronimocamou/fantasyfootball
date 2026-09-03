"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ManagerPicker from "./ManagerPicker";

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

export default function Nav({
  managers,
  currentManagerId,
}: {
  managers: { id: number; display_name: string }[];
  currentManagerId: number | null;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border-color bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-lg text-accent-foreground">
            🎲
          </span>
          <div>
            <div className="text-lg font-bold leading-tight tracking-tight">Crackyard Sportsbook</div>
            <div className="text-xs text-muted">Lines set from ESPN projections</div>
          </div>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink href="/">Board</NavLink>
            <NavLink href="/my-bets">My Bets</NavLink>
            <NavLink href="/leaderboard">Leaderboard</NavLink>
          </nav>
          <ManagerPicker managers={managers} currentManagerId={currentManagerId} />
          <Link href="/admin" className="text-xs text-muted hover:text-foreground" title="House dashboard">
            🏦
          </Link>
        </div>
      </div>
    </header>
  );
}
