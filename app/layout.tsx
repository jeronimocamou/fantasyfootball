import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import { getManagers } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";
import "./globals.css";

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
  const [managers, currentManagerId] = await Promise.all([
    getManagers(),
    getCurrentManagerId(),
  ]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Nav managers={managers} currentManagerId={currentManagerId} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
        <footer className="border-t border-border-color px-6 py-6 text-center text-xs text-muted">
          Crackyard Sportsbook · play-money only, nothing here is real currency
        </footer>
      </body>
    </html>
  );
}
