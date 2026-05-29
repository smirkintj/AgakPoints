import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/layout/SessionProvider";

export const metadata: Metadata = {
  title: "AgakPoints — Gamified Scrum Poker",
  description: "Real-time scrum poker with JIRA integration, gamification, and team calendar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-zinc-950 text-white antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
