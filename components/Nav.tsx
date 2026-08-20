import Link from "next/link";
import { getSeasons } from "@/lib/db";

export default function Nav() {
  const seasons = getSeasons();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Crackyard FFL
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/" className="hover:text-foreground">
            All-Time
          </Link>
          <Link href="/analytics" className="hover:text-foreground">
            Analytics
          </Link>
          <Link href="/predictions" className="hover:text-foreground">
            2026 Predictions
          </Link>
          <Link href="/records" className="hover:text-foreground">
            Records
          </Link>
          <div className="flex items-center gap-1">
            <span>Seasons:</span>
            {seasons.map((s) => (
              <Link key={s} href={`/season/${s}`} className="hover:text-foreground">
                {s}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
