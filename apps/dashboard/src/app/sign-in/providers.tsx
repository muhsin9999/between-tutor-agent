"use client";

import { useId, useState } from "react";
import { OAuthButton } from "@/components/ui/oauth-button";
import { signIn } from "@/lib/auth-client";
import type { AuthStatus } from "@/lib/auth";

/* ------------------------------------------------------------------- marks */
/* Inline, never fetched: a sign-in button that waits on a third-party image
   is a sign-in button that sometimes renders blank. These are the two places
   in this app allowed to carry a literal hex — they are brand marks, not
   design tokens, and a Telegram blue that drifts is a Telegram blue that is
   wrong.                                                                     */

function TelegramMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#2AABEE" />
      <path
        fill="#FFFFFF"
        d="M5.49 11.6 17.05 7.14c.54-.2 1.01.13.84.94l-1.97 9.28c-.14.65-.53.81-1.07.5l-2.96-2.18-1.43 1.38c-.16.16-.29.29-.59.29l.21-2.99 5.45-4.92c.24-.21-.05-.33-.36-.13l-6.73 4.24-2.9-.91c-.63-.2-.64-.63.13-.94Z"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
      />
    </svg>
  );
}

/* --------------------------------------------------------------- providers */

type Provider = "telegram" | "google";

/**
 * Telegram is the one button here that is still a stub, and it says so.
 *
 * Better Auth has no Telegram provider, and Telegram is not an OAuth 2 identity
 * provider at all — there is no authorize URL to redirect to. Signing in with
 * Telegram means embedding *their* Login Widget, which posts back a payload
 * signed with a key derived from the bot token, plus a BotFather `/setdomain`
 * registering the exact origin the widget is allowed to run on. Neither is
 * something a redirect can fake, so this button does not pretend.
 *
 * The full integration plan is in `docs/AUTH-SETUP.md`.
 */
const TELEGRAM_NOTICE =
  "And it cannot be faked with a redirect. Telegram is not an OAuth provider: signing in this " +
  "way needs Telegram’s own Login Widget, which posts back a payload signed with the bot token, " +
  "plus a BotFather /setdomain registering this exact origin — without which the widget will not " +
  "render at all. Neither exists yet, so nothing was sent and no account was created. Use Google " +
  "or the email link below; you can attach this Telegram account afterwards from Settings, which " +
  "is the direction onboarding takes anyway.";

/* The notice belongs under the button that was pressed, not under the group —
   an explanation two rows away from the thing it explains is an explanation
   the tutor has to hunt for. Both regions stay mounted so the live region
   exists before anything is announced into it; only one ever has content. */
const NOTICE_CLASS =
  "max-w-[46ch] text-[13px] leading-[1.6] text-cream-faint empty:mt-0 [&:not(:empty)]:mt-3";

function Notice({
  id,
  lead,
  children,
}: {
  id: string;
  lead?: string;
  children?: React.ReactNode;
}) {
  return (
    <p id={id} role="status" aria-live="polite" className={NOTICE_CLASS}>
      {children ? (
        <>
          {lead ? <span className="text-stuck">{lead}</span> : null}
          {lead ? " " : null}
          {children}
        </>
      ) : null}
    </p>
  );
}

export default function Providers({ status }: { status: AuthStatus | null }) {
  const [tapped, setTapped] = useState<Provider | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const base = useId();
  const noticeId: Record<Provider, string> = {
    telegram: `${base}-telegram`,
    google: `${base}-google`,
  };

  /* `status === null` means we have not heard back from /api/auth/_status yet.
     That window is milliseconds, so the buttons stay live through it rather
     than flickering from disabled to enabled in front of the tutor. */
  const known = status !== null;
  const googleReady = status?.configured === true && status.google === true;

  async function continueWithGoogle() {
    setTapped("google");
    setGoogleError(null);

    if (known && !googleReady) return;

    setHandoff(true);
    /* A real handoff: this navigates away to Google. If it comes back instead,
       it came back with a reason, and the reason is what gets shown. */
    const { error } = await signIn.social({
      provider: "google",
      callbackURL: "/app",
      errorCallbackURL: "/sign-in",
    });

    if (error) {
      setHandoff(false);
      setGoogleError(
        error.message ??
          "Google turned the request down. Nothing was created — try the email link below.",
      );
    }
  }

  const showGoogleNotice = tapped === "google" && (!googleReady || googleError);

  return (
    <div>
      <OAuthButton
        provider="Telegram"
        icon={<TelegramMark />}
        onClick={() => setTapped("telegram")}
        aria-describedby={tapped === "telegram" ? noticeId.telegram : undefined}
      />

      <p className="mt-3 max-w-[46ch] text-[13px] leading-[1.6] text-cream-faint">
        The bot on your phone is already you. Signing in this way links it to
        this dashboard, so your students come with you.
      </p>

      <Notice id={noticeId.telegram} lead="Not wired yet.">
        {tapped === "telegram" ? TELEGRAM_NOTICE : null}
      </Notice>

      <div className="mt-4">
        <OAuthButton
          provider="Google"
          icon={<GoogleMark />}
          loading={handoff}
          disabled={known && !googleReady}
          onClick={continueWithGoogle}
          aria-describedby={showGoogleNotice ? noticeId.google : undefined}
        >
          {handoff ? "Taking you to Google…" : undefined}
        </OAuthButton>

        <Notice
          id={noticeId.google}
          lead={googleError ? undefined : "Not configured."}
        >
          {showGoogleNotice
            ? googleError ??
              (status?.configured === false
                ? "This server has no DATABASE_URL, so there is nowhere to keep a session. Nothing was sent and no account was created."
                : "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set on this server, so there is nothing to hand off to. Nothing was sent and no account was created.")
            : null}
        </Notice>
      </div>
    </div>
  );
}

/* The buttons carry a `loading` state (see OAuthButton) for the redirect wait.
   It is set only around the real Google handoff — a spinner that spins over
   nothing is the same lie as a fake success, so Telegram never gets one. */
