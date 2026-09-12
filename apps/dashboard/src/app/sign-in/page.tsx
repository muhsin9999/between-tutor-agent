import Link from "next/link";
import type { Metadata } from "next";
import SignInForm from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in — Between",
  description:
    "Magic-link sign-in for tutors. One email, one link, no password. The student never signs up at all.",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-ink-900 text-cream">
      <header className="mx-auto flex max-w-[1080px] items-baseline justify-between px-5 py-7 sm:px-10">
        <Link
          href="/"
          className="font-display text-[22px] leading-none tracking-[-0.01em] transition-colors duration-150 ease-[var(--ease-out-strong)] hover:text-amber"
        >
          Between
        </Link>
        <Link
          href="/"
          className="text-[13px] text-cream-dim transition-colors duration-150 ease-[var(--ease-out-strong)] hover:text-amber"
        >
          Back
        </Link>
      </header>

      <main className="mx-auto max-w-[1080px] px-5 pb-28 sm:px-10">
        <div className="grid gap-16 border-t border-line pt-12 sm:pt-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-20">
          {/* the form */}
          <div className="rise max-w-[34rem]">
            <SignInForm />
          </div>

          {/* the other half of the product */}
          <aside
            className="rise self-start border-t border-line pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12"
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">
              And your student
            </p>
            <p className="mt-5 max-w-[30ch] font-display text-[22px] leading-[1.3] tracking-[-0.01em] sm:text-[25px]">
              He never signs up. You already know his name &mdash; you type it
              when you invite him.
            </p>
            <p className="mt-5 max-w-[40ch] text-[14px] leading-[1.6] text-cream-dim">
              He taps a link and gets one message: &ldquo;Hi Jonas &mdash; Amara
              set this up. About ten minutes a day, right here. Ready?&rdquo; He
              taps Ready. That is the entire sign-up.
            </p>
            <p className="mt-5 max-w-[40ch] text-[13.5px] leading-[1.6] text-cream-faint">
              No email, no password, no app. The link is single-use and expires,
              so a forwarded one cannot enrol a stranger. If the student is under
              18, the invite goes to a parent first.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
