/**
 * T-A6 — the tutor's panel. A Telegram Mini App, opened from the menu button.
 *
 * This is the ONLY surface in Between with a screen. The student never gets one:
 * he is on a bus with eight seconds, she is at a desk with five minutes and a
 * decision to make.
 *
 * The shape of this page is not written here. `composeBrief` picks which of the
 * seven typed components appear, in what order, holding what contents — so a
 * quiet week and an error-heavy week produce genuinely different screens from
 * the same code. Nobody drew either of them.
 */
"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import type { Brief } from "agent-core/contracts";
import { BriefRenderer } from "../../components/between";

type Payload = {
  brief: Brief;
  tutor_name?: string;
  student: string;
  plan_versions: number[];
  plan_reason: string;
  day: number;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
supports?: unknown;
      };
    };
  }
}

export default function PanelPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();

    const initData = webApp?.initData ?? "";

    // In Telegram: POST the signed initData. In a desktop browser while
    // building: fall back to the dev GET, which is refused in production.
    const request = initData
      ? fetch("/api/brief", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData }),
        })
      : fetch("/api/brief?student_id=jonas");

    request
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setData(json as Payload);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <main style={shell}>
        <p style={{ color: "#C0392B", fontSize: 15, lineHeight: 1.5 }}>{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={shell}>
        <p style={{ color: "#6b7280", fontSize: 15 }}>Reading the week…</p>
      </main>
    );
  }

  return (
    <main style={shell}>
      <header style={{ marginBottom: 28 }}>
        <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8578" }}>
          {data.student} · day {data.day} of 6
        </p>
        <h1 style={{ margin: "8px 0 0", fontSize: 22, lineHeight: 1.35, color: "#16306B", fontWeight: 600 }}>
          {data.brief.headline}
        </h1>
      </header>

      <BriefRenderer brief={data.brief} planReason={data.plan_reason} showHeadline={false} />
    </main>
  );
}

const shell: React.CSSProperties = {
  maxWidth: 560,
  margin: "0 auto",
  padding: "28px 20px 64px",
  background: "#FBF5E6",
  minHeight: "100vh",
  fontFamily:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  color: "#1f2430",
};
