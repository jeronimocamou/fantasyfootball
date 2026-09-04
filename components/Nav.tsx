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
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/40 bg-accent-soft font-display text-base font-semibold text-accent">
            CY
          </span>
          <div className="font-display text-lg font-semibold leading-tight tracking-tight">
            Crackyard Sportsbook
          </div>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink href="/">Board</NavLink>
            <NavLink href="/futures">Futures</NavLink>
            <NavLink href="/my-bets">My Bets</NavLink>
            <NavLink href="/leaderboard">Leaderboard</NavLink>
          </nav>
          <ManagerPicker managers={managers} currentManagerId={currentManagerId} />
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
            title="House dashboard"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 21h18" />
              <path d="M4 21V10.5L12 4l8 6.5V21" />
              <path d="M9 21v-6h6v6" />
              <path d="M9 13.5h6" />
            </svg>
          </Link>
          <span className="text-xs text-muted">
            Jerome Corp<sup className="text-[0.55em]">©</sup>
          </span>
        </div>
      </div>
    </header>
  );
}
