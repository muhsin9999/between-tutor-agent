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

import { useCallback, useEffect, useState } from "react";
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

/**
 * The panel asks for one student, and the reorder writes back against the same
 * one. `/api/brief` does not return the id it resolved — only the display name —
 * so the constant the page requests with is the constant the write uses. One
 * value, one place: if the panel ever learns to pick a student, both move.
 */
const STUDENT_ID = "jonas";

export default function PanelPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initData, setInitData] = useState<string>("");

  /**
   * One fetch, used twice: on open, and again after a reorder lands.
   *
   * `quiet` is the difference. On open, a failure is the whole screen — there is
   * nothing else to show. After a save, the week on screen is already the week
   * the server stored (the lane swapped to the server's own response), so a
   * failed refresh must not replace a correct panel with an error page.
   */
  const load = useCallback(async (signed: string, quiet = false) => {
    // In Telegram: POST the signed initData. In a desktop browser while
    // building: fall back to the dev GET, which is refused in production.
    try {
      const res = signed
        ? await fetch("/api/brief", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ initData: signed, student_id: STUDENT_ID }),
          })
        : await fetch(`/api/brief?student_id=${encodeURIComponent(STUDENT_ID)}`);

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json as Payload);
      setError(null);
    } catch (cause) {
      if (quiet) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();

    const signed = webApp?.initData ?? "";
    setInitData(signed);
    void load(signed);
  }, [load]);

  /**
   * The save happened; make the panel say so.
   *
   * Re-reading the brief is the honest refresh: the reorder does not only bump
   * the lane's version, it changes `plan_reason` and can change what
   * `composeBrief` puts above the lane. Updating the lane's baseline alone would
   * leave the rest of the screen describing the week before the drag.
   */
  const onPlanSaved = useCallback(() => {
    void load(initData, true);
  }, [initData, load]);

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

      <BriefRenderer
        brief={data.brief}
        planReason={data.plan_reason}
        showHeadline={false}
        // Editing is a Telegram surface. Without a signature there is nobody to
        // attribute a version to, so a desktop browser during development gets
        // the read-only lane — the same week, minus the one thing it cannot
        // honestly offer.
        editable={initData.length > 0}
        studentId={STUDENT_ID}
        initData={initData}
        onPlanSaved={onPlanSaved}
      />
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
