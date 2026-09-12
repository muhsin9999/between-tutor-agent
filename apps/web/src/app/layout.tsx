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
        {/*
          Telegram injects window.Telegram.WebApp only once this has run, and a
          blocking script in <head> runs before React hydrates — so initData is
          there on the panel effect's first tick. Without it initData is empty,
          the panel falls back to the dev GET, and production correctly refuses
          with "POST signed initData".

          It MUST live inside the one <head> above. A second <head> element
          typechecks, renders in dev, and fails the production build with
          "The `<head>` tag may only be rendered once." — which is how this
          shipped broken once already.
        */}
        <script src="https://telegram.org/js/telegram-web-app.js" async={false} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
