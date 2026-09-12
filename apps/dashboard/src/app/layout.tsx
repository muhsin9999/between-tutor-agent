/**
 * Root layout for the tutor's web app.
 *
 * The two typefaces are loaded here and bound to the token names declared in
 * `globals.css` (`--font-sans`, `--font-display`), so every `font-sans` and
 * `font-display` utility downstream resolves to a self-hosted face with no
 * layout shift and no network round trip to Google at render time.
 */
import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Between",
  description: "Who needs you this week.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen bg-ink-900 font-sans text-cream antialiased">{children}</body>
    </html>
  );
}
