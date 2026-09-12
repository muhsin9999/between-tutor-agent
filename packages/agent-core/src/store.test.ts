import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Plan } from "./contracts";

// Set before store.ts is evaluated — it reads BETWEEN_STORE at module load.
process.env.BETWEEN_STORE = join(mkdtempSync(join(tmpdir(), "between-")), "store.json");

const store = await import("./store");

const days = () =>
  Array.from({ length: 6 }, (_, i) => ({
    day: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
    kind: "drill" as const,
    prompt: `q${i + 1}`,
    target_items: ["gehen"],
    expects: "ging",
  }));

const plan = (version: number): Plan => ({
  student_id: "jonas",
  version,
  reason: version === 1 ? "initial plan from tutor's brief" : "two misses on the same rule",
  created_at: new Date().toISOString(),
  days: days(),
});

beforeEach(() => store.reset());

test("an absent file reads as an empty store, not a crash", () => {
  assert.deepEqual(store.read().plans, []);
  assert.equal(store.read().tutor.chat_id, null);
});

test("plans are append-only and every version is kept", () => {
  store.addPlan(plan(1));
  store.addPlan(plan(2));
  assert.equal(store.latestPlan("jonas")?.version, 2);
  assert.deepEqual(store.planHistory("jonas").map((p) => p.version), [1, 2]);
});

test("the same version cannot be written twice", () => {
  store.addPlan(plan(1));
  assert.throws(() => store.addPlan(plan(1)), /already exists/);
});

// The classic third-take killer: Telegram re-delivers an update and the bot
// posts the same message again, on camera.
test("a re-delivered update is claimed exactly once", () => {
  assert.equal(store.claimUpdate(99), true);
  assert.equal(store.claimUpdate(99), false);
  assert.equal(store.claimUpdate(100), true);
});

test("speed strings parse, and a bad one falls back rather than throwing", () => {
  assert.equal(store.msPerDay("day:40s"), 40_000);
  assert.equal(store.msPerDay("day:2m"), 120_000);
  assert.equal(store.msPerDay("day:500ms"), 500);
  assert.equal(store.msPerDay("nonsense"), 40_000);
});

test("the clock advances a day per tick of DEMO_SPEED", () => {
  store.startClock("day:40s");
  const started = Date.parse(store.read().clock.started_at);
  assert.equal(store.currentDay(new Date(started)), 1);
  assert.equal(store.currentDay(new Date(started + 40_001)), 2);
  assert.equal(store.currentDay(new Date(started + 40_000 * 5 + 1)), 6);
  // Six days is the whole week; it does not run on to seven.
  assert.equal(store.currentDay(new Date(started + 40_000 * 50)), 6);
});

test("currentDay is 0 before the clock starts", () => {
  assert.equal(store.currentDay(), 0);
});

test("dueStep returns the first unanswered day and nothing once caught up", () => {
  store.addPlan(plan(1));
  store.startClock("day:40s");
  const started = Date.parse(store.read().clock.started_at);

  assert.equal(store.dueStep("jonas", new Date(started))?.day, 1);

  store.addAttempt({
    student_id: "jonas",
    plan_version: 1,
    day: 1,
    answered_at: new Date().toISOString(),
    gave: "ging",
    correct: true,
    error_tag: null,
  });

  // Day 1 answered, day 2 not yet due.
  assert.equal(store.dueStep("jonas", new Date(started)), null);
  assert.equal(store.dueStep("jonas", new Date(started + 40_001))?.day, 2);
});

test("reset gives a clean take", () => {
  store.addPlan(plan(1));
  store.reset();
  assert.deepEqual(store.read().plans, []);
});
