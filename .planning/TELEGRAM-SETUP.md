# Telegram setup — step by step

← [BUILD.md](BUILD.md) · this is [GATE-0.md](GATE-0.md) A2, expanded

Everything here happens **inside the Telegram app**, not in a terminal. Budget
six minutes. Do it in one sitting — half-finished is worse than not started,
because you cannot test the panel at all until `/newapp` is done.

---

## Step 0 · Find BotFather

Open Telegram → search bar → type **`BotFather`**.

Tap the one named **BotFather** with a **blue verified check** next to it. There
are impostors with similar names; the blue check is the only thing that
distinguishes them, and an impostor gets you a token that talks to their bot.

Tap **START** at the bottom if you've never used it. You'll get a long menu of
commands. Ignore it.

---

## Step 1 · Create the bot

Send:

```
/newbot
```

> **BotFather:** *Alright, a new bot. How are we going to call it? Please choose a name for your bot.*

Send the display name — this is what students see at the top of the chat:

```
Between
```

> **BotFather:** *Good. Now let's choose a username for your bot. It must end in `bot`.*

Send:

```
between_tutor_bot
```

If it says **"Sorry, this username is already taken"**, try in order:
`between_tutor_agent_bot` → `between_lessons_bot` → `between_tutorbot`.
Keep trying until one sticks — you cannot change it later.

> **BotFather:** *Done! Congratulations on your new bot… Use this token to access the HTTP API:*
> **`8123456789:AAH-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`**

### ⚠️ The token is a password

Anyone with it controls the bot. **Never commit it.** `.env` is gitignored —
that is where it goes, nowhere else:

```dotenv
TELEGRAM_BOT_TOKEN=8123456789:AAH-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Tell Claude the bot's username too** (`between_tutor_bot`) — the enrolment link
`t.me/<username>?start=<token>` is built from it.

If you ever paste it somewhere public: send `/revoke` to BotFather, pick the bot,
and it issues a new one. The old one dies immediately.

---

## Step 2 · Make it not look like a test bot

Three commands. Each one: send the command, tap **Between** in the list it shows,
then send the content. Two minutes total, and `test_bot_2` on camera undoes a lot
of polish.

```
/setuserpic
```
→ tap **Between** → send any clean square image. A letter on a solid colour is fine.

```
/setdescription
```
→ tap **Between** → send:
> Practice between lessons, with your tutor's plan.

*(This shows on the empty chat screen before a student presses START.)*

```
/setabouttext
```
→ tap **Between** → send:
> Your tutor set the week. I'll keep you company through it.

*(This shows on the bot's profile page.)*

---

## Step 3 · Register the Mini App

**You need a live tunnel URL first.** Ask Claude for the current one — it changes
every time the tunnel restarts, and registering a dead URL means doing this again.

```
/newapp
```

> **BotFather:** *Choose a bot to create the web app for:*

→ tap **Between**

> *Please send me the title…*

```
Lesson brief
```

> *Send a short description…*

```
What the week actually produced.
```

> *Now send a photo, 640x360 pixels…*

Any image at roughly that ratio. It is the card shown before the app opens.

> *Now please send me a link to your web app…*

```
https://<current-tunnel>.trycloudflare.com/panel
```

> *Send a short name (a-z, 0-9, underscores, 5-64 characters)…*

```
brief
```

> **BotFather:** *Done! Your web app is available at `t.me/between_tutor_bot/brief`*

### It will 404 right now — that is correct

The `/panel` route isn't built yet (T-A6). What matters is that the URL is
**registered**, because nothing about the panel is testable until it is. A 404
at 13:00 is fine; an unregistered app at 14:20 costs you the panel entirely.

---

## Step 4 · One tap from the chat

```
/setmenubutton
```

→ tap **Between** → BotFather asks for the URL:

```
https://<current-tunnel>.trycloudflare.com/panel
```

→ then the button label:

```
Lesson brief
```

This puts a permanent button beside the tutor's message box. **That is her entire
entry point** — she taps it five minutes before a lesson and the briefing is
there. It is also the cleanest single shot in the video.

---

## Step 5 · Two accounts, two screens

The demo needs a tutor and a student who are different people.

- **Tutor → Telegram Desktop on the laptop.** Install it, log in with your number.
- **Student → the phone.** A second Telegram account, or the other person's.

Check that the Mini App opens on Desktop too. This solves the one-phone problem
and films far better than two people crowding one handset.

---

## Done when

- [ ] The bot has a real name, photo, description and about text
- [ ] `TELEGRAM_BOT_TOKEN` is in `.env` and **not** in git
- [ ] Claude has the bot username
- [ ] `/newapp` registered against the current tunnel URL
- [ ] The menu button opens *something* — a 404 counts
- [ ] Telegram Desktop is logged in on the laptop

Then tick **A2** in [STATUS.md](STATUS.md) and the bot can go live.

---

## If something goes wrong

| Symptom | Fix |
|---|---|
| "Username is already taken" | Try another; you cannot change it later, so pick one you can say on camera |
| Token pasted somewhere public | `/revoke` → pick the bot → new token, old one dies instantly |
| Tunnel restarted, new URL | `/newapp` can't be edited — use `/setmenubutton` to repoint, and for the app itself run `/myapps` → the app → **Edit Web App URL** |
| Menu button does nothing | The URL must be **https** and publicly reachable. Check the tunnel is still up |
| Want to start over | `/deletebot` → confirm. Takes ten seconds |
