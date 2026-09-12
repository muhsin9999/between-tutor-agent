import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Between — lesson brief",
  description: "What the week between lessons actually produced.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <head>
        {/* Telegram injects window.Telegram.WebApp only after this runs.
            Without it initData is empty and the panel falls back to the dev
            GET, which production refuses. */}
        <script src="https://telegram.org/js/telegram-web-app.js" async={false} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
