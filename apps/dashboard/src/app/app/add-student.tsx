"use client";

/**
 * Add student — ONBOARDING.md flow 2, the half of onboarding that was missing.
 *
 * Until now the only way to enrol anyone was to send `/tutor` in Telegram and
 * paste the link out of the bot's reply by hand. This is the same link, asked
 * for from the dashboard, with his name typed first — and the name is the whole
 * trick: **the student never signs up.** She already knows what to call him, so
 * his registration collapses into one tap.
 *
 * The honesty rule this file keeps: an invite is not an enrolment. Nothing here
 * ever says "added" or "enrolled" on the strength of a minted link. He is
 * enrolled when he taps it and answers the bot — and that sentence is on screen,
 * not in a tooltip.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

export interface AddStudentProps {
  /**
   * True when the roster has nobody on it. This card is then the empty state
   * itself — there is no second "no students yet" message, because a dead end
   * and the way out of it should not be two separate boxes.
   */
  empty: boolean;
}

/** Shared motion: named properties, out-strong, well under 300ms, never ease-in. */
const MOTION =
  "transition-[background-color,border-color,color,opacity] duration-[160ms] ease-[var(--ease-out-strong)]";

interface Minted {
  inviteUrl: string;
  /** True only when a row actually reached the database. */
  persisted: boolean;
  /** The server's own account of what it did and did not save. */
  message: string;
  name: string;
}

export function AddStudent({ empty }: AddStudentProps) {
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [minted, setMinted] = React.useState<Minted | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();

    const typed = name.trim();
    if (typed.length === 0) {
      setFieldError("His name, as you say it in a lesson.");
      return;
    }

    setPending(true);
    setError(null);
    setFieldError(null);
    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ name: typed }),
      });
      const body = (await response.json().catch(() => null)) as
        | { inviteUrl?: string; persisted?: boolean; message?: string }
        | null;

      if (!response.ok || typeof body?.inviteUrl !== "string") {
        setError(
          body?.message ??
            (response.status === 401
              ? "Your session has expired. Sign in again, then try once more."
              : "Could not create an invite just now. Try again in a moment."),
        );
        return;
      }

      setMinted({
        inviteUrl: body.inviteUrl,
        persisted: body.persisted === true,
        message: body.message ?? "",
        name: typed,
      });
      setName("");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!minted) return;
    try {
      await navigator.clipboard.writeText(minted.inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Copying is blocked in this browser — select the link and copy it by hand.");
    }
  }

  return (
    <Card className="p-5">
      <div className="max-w-prose">
        <p className="font-display text-xl text-cream">
          {empty ? "Your first student starts with his name." : "Add a student"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-cream-dim">
          Type what you call him. He never signs up — no app, no email, no password.
          You send him a link, he taps it, and the bot already knows who he is.
        </p>
      </div>

      <form onSubmit={add} className="mt-5 flex flex-wrap items-start gap-3">
        <Field
          label="Student's name"
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
            if (fieldError) setFieldError(null);
          }}
          error={fieldError ?? undefined}
          disabled={pending}
          autoComplete="off"
          maxLength={80}
          containerClassName="min-w-0 flex-1 basis-56"
        />
        {/* Nudged down to sit on the field's baseline, not the error slot's. */}
        <Button type="submit" disabled={pending} aria-busy={pending} className="mt-2">
          {pending ? "Making a link…" : "Add student"}
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-1 text-sm leading-relaxed text-quiet">
          {error}
        </p>
      )}

      {minted && (
        <div className="mt-2 border-t border-line pt-4">
          <p className="text-[15px] text-cream">
            A link for {minted.name}. Send it to him however you already talk to him.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={minted.inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={[
                "min-w-0 flex-1 truncate rounded-[5px] border border-line bg-ink-850",
                "px-3 py-2 font-mono text-xs text-amber hover:border-ink-600",
                "transition-[border-color,color,transform] duration-[140ms]",
                "ease-[var(--ease-out-strong)] active:scale-[0.97]",
              ].join(" ")}
            >
              {minted.inviteUrl}
            </a>
            <Button variant="subtle" size="sm" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {/*
            What actually happens next, in order, with no step skipped. He is not
            on the roster yet and the sentence below says so rather than letting
            a green tick imply it.
          */}
          <p className={`mt-4 text-sm leading-relaxed text-cream-dim ${MOTION}`}>
            He taps it, the bot asks his name, and he is enrolled. He appears on this
            roster at that point — not before.
          </p>

          {minted.message && (
            <p className="mt-2 text-xs leading-relaxed text-cream-faint">{minted.message}</p>
          )}

          {!minted.persisted && (
            <p className="mt-2 text-xs leading-relaxed text-cream-faint">
              Nothing is stored against his name on this side yet, so if you lose this
              link, add him again and send the new one.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
