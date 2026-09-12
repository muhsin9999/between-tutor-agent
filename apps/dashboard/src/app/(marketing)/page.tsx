import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Between — one line a week, six days of practice",
  description:
    "A tutor sends one line at the end of a lesson. An agent works her student through the six days in plain Telegram chat, and builds her a briefing panel five minutes before the next one.",
};

/* ---------------------------------------------------------------- atoms -- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">
      {children}
    </p>
  );
}

function Rule() {
  return <hr className="border-0 border-t border-line" />;
}

/* ------------------------------------------------------------------ page -- */

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-ink-900 text-cream">
      {/* ---------------------------------------------------------- masthead */}
      <header className="mx-auto flex max-w-[1080px] items-baseline justify-between px-5 py-7 sm:px-10">
        <span className="font-display text-[22px] leading-none tracking-[-0.01em]">
          Between
        </span>
        <Link
          href="/sign-in"
          className="text-[13px] text-cream-dim transition-colors duration-150 ease-[var(--ease-out-strong)] hover:text-amber"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-[1080px] px-5 pb-28 sm:px-10">
        {/* ------------------------------------------------------------ hero */}
        <section className="border-t border-line pt-12 sm:pt-20">
          <p className="rise max-w-[44ch] text-[15px] leading-[1.65] text-cream-dim sm:text-base">
            A tutor&rsquo;s work exists for the fifty-five minutes she&rsquo;s in
            the room. Then{" "}
            <span className="text-cream">six dead days</span>, and the next
            lesson opens with &ldquo;how did it go.&rdquo;
          </p>

          <div className="rise mt-12 sm:mt-16" style={{ animationDelay: "90ms" }}>
            <Eyebrow>She sends one line at the end of a lesson</Eyebrow>
          </div>

          <blockquote
            className="rise mt-6 border-l-2 border-amber pl-5 sm:pl-8"
            style={{ animationDelay: "150ms" }}
          >
            <p className="font-display text-[clamp(1.9rem,6.2vw,4.1rem)] leading-[1.08] tracking-[-0.02em] text-cream [text-wrap:balance]">
              Jonas &mdash; German past tense of irregular verbs, ten minutes a
              day. He&rsquo;s nervous about speaking out loud.
            </p>
          </blockquote>

          <p
            className="rise mt-8 max-w-[52ch] text-[15px] leading-[1.65] text-cream-dim"
            style={{ animationDelay: "220ms" }}
          >
            That is the only thing she types all week. Six days come out of it.
            The nervousness lands as a speaking task on day 5, not day 1.
          </p>

          <div
            className="rise mt-10 flex flex-wrap items-center gap-x-6 gap-y-4"
            style={{ animationDelay: "290ms" }}
          >
            <Link
              href="/sign-in"
              className="inline-flex items-center rounded-[3px] bg-amber px-6 py-3 text-[14px] font-medium text-ink-900 transition-[transform,background-color] duration-200 ease-[var(--ease-out-strong)] hover:bg-amber-soft active:scale-[0.97]"
            >
              Start with one student
            </Link>
            <span className="text-[13px] text-cream-faint">
              Your student installs nothing. No app, no account, no password.
            </span>
          </div>
        </section>

        {/* ------------------------------------------------------ asymmetry */}
        <section className="mt-28 sm:mt-36">
          <Eyebrow>The asymmetry</Eyebrow>
          <h2 className="mt-4 max-w-[22ch] font-display text-[clamp(1.6rem,4vw,2.6rem)] leading-[1.12] tracking-[-0.015em]">
            The student never gets a panel.
          </h2>
          <p className="mt-5 max-w-[62ch] text-[15px] leading-[1.65] text-cream-dim">
            The premise is that he will not open a practice app &mdash; that is
            why the six days are empty. A panel on his side would rebuild the
            exact failure the product exists to fix. So the two halves of this
            product look nothing like each other.
          </p>

          <div className="mt-10 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
            {/* student */}
            <div className="bg-ink-850 p-6 sm:p-8">
              <Eyebrow>The student &middot; every day</Eyebrow>
              <h3 className="mt-3 font-display text-[26px] leading-tight tracking-[-0.01em]">
                Plain chat, forever
              </h3>
              <p className="mt-4 text-[14.5px] leading-[1.6] text-cream-dim">
                One question at a time, on a bus, in the app he already has. No
                install, no account, no password. Eight choices or fewer become
                an inline keyboard &mdash; never a screen to open.
              </p>
              <div className="mt-6 border-t border-line pt-5">
                <p className="text-[14px] text-cream-dim">
                  <span className="text-quiet">&ldquo;sehte&rdquo;</span>
                  <span className="px-2 text-cream-faint">&rarr;</span>
                  <span className="text-ahead">ging</span>
                </p>
              </div>
            </div>

            {/* tutor */}
            <div className="bg-ink-850 p-6 sm:p-8">
              <Eyebrow>The tutor &middot; five minutes before</Eyebrow>
              <h3 className="mt-3 font-display text-[26px] leading-tight tracking-[-0.01em]">
                A panel nobody drew
              </h3>
              <p className="mt-4 text-[14.5px] leading-[1.6] text-cream-dim">
                A model picks which of seven typed components appear, in what
                order, holding what contents. A quiet week and an error week
                produce genuinely different screens from the same code.
              </p>
              <div className="mt-6 space-y-2 border-t border-line pt-5">
                <p className="text-[13.5px] text-cream-dim">
                  <span className="text-cream-faint">Quiet week</span>
                  <span className="px-2 text-cream-faint">&mdash;</span>
                  QuietCard <span className="text-amber">&rarr;</span> PlanLane
                </p>
                <p className="text-[13.5px] text-cream-dim">
                  <span className="text-cream-faint">Error week</span>
                  <span className="px-2 text-cream-faint">&mdash;</span>
                  ErrorGrid <span className="text-amber">&rarr;</span> Streak{" "}
                  <span className="text-amber">&rarr;</span> PlanLane
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------- between the lessons */}
        <section className="mt-28 sm:mt-36">
          <Eyebrow>Between the lessons</Eyebrow>
          <h2 className="mt-4 max-w-[24ch] font-display text-[clamp(1.6rem,4vw,2.6rem)] leading-[1.12] tracking-[-0.015em]">
            What the agent does with the six days.
          </h2>

          <ol className="mt-10">
            {[
              {
                n: "01",
                h: "It plans the six days",
                p: "Structured output against a frozen schema. It reads the human half of the sentence, not just the nouns — and it introduces no material the tutor never set.",
              },
              {
                n: "02",
                h: "It notices a repeated error",
                p: "Same error twice · three correct in a row · two due steps missed. Computed in code from attempt rows, never by a model’s mood.",
              },
              {
                n: "03",
                h: "It rewrites the rest of the week, and says why",
                p: "Two misses on one rule fired a revision: day 3 changed from a drill to an explanation, with a reason a teacher would accept. It rewrites only the remaining days — it cannot extend the week.",
              },
            ].map((step, i) => (
              <li
                key={step.n}
                className={
                  "grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-2 py-7 sm:grid-cols-[4rem_1fr] sm:gap-x-8 " +
                  (i === 0 ? "border-t border-b border-line" : "border-b border-line")
                }
              >
                <span className="pt-1 text-[12px] tracking-[0.12em] text-amber">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-display text-[20px] leading-snug tracking-[-0.01em] sm:text-[23px]">
                    {step.h}
                  </h3>
                  <p className="mt-2 max-w-[58ch] text-[14.5px] leading-[1.6] text-cream-dim">
                    {step.p}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-8 max-w-[58ch] text-[14px] leading-[1.6] text-cream-faint">
            The revision is the only thing separating this from a scheduled
            message. Without it, the honest word is &ldquo;scheduler&rdquo;, not
            &ldquo;agent&rdquo;.
          </p>
        </section>

        {/* --------------------------------------------------- safeguarding */}
        <section className="mt-28 sm:mt-36">
          <Eyebrow>Safeguarding</Eyebrow>
          <p className="mt-5 max-w-[30ch] font-display text-[clamp(1.35rem,3.2vw,2rem)] leading-[1.25] tracking-[-0.01em] text-cream [text-wrap:balance]">
            It stops rather than escalating when a student goes quiet, and it
            does not message under-18s except through a parent&rsquo;s account.
          </p>
          <p className="mt-6 max-w-[58ch] text-[14.5px] leading-[1.65] text-cream-dim">
            It reports to nobody but that student&rsquo;s own tutor. A parent
            keeps one thread &mdash; a weekly line saying he practised four days.
            Not his answers, not his errors.
          </p>
        </section>

        {/* ------------------------------------------------------------- cta */}
        <section className="mt-28 border-t border-line pt-14 sm:mt-36">
          <h2 className="max-w-[18ch] font-display text-[clamp(1.9rem,5vw,3.2rem)] leading-[1.08] tracking-[-0.02em]">
            Start with one student.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[15px] leading-[1.65] text-cream-dim">
            You sign up with an email and a link &mdash; there is no password. He
            never signs up at all: you type his name, he taps a link, and the six
            days stop being empty.
          </p>
          <Link
            href="/sign-in"
            className="mt-9 inline-flex items-center rounded-[3px] bg-amber px-6 py-3 text-[14px] font-medium text-ink-900 transition-[transform,background-color] duration-200 ease-[var(--ease-out-strong)] hover:bg-amber-soft active:scale-[0.97]"
          >
            Start with one student
          </Link>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="mx-auto max-w-[1080px] px-5 pb-16 sm:px-10">
        <Rule />
        <div className="flex flex-wrap gap-x-7 gap-y-2 pt-6 text-[13px] text-cream-faint">
          <span>Between</span>
          <span>Telegram</span>
          <span>One line a week</span>
        </div>
      </footer>
    </div>
  );
}
