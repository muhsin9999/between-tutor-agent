"use client";

import { useId, useRef, useState } from "react";
import Providers from "./providers";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "sent";

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

  function validate(v: string): string | null {
    const trimmed = v.trim();
    if (!trimmed) return "Enter the email you want the link sent to.";
    if (!EMAIL.test(trimmed))
      return "That does not look like an email address — check for a typo.";
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate(email);
    setError(problem);
    if (problem) {
      inputRef.current?.focus();
      return;
    }
    setSentTo(email.trim());
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rise">
        <p className="text-[11px] uppercase tracking-[0.16em] text-amber">
          Link sent
        </p>
        <h2 className="mt-4 font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-[1.1] tracking-[-0.02em]">
          Check your email
        </h2>
        <p className="mt-5 max-w-[46ch] text-[15px] leading-[1.65] text-cream-dim">
          A link is on its way to{" "}
          <span className="text-cream">{sentTo}</span>. Clicking it signs you in
          and creates the account. There is no password to set.
        </p>

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
        <Providers />
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
          className="mt-7 inline-flex w-full items-center justify-center rounded-[3px] bg-amber px-6 py-3.5 text-[14px] font-medium text-ink-900 transition-[transform,background-color] duration-200 ease-[var(--ease-out-strong)] hover:bg-amber-soft active:scale-[0.97] sm:w-auto"
        >
          Send me a link
        </button>
      </form>

      <p className="mt-10 border-t border-line pt-6 text-[13px] leading-[1.6] text-cream-faint">
        <span className="text-stuck">Not wired yet.</span> Nothing on this page
        sends anything or creates an account &mdash; email, Telegram and Google
        alike. It is the shape of the flow, not the flow. Sign-in lands with the
        database and Better Auth.
      </p>
    </div>
  );
}
