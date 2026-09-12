/**
 * Gate 0 · B1 — prove the model key with a REAL call.
 *
 * "I have a key with credit" is not proof. Nigerian cards have a long-running
 * decline problem on OpenAI API billing, and discovering it at 14:00 costs the
 * session. Run: node --env-file=.env scripts/prove-key.mjs
 */
const provider = (process.env.MODEL_PROVIDER || "").trim().toLowerCase() ||
  (process.env.OPENROUTER_API_KEY ? "openrouter" : "openai");

const endpoints = {
  openai: ["https://api.openai.com/v1/chat/completions", process.env.OPENAI_API_KEY],
  openrouter: ["https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY],
};

const [url, key] = endpoints[provider] ?? [];
if (!url) {
  console.error(`✗ MODEL_PROVIDER='${provider}' — this script covers openai and openrouter.`);
  process.exit(1);
}
if (!key || key.startsWith("stub-")) {
  console.error(`✗ No real key for ${provider}. Put it in .env, then run this again.`);
  process.exit(1);
}

const model = (process.env.MODEL || "gpt-5.6-sol").trim();
console.log(`→ ${provider} · ${model}`);

const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
  body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with the single word: ok" }] }),
});

const body = await res.json().catch(() => ({}));

if (!res.ok) {
  const err = body?.error ?? body;
  console.error(`✗ ${res.status} ${err?.code ?? ""} — ${err?.message ?? JSON.stringify(body).slice(0, 300)}`);
  console.error(`
Do NOT debug billing. Switch provider in .env and re-run — it is a 60-second fix:
  MODEL_PROVIDER=openrouter
  OPENROUTER_API_KEY=...
  MODEL=openai/gpt-5.6-sol`);
  process.exit(1);
}

const text = body?.choices?.[0]?.message?.content;
if (!text) {
  console.error(`✗ 200 but no content back: ${JSON.stringify(body).slice(0, 300)}`);
  process.exit(1);
}
console.log(`✓ real completion: ${JSON.stringify(text)}`);
console.log(`✓ Gate 0 · B1 PASSES — tick it in .planning/STATUS.md`);
