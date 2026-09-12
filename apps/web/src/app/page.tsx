/**
 * The root of the deployed panel host.
 *
 * This used to be the starter kit's incident-assistant demo — someone else's
 * project on our live URL. It is the first thing a judge sees, so it says what
 * Between is and points at the two real surfaces.
 */
import Link from "next/link";

export const metadata = {
  title: "Between",
  description: "A tutor sends one line. The agent works the six days between lessons.",
};

export default function Home() {
  return (
    <main style={shell}>
      <p style={eyebrow}>Agents, Everywhere &middot; Abuja &middot; 12 Sep 2026</p>

      <h1 style={h1}>Between</h1>

      <p style={standfirst}>
        A tutor&rsquo;s work exists for the fifty-five minutes she&rsquo;s in the room.
        Then <em style={{ color: "#B0700F", fontStyle: "normal" }}>six dead days</em>,
        and the next lesson opens with &ldquo;how did it go.&rdquo;
      </p>

      <p style={body}>
        She sends <strong>one line</strong> at the end of a lesson. That is the only thing
        she types all week. The agent plans the six days, works them with her student in
        plain Telegram chat, and five minutes before the next lesson builds her a briefing
        panel whose shape comes from what the week actually produced.
      </p>

      <p style={quote}>
        Jonas &mdash; German past tense of irregular verbs, ten minutes a day.
        He&rsquo;s nervous about speaking out loud.
      </p>

      <div style={row}>
        <Link href="/panel" style={primary}>The lesson brief</Link>
        <Link href="/tutor" style={secondary}>All students</Link>
        <a href="https://t.me/between_tutor_bot" style={secondary}>The bot</a>
      </div>

      <p style={foot}>
        The student installs nothing &mdash; no app, no account, no password.
        He answers in the chat app already on his phone.
      </p>
    </main>
  );
}

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const shell: React.CSSProperties = {
  maxWidth: 620, margin: "0 auto", padding: "56px 20px 80px",
  background: "#FBF5E6", minHeight: "100vh", fontFamily: SANS, color: "#1C2331",
};
const eyebrow: React.CSSProperties = {
  margin: 0, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C8578",
};
const h1: React.CSSProperties = {
  margin: "14px 0 0", fontSize: 54, lineHeight: 1, letterSpacing: "-0.02em",
  color: "#16306B", fontWeight: 600,
};
const standfirst: React.CSSProperties = {
  margin: "22px 0 0", fontSize: 21, lineHeight: 1.45, maxWidth: "30ch", textWrap: "balance",
};
const body: React.CSSProperties = {
  margin: "18px 0 0", fontSize: 16, lineHeight: 1.65, color: "#4A5162", maxWidth: "60ch",
};
const quote: React.CSSProperties = {
  margin: "26px 0 0", padding: "2px 0 2px 16px", borderLeft: "2px solid #F5A623",
  fontSize: 17, lineHeight: 1.5, fontStyle: "italic", maxWidth: "46ch",
};
const row: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10, margin: "32px 0 0" };
const primary: React.CSSProperties = {
  background: "#16306B", color: "#FBF5E6", padding: "11px 18px", borderRadius: 4,
  textDecoration: "none", fontSize: 15, fontWeight: 600,
};
const secondary: React.CSSProperties = {
  border: "1px solid #DDD6C6", color: "#1C2331", padding: "11px 18px", borderRadius: 4,
  textDecoration: "none", fontSize: 15, fontWeight: 500,
};
const foot: React.CSSProperties = {
  margin: "34px 0 0", fontSize: 14, lineHeight: 1.6, color: "#6B7280", maxWidth: "52ch",
};
