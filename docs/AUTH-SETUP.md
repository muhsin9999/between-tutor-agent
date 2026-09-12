# Auth setup — the browser door

Better Auth is wired into `apps/dashboard`. This page is what to paste, where,
and how to tell that a real account was created rather than a hopeful one.

Design rationale lives in [`.planning/AUTH.md`](../.planning/AUTH.md) and
[`.planning/ONBOARDING.md`](../.planning/ONBOARDING.md). The short version:

> **Two doors, one identity.** The Telegram Mini App is already authenticated
> cryptographically, by Telegram's signed `initData` — it gets no login screen,
> ever. Better Auth opens the *other* door: a tutor at a laptop, in a browser tab
> she can bookmark. They meet at `user.telegram_user_id`.
>
> **The student never signs up.** He has no account, no email and no password.
> Nothing below touches his leg of the product.

---

## 0 · What already works with nothing configured

Worth knowing before you provision anything, because it is the thing most likely
to be mistaken for a break:

| | With no credentials set |
|---|---|
| `/` — landing page | renders |
| `/sign-in` | renders, and says **"Sign-in is not configured"** |
| Google button | disabled, and says which two variables are missing |
| Email field | disabled, same reason |
| `/app` and everything under it | **redirects to `/sign-in`** |
| `GET /api/auth/_status` | `200` with booleans |
| Any other `/api/auth/*` | `503 auth_not_configured`, with a readable reason |
| Dev server | never crashes; nothing throws at import time |

`/app` redirecting is correct, not a bug: with no database there is no session,
and "no session" is exactly the case the guard exists to catch. Set
`DATABASE_URL` and the shell comes back.

---

## 1 · The four lines

Paste into `.env` **at the repository root** — not into `apps/dashboard/`. The
dashboard's `dev` script loads the root file (`--env-file-if-exists=../../.env`).

```dotenv
DATABASE_URL=postgresql://user:password@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
BETTER_AUTH_SECRET=<32+ random bytes>
BETTER_AUTH_URL=http://127.0.0.1:3200
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

Generate the secret with either of:

```bash
npx auth secret
openssl rand -base64 32
```

Optional, and only if you want the magic link actually emailed:

```dotenv
RESEND_API_KEY=re_xxxxxxxx
AUTH_EMAIL_FROM=Between <onboarding@resend.dev>
```

Restart the dev server after editing `.env` — it is read at process start.

### What each one does if you leave it out

| Variable | Absent | Notes |
|---|---|---|
| `DATABASE_URL` | **sign-in is off entirely** | The only hard requirement. No database, nowhere to keep a session. |
| `BETTER_AUTH_SECRET` | dev: a fixed dev-only fallback is used; **production: auth stays off** | There is deliberately no production fallback — a secret committed to a public repo is not a secret. |
| `BETTER_AUTH_URL` | falls back to `PUBLIC_APP_URL`, then `http://127.0.0.1:3200` | Must match the origin of the Google redirect URI exactly. |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Google button renders disabled and says so | Both or neither. Magic link still works. |
| `RESEND_API_KEY` | link is **printed to the server console**, not emailed | The UI says "Check the server console", not "Check your email". The link itself is real and works. |

---

## 2 · The database

Better Auth owns four tables in the **same** Neon database as the rest of the
product: `user`, `session`, `account`, `verification`. None of them collides with
a table the agent owns. It also adds the one column that makes the two doors one
identity:

```sql
-- on Better Auth's own "user" table
telegram_user_id TEXT UNIQUE   -- nullable
```

Declared in `apps/dashboard/src/lib/auth.ts` as `user.additionalFields`. Two
choices there are deliberate:

- **`input: false`** — a client can never set it during sign-up. It is written
  server-side only, after a signed, single-use, short-lived token is verified
  (ONBOARDING.md step 4). Without this, anyone who guessed a Telegram id could
  attach themselves to another tutor's students.
