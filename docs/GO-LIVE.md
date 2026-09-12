# Go-live — every remaining step, in order

Everything that is **not code**: consoles, URLs, and the settings that only a human
can change. Do them in this order; several depend on the one before.

**Legend:** 🔴 blocks the product · 🟡 blocks a feature · ⚪️ polish

Current state at the time of writing:

| Piece | Where | Status |
|---|---|---|
| Panel (`apps/web`) | Vercel | ✅ live, public |
| Bot (`apps/channel`) | laptop | 🔴 must move to Render |
| Dashboard (`apps/dashboard`) | laptop | 🟡 not deployed |
| Database | Neon | ✅ Better Auth tables migrated · 🔴 app tables not populated |

**The live panel URL:**
`https://between-panel-g6u7jcwlt-yungkingjayys-projects.vercel.app`

> Replace `<PANEL>` below with that, and `<BOT>` / `<DASH>` once those exist.

---

## 1 · 🔴 Populate Neon, or the hosted bot has amnesia

The bot on Render has **no disk**. `persistence.ts` uses Neon when `DATABASE_URL`
is set — and it is — so an empty database means no tutor, no students, no plans.

```bash
node --env-file=.env --import tsx scripts/migrate-json-to-neon.ts
```

**Verify rows actually landed** before trusting it:

```sql
SELECT count(*) FROM students;
SELECT count(*) FROM plans;
SELECT count(*) FROM attempts;
```

If `plans` is empty, the live panel renders nothing while the laptop still looks
fine — the most confusing failure available, because both look "working".

## 2 · 🔴 Deploy the bot to Render

Full detail in issue #12 and [HOSTING.md](../.planning/HOSTING.md). The short version:

**New → Web Service → this repo**

| | |
|---|---|
| Build | `npm ci` |
| Start | `npm run start --workspace channel` |
| Node | **22+** — the Channels launcher needs global `WebSocket` |
| Instance | Free |

Environment variables — copy from `.env`:

```
TELEGRAM_BOT_TOKEN   TELEGRAM_BOT_USERNAME   INTELLIGENCE_API_KEY
CHANNEL_CODE=between OPENAI_API_KEY          MODEL=gpt-4.1-mini
MODEL_PROVIDER=openai DATABASE_URL           DEMO_SPEED=day:40s
PUBLIC_APP_URL=<PANEL>          ← the Vercel URL, NOT the tunnel
```

### 2a · 🔴 Stop Render falling asleep

Free services spin down after ~15 minutes with no inbound HTTP, and **a sleeping
long-poller receives nothing** — the bot goes quiet and looks broken.

`server.ts` already serves a health check. Point a free pinger at it:

- [cron-job.org](https://cron-job.org) or UptimeRobot
- `GET https://<BOT>.onrender.com/` every **10 minutes**

Fly.io does not spin down, if a payment method is acceptable.

## 3 · 🔴 Repoint BotFather at the hosted panel

In Telegram, to **@BotFather**:

```
/myapps  →  Between  →  Edit Web App URL
   <PANEL>/panel
```

```
/setmenubutton  →  Between  →  <PANEL>/panel  →  Lesson brief
```

**Then the Cloudflare tunnel can die.** That is the point of all this: a
`trycloudflare` URL vanishes with its process and has to be re-registered every
single time. A Vercel domain is permanent.

> ⚠️ Do step 1 **before** this. Repointing at a panel backed by an empty database
> shows the tutor an empty week.

## 4 · 🟡 Deploy the dashboard

```bash
vercel link --project between-dashboard
vercel deploy --prod
```

Then, in the Vercel dashboard for that project, **disable Deployment Protection**
— or sign-in redirects to Vercel's own SSO before it ever reaches ours.

Environment variables:

```
DATABASE_URL           BETTER_AUTH_SECRET
BETTER_AUTH_URL=<DASH>          ← the deployed URL, not 127.0.0.1
GOOGLE_CLIENT_ID       GOOGLE_CLIENT_SECRET
RESEND_API_KEY         AUTH_EMAIL_FROM        (optional, for magic links)
```

`BETTER_AUTH_URL` **must** be the deployed origin. If it still says
`127.0.0.1:3200`, OAuth callbacks come back to a machine Google cannot reach.

## 5 · 🟡 Google Cloud Console — add the production URLs

https://console.cloud.google.com → **APIs & Services → Credentials** → your OAuth
2.0 Client ID.

**Authorised JavaScript origins** — add, keep the local one:

```
http://127.0.0.1:3200
<DASH>
```

**Authorised redirect URIs** — add, keep the local one:

```
http://127.0.0.1:3200/api/auth/callback/google
<DASH>/api/auth/callback/google
```

Save. **Propagation takes a few minutes** — a `redirect_uri_mismatch` straight
after saving usually means "wait", not "wrong".

### 5a · The OAuth consent screen

If it is still **Testing**, only accounts on the test-user list can sign in. For
a demo that is fine — add every address that will try it. To open it up:
**Publish app**, which for basic scopes needs no verification.

## 6 · 🟡 Telegram login widget

Only needed if you want *Continue with Telegram* on the dashboard, rather than
the canonical flow (sign up on the web, link Telegram from Settings).

```
/setdomain  →  Between  →  <DASH host, no scheme>
```

Telegram **silently refuses to render** the widget on an unregistered domain —
no error, just nothing. If the button is invisible, this is why.

Implementation plan: [`docs/AUTH-SETUP.md`](AUTH-SETUP.md) §4.

## 7 · ⚪️ Magic-link email

Without `RESEND_API_KEY` the link prints to the server console and the UI says
so honestly. To deliver for real: [resend.com](https://resend.com) (free tier, no
card), verify a domain, then:

```
RESEND_API_KEY=...
AUTH_EMAIL_FROM=Between <hello@yourdomain>
```

Unverified domains can only send to your own address — fine for a demo, not for
a tutor.

## 8 · ⚪️ A real domain

`between-panel-g6u7jcwlt-…vercel.app` is not a product name. A domain costs a few
pounds and changes: `PUBLIC_APP_URL`, `BETTER_AUTH_URL`, both BotFather URLs, the
Google origins and redirect URIs, and `/setdomain`.

**Do this before showing anyone, or do it much later** — never in between, because
every URL above has to move together.

---

## Final check — does the whole loop work *hosted*?

Laptop closed. Tunnel off. Then:

1. Tutor messages the bot → plan comes back ⟶ *Render + Neon + OpenAI*
2. Student answers → graded, reply arrives ⟶ *Render + Neon*
3. Two matching errors → plan revises ⟶ *the agency claim*
4. Tutor taps **Lesson brief** → panel opens with the real week ⟶ *Vercel + Neon*
5. Tutor signs in at `<DASH>` with Google → sees her roster ⟶ *Better Auth + Neon*

**Step 4 with the laptop closed is the real test.** If it works there, it is
genuinely hosted. If it only works with the laptop open, something is still
reading the local JSON file.

## Fast triage

| Symptom | Cause |
|---|---|
| Bot silent after a quiet spell | Render spun down — step 2a |
| Panel opens empty in Telegram | Neon not populated — step 1 |
| Menu button opens a dead page | BotFather still on the tunnel — step 3 |
| `redirect_uri_mismatch` | Step 5, or wait for propagation |
| Sign-in bounces to a Vercel login | Deployment Protection still on — step 4 |
| Telegram button invisible | `/setdomain` missing — step 6 |
| Panel shows a login page | Deployment Protection on the panel project |
