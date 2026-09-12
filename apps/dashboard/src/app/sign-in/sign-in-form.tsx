"use client";

import { useEffect, useId, useRef, useState } from "react";
import Providers from "./providers";
import { fetchAuthStatus, signIn } from "@/lib/auth-client";
import type { AuthStatus } from "@/lib/auth";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "sending" | "sent";

/* --------------------------------------------------------------- the field */
/* Not a bare input: a labelled shell that owns its own focus treatment,
   invalid treatment and message, so the field reads as one object.          */

function EmailField({
  value,
  onChange,
  error,
  onBlur,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  onBlur: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const invalid = Boolean(error);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] uppercase tracking-[0.16em] text-cream-faint"
      >
        Your email
      </label>

      <div
        className={
          "mt-3 rounded-[3px] border bg-ink-850 transition-[border-color,transform] duration-200 ease-[var(--ease-out-strong)] " +
          (invalid
            ? "border-quiet"
            : "border-line focus-within:border-amber hover:border-ink-600")
        }
      >
        <input
          id={id}
          ref={inputRef}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="amara@example.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={invalid}
          aria-describedby={messageId}
          className="w-full bg-transparent px-4 py-3.5 text-[15px] text-cream outline-none placeholder:text-cream-faint focus:outline-none"
        />
      </div>

      <p
        id={messageId}
        role={invalid ? "alert" : undefined}
        className={
          "mt-2.5 text-[13px] leading-[1.5] transition-opacity duration-200 ease-[var(--ease-out-strong)] " +
          (invalid ? "text-quiet opacity-100" : "text-cream-faint opacity-100")
        }
      >
        {error ?? "We send a link. Clicking it is the whole sign-in."}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- the form */

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [sentTo, setSentTo] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* What is actually wired on this server. `null` until the answer arrives —
     treated as "unknown", never as "configured", so the page cannot claim a
     capability it has not confirmed. See lib/auth-client.ts. */
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    void fetchAuthStatus(abort.signal).then((s) => {
      if (!abort.signal.aborted) setAuth(s);
    });
    return () => abort.abort();
  }, []);

  const ready = auth?.configured === true;
  /* The link exists either way; the honest difference is where it came out. */
  const emailed = auth?.emailDelivery === "resend";

  function validate(v: string): string | null {
    const trimmed = v.trim();
    if (!trimmed) return "Enter the email you want the link sent to.";
    if (!EMAIL.test(trimmed))
      return "That does not look like an email address — check for a typo.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate(email);
    setError(problem);
    if (problem) {
      inputRef.current?.focus();
      return;
    }

    const address = email.trim();
    setStatus("sending");

    /* The real send. Better Auth mints a single-use token, stores it, and hands
       the URL to `sendMagicLink` on the server — which either emails it through
       Resend or, with no key set, prints it to the server console. The reply
       below is worded from `auth.emailDelivery`, so it never says "check your
       email" for a link that only ever reached a terminal. */
    const { error: sendError } = await signIn.magicLink({
      email: address,
      callbackURL: "/app",
    });

    if (sendError) {
      setStatus("idle");
      setError(
        sendError.message ??
          "The link could not be sent. Nothing was created — try again in a moment.",
      );
      inputRef.current?.focus();
      return;
    }

    setSentTo(address);
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rise">
        <p className="text-[11px] uppercase tracking-[0.16em] text-amber">
          {emailed ? "Link sent" : "Link created"}
        </p>
        <h2 className="mt-4 font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-[1.1] tracking-[-0.02em]">
          {emailed ? "Check your email" : "Check the server console"}
        </h2>
        {emailed ? (
          <p className="mt-5 max-w-[46ch] text-[15px] leading-[1.65] text-cream-dim">
            A link is on its way to{" "}
            <span className="text-cream">{sentTo}</span>. Clicking it signs you
            in and creates the account. There is no password to set.
          </p>
        ) : (
          <p className="mt-5 max-w-[46ch] text-[15px] leading-[1.65] text-cream-dim">
            A real, single-use link for{" "}
            <span className="text-cream">{sentTo}</span> exists — but{" "}
            <span className="text-stuck">no email was sent</span>, because{" "}
            <code className="text-cream">RESEND_API_KEY</code> is not set on this
            server. It was printed to the terminal running the dev server
            instead. Paste it into the address bar and the sign-in is genuinely
            end-to-end.
          </p>
        )}

        <ol className="mt-9 border-t border-line">
          {[
            "Click the link — the account exists from that moment.",
            "Connect Telegram. Your phone lights up with a message from a bot that already knows your name.",
            "Add your first student: a name, whether he is under 18, and a link to send him.",
          ].map((step, i) => (
            <li
              key={step}
              className="grid grid-cols-[1.75rem_1fr] gap-x-4 border-b border-line py-4"
            >
              <span className="text-[12px] tracking-[0.1em] text-cream-faint">
                {`0${i + 1}`}
              </span>
              <span className="text-[14px] leading-[1.55] text-cream-dim">
                {step}
              </span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setError(null);
          }}
          className="mt-8 text-[13.5px] text-cream-dim underline-offset-4 transition-[color,transform] duration-150 ease-[var(--ease-out-strong)] hover:text-amber hover:underline active:scale-[0.97]"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">
        For tutors
      </p>
      <h2 className="mt-4 font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-[1.1] tracking-[-0.02em]">
        Start with one student
      </h2>
      <p className="mt-5 max-w-[46ch] text-[15px] leading-[1.65] text-cream-dim">
        No password, whichever door you come through. Tutors are not developers,
        and this account holds a minor&rsquo;s practice record &mdash; a password
        would be a support burden and a leak risk.
      </p>

      {/* The fast path first: most tutors already have one of these open. */}
      <div className="mt-10">
        <Providers status={auth} />
      </div>

      <div className="my-8 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">
          or
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <EmailField
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (error) setError(null);
          }}
          onBlur={() => {
            if (email.trim()) setError(validate(email));
          }}
          error={error}
          inputRef={inputRef}
        />

        <button
          type="submit"
          disabled={status === "sending" || auth?.configured === false}
          className="mt-7 inline-flex w-full items-center justify-center rounded-[3px] bg-amber px-6 py-3.5 text-[14px] font-medium text-ink-900 transition-[transform,background-color] duration-200 ease-[var(--ease-out-strong)] hover:bg-amber-soft active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-cream-faint disabled:active:scale-100 sm:w-auto"
        >
          {status === "sending" ? "Sending…" : "Send me a link"}
        </button>
      </form>

      {/* The truth about this server, stated once, at the bottom. It is read
          from /api/auth/_status rather than asserted, so it cannot drift out of
          date the way the previous hard-coded "not wired yet" line would have. */}
      {auth === null ? (
        <p className="mt-10 border-t border-line pt-6 text-[13px] leading-[1.6] text-cream-faint">
          Checking what this server has configured&hellip;
        </p>
      ) : !ready ? (
        <p className="mt-10 border-t border-line pt-6 text-[13px] leading-[1.6] text-cream-faint">
          <span className="text-stuck">Sign-in is not configured.</span> Better
          Auth is wired up, but this server has no{" "}
          <code className="text-cream">DATABASE_URL</code>, so there is nowhere
          to keep a session and nothing here can create an account. Set it and
          restart &mdash; <code className="text-cream">docs/AUTH-SETUP.md</code>{" "}
          has the four lines. Your student needs none of this: he never signs up.
        </p>
      ) : (
        <p className="mt-10 border-t border-line pt-6 text-[13px] leading-[1.6] text-cream-faint">
          Real sign-in. The link is single-use and expires in ten minutes.
          {!emailed ? (
            <>
              {" "}
              <span className="text-stuck">Email delivery is off</span> &mdash;
              with no <code className="text-cream">RESEND_API_KEY</code> the link
              is printed to the server console instead of sent.
            </>
          ) : null}
          {!auth.google ? (
            <>
              {" "}
              Google is unavailable until{" "}
              <code className="text-cream">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="text-cream">GOOGLE_CLIENT_SECRET</code> are set.
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
