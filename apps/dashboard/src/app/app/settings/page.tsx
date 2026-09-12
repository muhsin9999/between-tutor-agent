/**
 * Settings.
 *
 * Read-only on purpose, and said out loud rather than implied: the account block
 * is a stub until Better Auth lands (AUTH.md), while the Telegram block is real
 * — it reads the same store the bot writes to.
 *
 * The danger zone is separated by more than a heading. Pausing a student and
 * deleting a student's data are the two actions in this product that a tutor
 * cannot undo, and both concern practice records of a named minor, so they sit
 * behind their own rule, their own colour, and eventually their own
 * confirmation step.
 */
import { store } from "agent-core";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { stagger } from "../_need";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const state = store.read();
  const students = Object.values(state.students);
  const tutorChat = state.tutor.chat_id;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-10 md:py-14">
      <header className="rise">
        <p className="text-xs uppercase tracking-[0.14em] text-cream-faint">Settings</p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-cream md:text-4xl">
          Your account and your students&rsquo; data.
        </h1>
      </header>

      {/* ── account ──────────────────────────────────────────────────────── */}
      <section className="rise mt-10" style={stagger(1)}>
        <h2 className="text-xs uppercase tracking-[0.14em] text-cream-faint">Account</h2>

        <Card className="mt-4 p-5">
          <Field label="Signed in as" value="Not signed in" />
          <Field label="Email" value="—" />
          <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-cream-dim">
            Magic-link sign-in is not wired yet. Until it is, this app trusts whoever opens it on
            this machine — which is fine for a prototype and not fine for a second tutor.
          </p>
        </Card>
      </section>

      {/* ── telegram ─────────────────────────────────────────────────────── */}
      <section className="rise mt-10" style={stagger(2)}>
        <h2 className="text-xs uppercase tracking-[0.14em] text-cream-faint">Telegram</h2>

        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[15px] text-cream">
                {tutorChat === null ? "No chat linked" : "Linked to your chat with the bot"}
              </p>
              <p className="mt-1 text-sm text-cream-dim">
                {tutorChat === null
                  ? "Send /start to the bot from the account you teach from. The link is made on that first message."
                  : "This is the chat the weekly brief is sent to."}
              </p>
            </div>
            <Badge tone={tutorChat === null ? "neutral" : "ahead"}>
              {tutorChat === null ? "Not linked" : "Linked"}
            </Badge>
          </div>

          {tutorChat !== null && (
            <p className="mt-4 border-t border-line pt-4 font-mono text-xs text-cream-faint">
              chat_id {tutorChat}
            </p>
          )}
        </Card>
      </section>

      {/* ── danger ───────────────────────────────────────────────────────── */}
      <section className="rise mt-14" style={stagger(3)}>
        <div className="h-px w-full bg-line" aria-hidden="true" />

        <h2 className="mt-10 text-xs uppercase tracking-[0.14em] text-quiet">Danger zone</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-cream-dim">
          Pausing stops the bot writing to a student and stops their week advancing. Deleting
          removes every plan version and every attempt they have ever sent — this product holds
          practice records of named minors, so delete means delete.
        </p>

        <Card className="mt-5 border-quiet/30 p-5">
          {students.length === 0 ? (
            <p className="text-sm leading-relaxed text-cream-dim">
              Nothing to pause and nothing to delete — you have no students yet. This section fills
              itself the moment one enrols.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {students.map((student) => (
                <li
                  key={student.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] text-cream">{student.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-cream-faint">{student.id}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <StubButton>Pause</StubButton>
                    <StubButton danger>Delete data</StubButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-cream-faint">
            Both actions are shown but not yet wired — they land with the database, so that
            &ldquo;deleted&rdquo; can mean a cascade the store cannot currently promise. Nothing on
            this page changes anything today.
          </p>
        </Card>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
      <span className="text-sm text-cream-dim">{label}</span>
      <span className="text-sm text-cream">{value}</span>
    </div>
  );
}

/** Deliberately a disabled button: it is honest about being unwired, and it
 *  keeps the eventual real control in the right place in the tab order. */
function StubButton({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled
      title="Not wired yet"
      className={[
        "cursor-not-allowed rounded-md border px-3 py-1.5 text-xs opacity-60",
        danger ? "border-quiet/40 text-quiet" : "border-line text-cream-dim",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