- **text, not bigint** — a 64-bit Telegram id does not survive JavaScript's
  53-bit number precision. `UNIQUE` on a nullable text column still permits many
  `NULL`s, so unlinked tutors are fine, and one Telegram account can back exactly
  one tutor.

Create the tables with the Better Auth CLI. The package is called `auth` — note
that the older `@better-auth/cli` is deprecated and does not match 1.7:

```bash
# print the SQL without running it
npx auth@1.7.4 generate --config apps/dashboard/src/lib/auth.ts

# create/alter the tables
npx auth@1.7.4 migrate  --config apps/dashboard/src/lib/auth.ts
```

`DATABASE_URL` must be exported in the shell for both — the CLI loads the same
config file the app does, and that file reads the environment.

---

## 3 · Google

1. <https://console.cloud.google.com/apis/credentials> → **Create credentials** →
   **OAuth client ID** → application type **Web application**.
2. **Authorised redirect URI** — paste exactly, including the path:

   ```
   http://127.0.0.1:3200/api/auth/callback/google
   ```

   For a deployment, the same path on the real origin:

   ```
   https://<your-domain>/api/auth/callback/google
   ```

   Google's loopback exception allows plain `http` for `127.0.0.1` and
   `localhost` only. Pick **one** of the two and use it everywhere —
   `BETTER_AUTH_URL`, the redirect URI and the address bar must agree, or the
   callback fails an origin check that reads as a mysterious redirect loop.
3. **Authorised JavaScript origins**: `http://127.0.0.1:3200`.
4. Copy the client ID and secret into `.env`, restart.

The path is not configurable — Better Auth mounts every provider callback at
`/api/auth/callback/<provider>` under the catch-all route in
`apps/dashboard/src/app/api/auth/[...all]/route.ts`.

---

## 4 · Telegram — deliberately not wired

**The Telegram button on `/sign-in` is a stub, and it says so when you press it.**
That is a decision, not an omission.

Better Auth ships no Telegram provider, and no generic OAuth plugin can stand in
for one, because **Telegram is not an OAuth 2 identity provider**. There is no
authorize URL to redirect to and no token endpoint to exchange against. Signing
in with Telegram means something else entirely: you embed *their* widget, and it
posts a payload back to you signed with a key derived from your bot token.

Faking that with a redirect would produce a session belonging to nobody. So the
button explains the mechanism instead.

### The integration plan, when someone picks it up

