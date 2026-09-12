# Ship · 15:05–16:00

← [BUILD.md](BUILD.md)

**15:05 is code freeze.** Copy changes only past this point. Every hackathon loses
a submission to someone fixing one more thing at 15:52.

You already recorded a backup take at 15:00. Everything from here is an
improvement on something that already exists — which is the only reason this last
hour is calm.

## 15:05–15:25 · Film

**Shot list — two minutes, in this order:**

| # | Shot | Say |
|---|---|---|
| 1 | The tutor's phone. She types one line and puts the phone down. | "This is the only thing she types all week." |
| 2 | The student's handset — a question arrives, he taps an answer on the bus | "He installed nothing. No app, no account, no password." |
| 3 | Two wrong answers, same rule | "Twice on the same rule. That's a trigger computed in code, not a model's mood." |
| 4 | **v1 and v2 of the plan side by side, with the reason** | "The agent rewrote the rest of the week. It can't extend it, and it can't add material the tutor didn't set." |
| 5 | **The panel opens — lead on contents, not layout** | "Those are his actual wrong answers. That's the sentence he wrote on Wednesday." |
| 6 | **The quiet week, opened right beside it** | "Same code. Different week. Nobody drew either of these screens." |
| 7 | One line on the ethics | "It stops rather than escalating when someone goes quiet, and it never messages a minor except through a parent's account." |

**Say these out loud, or a judge assumes something broke:**

- **"The clock is compressed — six days in four minutes."** Don't let someone work it out.
- **"There's no chat sidebar. A chat sidebar inside a chat app would be absurd."**
- **"The model composes from seven typed components. It doesn't write code."**

Check the audio before you stop filming, and keep inside the event's limit.

## 15:25–15:40 · Writeup and repo

**The repo must be public.** The triage repo is private on purpose — do not carry
that pattern over. Then, in order:

- [ ] `npm run verify` passes
- [ ] No secrets committed: `git log -p | grep -iE "sk-|xoxb|[0-9]{8,}:AA"`
- [ ] `.env` and `.data/` are gitignored and absent from the tree
- [ ] README runs from a clean clone: the credentials needed, and **the two separate processes**
- [ ] `SUBMISSION.md` — inherited vs built-today filled in. This is an **eligibility** checkbox: the starter kit and its incident demo are inherited; the Telegram leg, the planner, the revision and the panel are today's.
- [ ] Sample data, session-only state and any stubbed auth are **labelled**. Say "state is a JSON file on disk for the demo" plainly — judges reward that and punish finding it themselves.
- [ ] The under-18 position is one line in the README. Costs nothing; ignore it and it is the first question you get asked.

**What to lead the description with:**

> Most agents wait in a chat window. A private tutor's week is fifty-five minutes
> in the room and six days of nothing. Between lives in the chat app the student
> already has, works those six days one question at a time, and rebuilds the
> tutor's pre-lesson briefing around whatever the week actually produced.

Then name what is load-bearing: **CopilotKit** — generative UI for the panel, and
the Channels engine on the Telegram leg, used deliberately without its chat
sidebar. **OpenAI** — planning, revision and composition under structured outputs.
Their count is not a criterion; their visible contribution is.

## 15:40–16:00 · Submit

Both of you watching one screen.

- [ ] Title, description, **public** repo link, video
- [ ] Social post tagging the sponsors, per the organiser's instructions
- [ ] Check the live integration **once more** before submitting
- [ ] Inspect the video and screenshots for secrets and real names
- [ ] Submitted, confirmation seen

## The four criteria, and where your evidence is

| Criterion | Point at |
|---|---|
| Core requirements & functionality | The full loop on live Telegram: one line in → six days worked → panel out |
| Innovation & theme alignment | The six dead days **are** the context. A standalone chatbox has no student to reach — he installed nothing and would not open an app |
| Technical execution & integration | Deterministic triggers in `evidence.ts`; the schema that is also the renderer's type; the silence path, where the agent stops rather than escalating |
| Usefulness & agentic experience | The tutor types one line a week. The agent changes its own plan and shows its reason. She drags the next week back |

The heaviest thing they are testing is *"would this still work in a normal chat
window?"* Your answer is the student's leg: **he never opens an app — and that
isn't decoration, it's the reason the six days were empty in the first place.**
