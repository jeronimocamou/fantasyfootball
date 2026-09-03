import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import { getManagers, type Manager } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";
import "./globals.css";

// Never attempt to prerender this at build time — it depends on a live DB
// connection and per-request cookies, neither of which exist during
// `next build`. Without this, a build-time DB hiccup can fail the whole
// build instead of just this layout falling back gracefully at runtime.
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crackyard Sportsbook",
  description: "Weekly betting lines on the Crackyard fantasy football league, built off ESPN's live projections",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let managers: Manager[] = [];
  let dbError = false;
  try {
    managers = await getManagers();
  } catch (err) {
    console.error("Failed to load managers:", err);
    dbError = true;
  }
  const currentManagerId = await getCurrentManagerId();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Nav managers={managers} currentManagerId={currentManagerId} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          {dbError ? (
            <p className="rounded-lg border border-red-600/30 bg-red-600/10 p-4 text-sm text-red-600 dark:text-red-400">
              Can&apos;t reach the database right now. Try again in a moment.
            </p>
          ) : (
            children
          )}
        </main>
        <footer className="border-t border-border-color px-6 py-6 text-center text-xs text-muted">
          Crackyard Sportsbook
        </footer>
      </body>
    </html>
  );
}
