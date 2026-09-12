/**
 * The panel's only data source: a composed, validated `Brief`.
 *
 * Auth is Telegram's `initData`, posted from the Mini App and verified against
 * the bot token — see lib/telegram-initdata.ts. No session, no cookie.
 *
 * A GET with `?student_id=` and no initData is the DEV path, and it is refused
 * in production. It exists so the panel can be opened in a desktop browser while
 * building, which is the only way to iterate on seven components at any speed.
 */
import { NextResponse } from "next/server";
import { getBrief, store } from "agent-core";
import { verifyInitData } from "../../../lib/telegram-initdata";

const DEFAULT_STUDENT = "jonas";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    initData?: string;
    student_id?: string;
  };

  const auth = verifyInitData(body.initData ?? "");
  if (!auth.ok) {
    return NextResponse.json({ error: `not authenticated: ${auth.reason}` }, { status: 401 });
  }

  // She opened the panel from her own chat, so the tutor row is who she is.
  const tutorChat = store.read().tutor.chat_id;
  if (tutorChat !== null && auth.user.id !== tutorChat) {
    return NextResponse.json({ error: "this panel belongs to another tutor" }, { status: 403 });
  }

  return briefResponse(body.student_id ?? DEFAULT_STUDENT, auth.user.first_name);
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "POST signed initData" }, { status: 401 });
  }
  const url = new URL(request.url);
  return briefResponse(url.searchParams.get("student_id") ?? DEFAULT_STUDENT, "dev");
}

async function briefResponse(studentId: string, tutorName?: string) {
  const plan = store.latestPlan(studentId);
  if (!plan) {
    return NextResponse.json(
      { error: "no week yet — the tutor hasn't sent her line" },
      { status: 404 },
    );
  }

  try {
    const brief = await getBrief(studentId);
    return NextResponse.json({
      brief,
      tutor_name: tutorName,
      student: store.read().students[studentId]?.name ?? studentId,
      plan_versions: store.planHistory(studentId).map((p) => p.version),
      // PlanLane's one-sentence reason is the single most important thing in the
      // panel — it IS the agency claim. It lives on Plan, not on Brief, so the
      // page has to forward it explicitly or it never renders.
      plan_reason: plan.reason,
      day: store.currentDay(),
    });
  } catch (cause) {
    // A brief that fails validation must not render blank — that is the whole
    // "closed catalogue" claim. Fail loudly instead.
    const detail = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: `brief failed validation: ${detail}` }, { status: 500 });
  }
}
