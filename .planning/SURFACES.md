# Surfaces — who else this product has to meet

← [BUILD.md](BUILD.md) · [AUTH.md](AUTH.md) · [HOSTING.md](HOSTING.md)

**None of this is today.** It is the map of what a real product needs, in the
order it needs it.

## The rule for adding one

> **Does this person already live somewhere, and can we meet them there?**

That is the whole premise of the product and it is also the test for every new
surface. A parent is on WhatsApp, not in a portal. A tutor is on her phone all
week and at a laptop on Monday. A school administrator is in a browser, because
that is where administration happens.

**A new surface is only justified when the person cannot be reached in one they
already use, or when the interaction is genuinely spatial.** The tutor's panel
earns its screen because comparing a week is spatial. A student practice app
earns nothing, which is why there isn't one.

---

## Built today

| Surface | Who | Why there |
|---|---|---|
| **Telegram chat** | The student | He installs nothing. Eight seconds on a bus |
| **Telegram Mini App** | The tutor | Five minutes before a lesson, on the phone already in her hand |

## Planned, with a plan

| Surface | Who | Where |
|---|---|---|
| **Browser dashboard** | The tutor, on a laptop | [STRETCH.md](STRETCH.md), [AUTH.md](AUTH.md) |

---

## 1 · The parent · **we have a claim and no code**

The README says:

> It does not message under-18s except through a parent's account.

**Nothing enforces that today.** There is no age field, no consent gate, and no
parent record — a minor who taps the enrolment link is enrolled. That is the
single largest gap between what this repo says and what it does, and it is the
first thing to close, ahead of every feature on the stretch list.

It is also a genuine product surface, not only a compliance one. The parent who
pays for the lessons currently sees nothing at all.

**What it needs**

- **A consent gate before the first question.** Enrolment asks whether the
  student is under 18. If yes, practice does not begin until a parent has
  accepted through their own Telegram chat — the link goes to the parent, not
  the child.
- **A parent record** joined to the student, holding who consented and when.
- **A weekly digest to the parent**: days practised, nothing more. Not his
  answers, not his errors, not the tutor's notes. The parent needs to know it is
  happening; reading his mistakes is the tutor's job and would break the trust
  the product runs on.
- **Withdrawal.** One message revokes consent, and practice stops that second.

**Where:** Telegram, same bot, a third role beside tutor and student. A parent
portal would be a surface nobody opens, and this is a relationship measured in
one message a week.

**Do not ship this product publicly without it.** With it, the ethical line in
the README becomes a feature worth showing.

## 2 · Tutor settings and the delete button

Once accounts are real, she needs to be able to:

- **Pause a student** — a holiday, an illness, an exam week. Today the agent
  keeps asking.
- **End a relationship** and take the data with it. A tutoring relationship ends;
  the practice history of a named minor must not outlive it.
- **Delete everything** for one student, on request, and have it actually gone.

**Where:** the browser dashboard. This is administration, and administration
belongs on a real screen with a confirmation step.

Data deletion is not a nice-to-have on a product holding minors' records. It is
the thing that determines whether this can be offered to a school at all.

## 3 · Email · the surface we do not control

Two jobs, both unglamorous, both load-bearing:

- **Magic links** for dashboard sign-in ([AUTH.md](AUTH.md)).
- **The Monday digest**, for the tutor who has not opened Telegram. One mail:
  who is quiet, who is stuck, who is ahead. Every row links into her panel.

**Where:** Resend or Postmark. It is a channel, not a surface — nobody "uses" it,
they are reached by it, which is exactly why it works for a weekly rhythm.

## 4 · The school or tutoring centre · the org above the tutor

The point at which this becomes a business rather than a tool. A language school
with eight tutors needs one place to see all of them, add and remove staff, and
hold the billing relationship.

This is the same shape as the **classes** idea already recorded: nineteen
students produce a *decision*, and eight tutors produce a different one — who is
struggling, who is carrying too many students, where the retention is leaking.

**Where:** browser, behind an org role in Better Auth. It is where multi-tenancy
stops being a correctness concern and starts being the product.

## 5 · A landing page · how a tutor finds this at all

Today there is no answer to "how does she start". It needs one page: the one line
she types, the panel she gets back, and a button that opens the bot. Nothing else.

**Where:** `apps/web`, statically rendered, same palette as the panel.
`docs/overview.html` is most of the copy already.

---

## Surfaces we deliberately do not build

| | Why not |
|---|---|
| **A student app** | The premise. A practice app is the exact thing he will not open, which is *why* the six days are empty. Building one rebuilds the failure the product exists to fix. |
| **A parent portal** | One message a week does not justify an account. Reach them where they are. |
| **A Slack app** | Students are not colleagues and will not join a workspace. Slack has no webview, so it also costs the generated panel entirely. |
| **A tutor mobile app** | She already has one: Telegram, with the Mini App inside it. A second install for the same job is a worse version of what exists. |

---

## Order, when there is time

1. **The parent consent gate.** We have made a claim; close it first.
2. **Tutor settings + delete.** Required before real students exist.
3. **The Monday digest email.** The cheapest retention mechanism in the product.
4. **Org/school.** When there is a second tutor asking.
5. **Landing page.** When there is someone to send to it.
