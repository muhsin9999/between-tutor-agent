"use client";

/**
 * Connect Telegram — ONBOARDING.md flow 1, step 5.
 *
 * "She taps a button on a laptop and her phone lights up with a message from a
 * bot that already knows her name. That is the moment the product stops feeling
 * like two things." Everything in this file exists to make that one tap work and
 * to survive it not working.
 *
 * The tap does two things in order: ask the server for a freshly minted link
 * (it is signed against her session, so only the server can make one), then open
 * it. A browser that blocks the pop-up is the common failure and the only one
 * that matters, so the raw link is always revealed afterwards rather than
 * offered as a fallback nobody finds.
 */
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface LinkTelegramProps {
  /** True once `user.telegram_user_id` is set — the join is made. */
  connected: boolean;
  /** Her Telegram id, shown as evidence rather than as a claim. */
  telegramUserId: string | null;
  /** Pre-formatted on the server, so there is no locale to disagree about. */
  linkedAt: string | null;
}

/** Shared motion: named properties, out-strong, nothing near 300ms, never ease-in. */
const MOTION =
  "transition-[background-color,border-color,color,opacity] duration-[160ms] ease-[var(--ease-out-strong)]";

export function LinkTelegram({ connected, telegramUserId, linkedAt }: LinkTelegramProps) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function connect() {
    setPending(true);
    setError(null);
    setBlocked(false);
    try {
      const response = await fetch("/api/link", {
        method: "POST",
        headers: { accept: "application/json" },
      });
      const body = (await response.json().catch(() => null)) as
        | { url?: string; message?: string }
        | null;

      if (!response.ok || typeof body?.url !== "string") {
        setError(
          body?.message ??
            (response.status === 401
              ? "Your session has expired. Sign in again, then try once more."
              : "Could not create a link just now. Try again in a moment."),
        );
        return;
      }

      setUrl(body.url);
      // `noopener` is not optional: without it the opened tab keeps a handle on
      // this one. A blocked pop-up returns null, which is the case we care about.
      const opened = window.open(body.url, "_blank", "noopener,noreferrer");
      setBlocked(opened === null);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Copying is blocked in this browser — select the link and copy it by hand.");
    }
  }

  if (connected) {
    return (
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] text-cream">Connected to Telegram</p>
            <p className="mt-1 text-sm leading-relaxed text-cream-dim">
              The bot and this dashboard are the same account now. Send your lesson line in
              Telegram and it lands here.
            </p>
          </div>
          <Badge tone="ahead">Connected</Badge>
        </div>

        {(telegramUserId || linkedAt) && (
          <p className="mt-4 border-t border-line pt-4 font-mono text-xs text-cream-faint">
            {telegramUserId ? `telegram_user_id ${telegramUserId}` : null}
            {telegramUserId && linkedAt ? " · " : null}
            {linkedAt ? `linked ${linkedAt}` : null}
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-prose">
          <p className="text-[15px] text-cream">Not connected</p>
          <p className="mt-1 text-sm leading-relaxed text-cream-dim">
            Connect it and the bot you already teach with becomes yours — one tutor, whether you
            come in through Telegram or through this tab.
          </p>
        </div>
        <Badge tone="neutral">Not connected</Badge>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={connect} disabled={pending} aria-busy={pending}>
          {pending ? "Opening Telegram…" : "Connect Telegram"}
        </Button>
        <span className={`text-xs text-cream-faint ${MOTION}`}>
          Opens your Telegram. The link is good for 15 minutes.
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm leading-relaxed text-quiet">
          {error}
        </p>
      )}

      {url && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm leading-relaxed text-cream-dim">
            {blocked
              ? "Your browser blocked the pop-up. Open this link yourself — it is the same one:"
              : "Telegram should be opening. If nothing happened, this is the same link:"}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={[
                "min-w-0 flex-1 truncate rounded-[5px] border border-line bg-ink-850",
                "px-3 py-2 font-mono text-xs text-amber hover:border-ink-600",
                "transition-[border-color,color,transform] duration-[140ms]",
                "ease-[var(--ease-out-strong)] active:scale-[0.97]",
              ].join(" ")}
            >
              {url}
            </a>
            <Button variant="subtle" size="sm" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
