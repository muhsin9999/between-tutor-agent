# Gate 0 — pre-flight · 12:50–13:10 · 20 minutes

← back to [BUILD.md](BUILD.md)

**Nothing in [LANE-A](LANE-A.md) or [LANE-B](LANE-B.md) starts until every P0 here is green.**
Each of these costs an hour if you meet it cold at 14:00. They cost ten minutes now.
Run A's column and B's column **at the same time**.

Mark results in [STATUS.md](STATUS.md) as you go.

---

## A's column — the surface

### A1 · Telegram adapter spike — **8 minutes, hard stop** 🔴 P0

The starter ships `@copilotkit/channels/telegram`. If it takes a bot token
directly, the entire student leg is nearly free and CopilotKit is load-bearing.
If it only works through a managed Intelligence Channel that has no Telegram
provider, we fall back.

```bash
node -e "import('@copilotkit/channels/telegram').then(m=>console.log(Object.keys(m)))"
```

Then read the adapter's own signature:

```bash
ls node_modules/@copilotkit/channels/dist | grep -i telegram
grep -rn "botToken\|polling\|webhook" node_modules/@copilotkit/channels/dist/telegram* | head -20
```

**Done when:** you can state in one sentence which of these is true —

- **(a)** `telegram({ botToken })` works in `adapters: [...]` like the Slack example → **take it.** Student leg is Channels JSX, `<Button>` renders as an inline keyboard for free.
- **(b)** Telegram only works as a managed Channel and the Intelligence dashboard offers Telegram → take it, run `npx copilotkit@latest channels add --adapter telegram`.
- **(c)** Neither → **fall back to `grammy` long-polling**, `npm i grammy`, hand-rolled in `apps/channel/src/`. Costs ~40 min. Say so in [STATUS.md](STATUS.md) immediately and go straight to [CUTS.md](CUTS.md) — you will be dropping something.

> ⏱ **At 12:58 you stop spiking regardless of the answer.** An undecided
> transport at 13:10 is the single worst state this build can be in.

### A2 · BotFather — **4 minutes, human-only** 🔴 P0

You cannot test the panel *at all* until the Mini App URL is registered, and you
cannot get a URL without a tunnel. Do all of it in one sitting:

1. `/newbot` → **a real name and a real photo.** `test_bot_2` on camera undoes a lot of polish. Suggested: **Between** / `@between_tutor_bot`.
2. Copy the token into `.env` as `TELEGRAM_BOT_TOKEN=`.
3. Start a tunnel to the web app so you have an HTTPS URL:
   `npx localtunnel --port 3100` (or `cloudflared tunnel --url http://localhost:3100`).
4. `/newapp` → point it at `https://<tunnel>/panel`. Name it **Lesson brief**.
5. `/setmenubutton` → **Lesson brief** → the same URL. This is the tutor's one-tap entry.

**Done when:** tapping the bot's menu button on your own phone opens a page —
even a blank one. A 404 now is fine; an unregistered app at 14:20 is not.

### A3 · Telegram Desktop — **2 minutes** 🟡 P1

Install / log in to Telegram Desktop on the laptop.

**Done when:** the same Mini App URL opens on the desktop client.
This solves the one-phone problem — **tutor on the laptop, student on the handset** —
and it films far better than two people crowding one screen.

---

## B's column — the engine

### B1 · Prove the model key with a real call — **3 minutes** 🔴 P0

"I have a key with credit" **is not proof.** There is a long-running failure mode
where naira *and* Nigerian USD cards get declined by Stripe on OpenAI API billing.
Discovering it at 14:00 costs the session.

```bash
cp .env.example .env    # if you haven't
# put the real key in OPENAI_API_KEY, then:
node -e "fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+process.env.OPENAI_API_KEY},body:JSON.stringify({model:process.env.MODEL||'gpt-5.6-sol',messages:[{role:'user',content:'say ok'}]})}).then(r=>r.json()).then(j=>console.log(JSON.stringify(j).slice(0,400)))" 
```

**Done when:** you see real content back, not an `insufficient_quota`,
`billing_hard_limit_reached` or `invalid_api_key` error.

**If it fails — do not debug billing.** Switch in 60 seconds:

```dotenv
MODEL_PROVIDER=openrouter
OPENROUTER_API_KEY=...
MODEL=openai/gpt-5.6-sol
```

OpenRouter needs no card for its free tier and is reachable from Nigeria. The
starter already routes on `MODEL_PROVIDER` — no code change. A free Google key is
the second backup (`MODEL=google/...`, `GOOGLE_API_KEY`).

### B2 · Write `contracts.ts` — **12 minutes** 🔴 P0

This is the whole of Gate 0 for B. Open [CONTRACTS.md](CONTRACTS.md), transcribe it
into `packages/agent-core/src/contracts.ts` exactly, run `npm run typecheck`, commit,
and **say "contracts are in" out loud.**

**Done when:** `import { PLAN_SCHEMA, BRIEF_SCHEMA } from "agent-core/contracts"`
typechecks from both `apps/channel` and `apps/web`.

Agreeing this costs 12 minutes now. Discovering it at 14:00 costs the build.

---

## Shared — 1 minute, do it while the spike runs

```bash
grep -E "^\.env$|^\.data" .gitignore || printf '.env\n.data/\n' >> .gitignore
```

**Done when:** `git status` shows neither `.env` nor `.data/`.
Never commit real personal data to a public repo — every fixture is synthetic.

---

## Gate 0 exit criteria

Say these out loud to each other at 13:10. All five, or you are not through.

- [ ] The transport is decided — (a), (b) or (c) from A1
- [ ] The bot exists, has a real name, and the Mini App URL is registered
- [ ] A real model completion came back
- [ ] `contracts.ts` typechecks from both apps
- [ ] `.env` and `.data/` are gitignored

Then: A opens [LANE-A.md](LANE-A.md), B opens [LANE-B.md](LANE-B.md).
