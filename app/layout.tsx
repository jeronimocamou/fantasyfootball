import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import { getSeasons } from "@/lib/db";
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
  title: "Crackyard FFL",
  description: "Stats and history for the Crackyard fantasy football league",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const seasons = getSeasons();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Nav seasons={seasons} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
        <footer className="border-t border-border-color px-6 py-6 text-center text-xs text-muted">
          Crackyard FFL · league {"1829348794"} · built from ESPN Fantasy history
        </footer>
      </body>
    </html>
  );
}
