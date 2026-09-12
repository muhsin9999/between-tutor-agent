# Hosting — getting off the laptop

← [BUILD.md](BUILD.md) · [STRETCH.md](STRETCH.md)

The Neon project and first schema now exist. The remaining application-store
conversion is intentionally staged: the current demo keeps its JSON fallback
until every synchronous store call has moved to async database queries. Today
the bot runs on the laptop and the panel goes through a tunnel — the README says
so plainly, and judges run it from a clean clone anyway.

This is the plan for the moment the hackathon ends.

---

## The constraint that decides everything

**The Channels runtime needs a long-running process.** It owns a persistent
gateway connection and long-polls Telegram, so a serverless function cannot host
it — the process must stay alive between requests, not wake per request.

That single fact splits the deployment in two:

| | Needs | Goes to |
|---|---|---|
| `apps/channel` | A process that stays alive | A container host |
| `apps/web` | Request/response only | Vercel |
| State | Reachable from both | A hosted database |

Today's `.data/between.json` is the thing that breaks first: two hosts cannot
share a file on one laptop's disk.

---

## The three pieces

### 1 · The panel → Vercel · free

`apps/web` is a stock Next.js app. Import the repo, set the root directory to
`apps/web`, add the env vars, deploy. Hobby tier is free and this is exactly what
it is for.

Two things to carry over:
- `transpilePackages: ["agent-core"]` is already set, so the workspace package
  builds. Vercel needs the monorepo root install, not just `apps/web`.
- **No cron.** Hobby cron is daily-granularity, which is why `/api/tick?now=`
  exists. Nothing changes.

You also stop needing the tunnel: the Mini App URL becomes the Vercel domain, set
once in BotFather with `/myapps` → Edit Web App URL. **That alone is worth the
migration** — a `trycloudflare` URL dies with the process and has to be
re-registered every time.

### 2 · The bot → a container host · free tier

Needs: Node 22+, one always-on process, no inbound traffic required.

**Render, free web service** — no card required, 750 hours/month. The catch is
real and has to be handled: **free services spin down after ~15 minutes without
inbound HTTP**, and a spun-down long-poller receives nothing. The fix is the
health-check server already in `server.ts` plus a free external pinger
([cron-job.org](https://cron-job.org) or UptimeRobot) hitting `/` every 10
minutes. Slightly grubby, genuinely free, and it works.

**Fly.io** — a better fit technically (it is built for always-on processes and
will not spin down), but check current free-allowance terms; it has required a
payment method. If a card is acceptable, prefer it and skip the pinger.

**Railway / Koyeb** — both viable; check current free terms, which move.

Deploy `apps/channel` with `npm ci && npm run dev --workspace channel` replaced
by a real start script. Set `PORT` from the host's env — `server.ts` already
reads it.

### 3 · State → Neon Postgres · free

The JSON store has to go. `packages/agent-core/src/store.ts` is deliberately
small and its whole surface is `read()` / `update()` plus a dozen helpers, so
this is a rewrite of one file, not a refactor of the app.

**Neon** — serverless Postgres, generous free tier, no card. Reachable over HTTP
from both hosts. The project is created in `aws-eu-central-1`; its versioned
schema is [`packages/agent-core/sql/001_initial.sql`](../packages/agent-core/sql/001_initial.sql)
and local setup is documented in [`docs/NEON.md`](../docs/NEON.md). Its tables mirror `Store`:

```
students(id, name, chat_id, tutor_chat_id)
plans(student_id, version, reason, created_at, days jsonb)   -- append-only
attempts(student_id, plan_version, day, answered_at, gave, correct, error_tag)
clock(started_at, speed)
```

`plans` and `attempts` are already append-only in the JSON store, so they map
straight onto inserts. Keep `seen_updates` in Redis or a table with a TTL sweep.

**Upstash Redis** is the lighter alternative if you would rather not write SQL —
free tier, HTTP API, and the whole store serialises to one key. It is the smaller
change; Postgres is the better answer once there is more than one tutor.

---

## Order of work, when you do it

1. **Panel to Vercel first** (~15 min). Independent of everything else, and it
   kills the tunnel problem immediately.
2. **Store to Neon** (~30 min). Do this second: both hosts need it, and it is the
   only piece with real design in it.
3. **Bot to Render** (~15 min). Last, because it depends on the store being
   reachable.

Do not do them in the other order. A bot on Render still reading a local JSON
file is a bot that has forgotten every student.

---

## What it costs

Zero, on the tiers above, at demo scale. The earlier estimate was **~$0.95 for a
full demo run and ~$8/month at real usage** — and that is model calls, not
hosting. `gpt-4.1-mini` under structured outputs is the whole bill.

The one number to watch is the panel: it **recomposes on every load**, so a tutor
refreshing it ten times is ten compositions. Cache per `(student, plan version,
attempt count)` before this has real users — it is a few lines in `compose.ts`
and it removes the only unbounded cost in the system.