1. **BotFather `/setdomain`.** Message [@BotFather](https://t.me/BotFather) →
   `/setdomain` → choose the bot → send the exact origin, e.g.
   `http://127.0.0.1:3200` in development and `https://<your-domain>` in
   production. Without this the widget refuses to render at all — it does not
   error visibly, it simply does not appear, which costs an hour if you have not
   seen it before. One domain per bot; changing it replaces the previous one.

2. **Embed the Login Widget** on `/sign-in`, in place of the stubbed button:

   ```html
   <script async src="https://telegram.org/js/telegram-widget.js?22"
           data-telegram-login="<bot_username>"
           data-size="large"
           data-auth-url="https://<your-domain>/api/auth/telegram/callback"
           data-request-access="write"></script>
   ```

3. **Verify the callback payload server-side.** The widget sends `id`,
   `first_name`, `username`, `photo_url`, `auth_date` and `hash`. Build the
   data-check string (every field except `hash`, `k=v` sorted by key, joined with
   `\n`), HMAC-SHA256 it with `SHA256(bot_token)` as the key, compare in constant
   time, and reject an `auth_date` older than about 60 seconds.

   **Do not write this from scratch.** `apps/web/src/lib/telegram-initdata.ts`
   already does the constant-time HMAC verification for Mini App `initData`, with
   five tests including a tampered user id. The Login Widget's scheme is the same
   idea with a different data-check string; lift the verification helper rather
   than re-deriving it.

4. **Mint the session yourself.** After verification, look up or create the user
   by `telegram_user_id` and create a session through Better Auth's server API.
   This is a custom Better Auth plugin, not a social provider — the provider
   surface assumes an OAuth redirect that Telegram will never perform.

5. **Or skip step 4 entirely.** ONBOARDING.md's canonical direction is *web
   first, Telegram second*: she signs up here with Google or a magic link, then
   **links** Telegram from Settings via `t.me/<bot>?start=tutor_<signed token>`.
   That flow writes the same `telegram_user_id` column, needs no Login Widget and
   no `/setdomain`, and is the path the product is designed around. Telegram as a
   *sign-in* method is a convenience on top of it, not a prerequisite.

---

## 5 · Verifying a real account was created

Not "the page said it worked" — the row exists, or it does not.

**Before anything.** Confirm the server agrees it is configured:

```bash
curl -s http://127.0.0.1:3200/api/auth/_status
# {"configured":true,"database":true,"google":true,"magicLink":true,
#  "emailDelivery":"console","telegram":false}
```

`configured: false` means `DATABASE_URL` is missing or blank. Nothing below will
work until it is `true`.

**Magic link, end to end, with no email provider.**

1. Open <http://127.0.0.1:3200/sign-in>, type an address, press *Send me a link*.
2. The page says **"Check the server console"** — that is the honest wording for
   what actually happened. Switch to the terminal running the dev server:

   ```
   [auth] magic link (not emailed — RESEND_API_KEY is not set)
          for: amara@example.com
          url: http://127.0.0.1:3200/api/auth/magic-link/verify?token=...
   ```
3. Paste that URL into the browser. You land on `/app` — the signed-in shell,
   with your address in the rail. It is single-use: a second paste fails.

**Google.** Press *Continue with Google*, pick an account, land on `/app`.

**The row.** This is the check that matters:

```sql
select id, email, name, telegram_user_id, "createdAt"
from "user"
order by "createdAt" desc
limit 5;

select count(*) from session;
select "providerId", "accountId" from account;
```

An account created by Google shows `providerId = 'google'`. One created by magic
link has no `account` row at all — there is no credential to store, which is the
entire point of a passwordless door. `telegram_user_id` is `NULL` until the link
flow in §4.5 runs.

**The session, over HTTP:**

```bash
curl -s http://127.0.0.1:3200/api/auth/get-session --cookie "<paste from devtools>"
```

**The guard.** In a private window, open <http://127.0.0.1:3200/app>. You must
land on `/sign-in`. If the shell renders for a signed-out visitor, the guard in
`apps/dashboard/src/app/app/layout.tsx` is not doing its job — every route under
`/app` renders inside that layout, so that one redirect covers all of them.

---

## 6 · The files

| | |
|---|---|
| `apps/dashboard/src/lib/auth.ts` | Server instance. Guarded — `getAuth()` returns `null` rather than throwing when nothing is provisioned. Also exports `auth` for the CLI. |
| `apps/dashboard/src/lib/auth-client.ts` | React client: `signIn`, `signOut`, `useSession`, plus `fetchAuthStatus()`. |
| `apps/dashboard/src/app/api/auth/[...all]/route.ts` | `GET` + `POST` for every endpoint, plus `GET /api/auth/_status`. |
| `apps/dashboard/src/app/sign-in/sign-in-form.tsx` | Magic link. Real send; wording follows actual delivery. |
| `apps/dashboard/src/app/sign-in/providers.tsx` | Google (real) and Telegram (stubbed, and explicit about why). |
| `apps/dashboard/src/app/app/layout.tsx` | The session guard for every `/app` route. |

---

## 7 · Still open

- **Multi-tenancy.** Every store read is still global. Once tutors are real
  accounts, reads must be scoped by tutor — AUTH.md §5. This is where a data leak
  would live.
- **`tutor_student`.** The join table from AUTH.md is not created yet.
- **The link flow itself.** `telegram_user_id` has a column, a uniqueness
  constraint and a write policy, but nothing writes to it yet — neither
  `/link` in the bot nor the Settings button.
- **`/panel` should accept either door** — a valid session *or* valid `initData`.
  It currently accepts only `initData`, which is correct inside Telegram and
  incomplete outside it.
