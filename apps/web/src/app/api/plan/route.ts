/**
 * The panel's one write: the tutor reorders next week and it lands in the store.
 *
 * Everything else in Between is composed for her. This is the inch where she
 * pushes back, and the whole point is that pushing back is cheap and leaves a
 * trace: the reorder is stored as a NEW version beside the old one, with a
 * reason, exactly like a revision the agent decided on itself. v1 and v2 side by
 * side is the product's evidence — so this route appends, and never overwrites.
 *
 * What a reorder is allowed to be is narrow on purpose:
 *   · exactly six days, no more, no fewer;
 *   · a PERMUTATION of the days already in the plan — same kinds, same prompts,
 *     same expectations, same target items, in a different order;
 *   · `assertRevisionLegal` on top of that, because the rule that a revision may
 *     not introduce material the tutor did not set is the contract's, not this
 *     route's, and it must be the same function the agent lane calls.
 *
 * Anything else is a 400. A drag gesture is not an editor, and this endpoint
 * must not quietly become one.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "agent-core";
import {
  PLAN_DAY_SCHEMA,
  PLAN_SCHEMA,
  assertRevisionLegal,
  type Plan,
  type PlanDay,
} from "agent-core/contracts";
import { verifyInitData } from "../../../lib/telegram-initdata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASON = "Reordered by the tutor before the next lesson.";

/**
 * Two accepted shapes, because both are the honest thing for a client to send:
 * the six days themselves (what the lane is holding), or just the six original
 * day numbers in their new order (what a reorder actually is). Either way the
 * server resolves against the stored plan — the request never supplies content.
 */
const BODY_SCHEMA = z.object({
  student_id: z.string().min(1),
  initData: z.string().optional(),
  days: z.union([
    z.array(PLAN_DAY_SCHEMA).length(6),
    z.array(z.number().int().min(1).max(6)).length(6),
  ]),
});

/** Identity of a day's *material*, ignoring which slot it sits in. */
function material(day: PlanDay): string {
  return JSON.stringify([day.kind, day.prompt, day.expects, [...day.target_items].sort()]);
}

function sameMaterial(prior: PlanDay[], next: PlanDay[]): boolean {
  const a = prior.map(material).sort();
  const b = next.map(material).sort();
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = BODY_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    // Length and shape violations land here: "not exactly six days" is a schema
    // failure, not a check further down.
    const first = parsed.error.issues[0];
    return bad(`a reorder is exactly six days: ${first?.message ?? "malformed body"}`);
  }
  const body = parsed.data;

  /* ── who is asking ────────────────────────────────────────────────────── */

  const auth = verifyInitData(body.initData ?? "");
  if (auth.ok) {
    const tutorChat = store.read().tutor.chat_id;
    if (tutorChat !== null && auth.user.id !== tutorChat) {
      return bad("this panel belongs to another tutor", 403);
    }
  } else if (process.env.NODE_ENV === "production") {
    return bad(`not authenticated: ${auth.reason}`, 401);
  }
  // Below production, an unsigned request is the dev path — the same escape
  // hatch /api/brief keeps, for the same reason: a desktop browser has no
  // Telegram to sign anything, and building this lane needs one.

  /* ── what they are reordering ─────────────────────────────────────────── */

  const prior: Plan | undefined = store.latestPlan(body.student_id);
  if (!prior) {
    return bad("no week yet — the tutor hasn't sent her line", 404);
  }
  if (prior.days.length !== 6) {
    return bad(`the stored plan is ${prior.days.length} days, not six`, 409);
  }

  let reordered: PlanDay[];

  if (typeof body.days[0] === "number") {
    const order = body.days as number[];
    const byDay = new Map(prior.days.map((day) => [day.day, day]));
    if (new Set(order).size !== 6 || order.some((n) => !byDay.has(n))) {
      return bad("the order must be each of the six stored days exactly once");
    }
    reordered = order.map((n, i) => ({ ...(byDay.get(n) as PlanDay), day: i + 1 }));
  } else {
    const submitted = body.days as PlanDay[];
    if (!sameMaterial(prior.days, submitted)) {
      // The one rule this endpoint exists to enforce: a reorder moves material,
      // it does not write it. Rewriting a prompt is an edit, and an edit needs
      // the dashboard, a confirmation step, and a bigger screen.
      return bad("a reorder may not add, remove or rewrite material — only move it");
    }
    // Position is authoritative. Whatever `day` the client put on each object is
    // discarded, so a client that forgets to renumber cannot store a broken week.
    reordered = submitted.map((day, i) => ({ ...day, day: i + 1 }));
  }

  const unchanged = reordered.every(
    (day, i) => material(day) === material(prior.days[i]),
  );
  if (unchanged) {
    return bad("that is the order it is already in — nothing to save");
  }

  /* ── the contract's own rules, not this route's ───────────────────────── */

  try {
    assertRevisionLegal(prior, { days: reordered });
  } catch (cause) {
    return bad(cause instanceof Error ? cause.message : String(cause));
  }

  /* ── append, never overwrite ──────────────────────────────────────────── */

  const next = PLAN_SCHEMA.parse({
    student_id: prior.student_id,
    version: prior.version + 1,
    reason: REASON,
    created_at: new Date().toISOString(),
    days: reordered,
  });

  try {
    // `addPlan` refuses a version that already exists. A second tab that saved
    // first wins, and this one is told to re-read rather than clobber it.
    store.addPlan(next);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return bad(`${detail} Re-open the brief and reorder from the current week.`, 409);
  }

  return NextResponse.json({ plan: next, prior_version: prior.version });
}
