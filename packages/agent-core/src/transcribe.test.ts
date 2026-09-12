import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_AUDIO_BYTES,
  normalizeSpeech,
  transcribeVoice,
  uploadFilename,
  vocabularyHint,
} from "./transcribe";
import { gradeAttempt } from "./evidence";
import type { PlanDay } from "./contracts";

const day2: PlanDay = {
  day: 2,
  kind: "drill",
  prompt: "past tense of sehen",
  target_items: ["sehen"],
  expects: "sah",
};

const day1: PlanDay = { ...day2, day: 1, prompt: "past tense of gehen", target_items: ["gehen"], expects: "ging" };

/** A fetch that records what it was handed and replies with a canned transcript. */
function stubFetch(text: string) {
  const calls: { url: string; form: FormData }[] = [];
  const impl = (async (url: unknown, init?: { body?: unknown }) => {
    calls.push({ url: String(url), form: init?.body as FormData });
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const KEY = { apiKey: "test-key" };

/* ── the point of the whole feature ──────────────────────────────────────── */

test("a spoken answer is graded by the same exact comparison a typed one is", async () => {
  // "um, ging" is the answer "ging" — the student got day 1 right out loud.
  const { impl } = stubFetch("Ähm, ging.");
  const transcript = await transcribeVoice(Buffer.from("audio"), "voice.oga", {
    ...KEY,
    fetchImpl: impl,
  });
  assert.equal(transcript, "ging");
  assert.equal(gradeAttempt(day1, transcript!).correct, true);
});

test("a spoken MISS stays a miss — nothing here rescues a wrong answer", async () => {
  const { impl } = stubFetch("ähm, sehte");
  const transcript = await transcribeVoice(Buffer.from("audio"), "voice.oga", {
    ...KEY,
    fetchImpl: impl,
  });
  const graded = gradeAttempt(day2, transcript!);
  assert.equal(graded.correct, false);
  // And it still earns the tag the evidence loop counts, exactly as typing it would.
  assert.equal(graded.error_tag, "strong-verb-vowel");
});

/* ── normalising speech ──────────────────────────────────────────────────── */

test("hesitation is stripped wherever it falls", () => {
  assert.equal(normalizeSpeech("Ähm, ging."), "ging");
  assert.equal(normalizeSpeech("um ging um"), "ging");
  assert.equal(normalizeSpeech("  GING  "), "ging");
  assert.equal(normalizeSpeech("er, nahm"), "nahm");
});

test("a discourse opener goes only at the front, because it is a real word", () => {
  assert.equal(normalizeSpeech("Also, ging."), "ging");
  // "so" mid-sentence is doing work; only a leading stall is filler.
  assert.equal(normalizeSpeech("es war so laut"), "es war so laut");
});

test("filler stripping never empties a real utterance", () => {
  // Everything he said is on the filler list — return it rather than a blank,
  // because a blank would be graded as a miss he did not make.
  assert.equal(normalizeSpeech("also ja"), "also ja");
  assert.equal(normalizeSpeech("ähm"), "ähm");
  assert.equal(normalizeSpeech("   "), "");
});

/* ── the .oga question, measured against the real API ────────────────────── */

test("the upload is renamed, never transcoded", () => {
  // Real result: whisper-1 accepts `.oga`; both gpt-4o transcribe models answer
  // 400 "Unsupported file format oga". Same container, same Opus bytes — the
  // API reads the extension, so the extension is the only thing that changes.
  assert.equal(uploadFilename("voice.oga"), "voice.ogg");
  assert.equal(uploadFilename("file_42.OGA"), "file_42.ogg");
  assert.equal(uploadFilename("note.ogg"), "note.ogg");
  assert.equal(uploadFilename("clip.mp3"), "clip.mp3");
});

test("the request carries the renamed file, the language hint and temperature 0", async () => {
  const { impl, calls } = stubFetch("ging");
  await transcribeVoice(Buffer.from("audio"), "voice.oga", { ...KEY, fetchImpl: impl });

  const form = calls[0]!.form;
  assert.match(calls[0]!.url, /\/v1\/audio\/transcriptions$/);
  assert.equal((form.get("file") as File).name, "voice.ogg");
  assert.equal(form.get("language"), "de");
  assert.equal(form.get("temperature"), "0");
  assert.equal(form.get("model"), "gpt-4o-mini-transcribe");
});

test("the language hint is configurable", async () => {
  const { impl, calls } = stubFetch("went");
  await transcribeVoice(Buffer.from("audio"), "voice.oga", {
    ...KEY,
    language: "en",
    model: "whisper-1",
    fetchImpl: impl,
  });
  assert.equal(calls[0]!.form.get("language"), "en");
  assert.equal(calls[0]!.form.get("model"), "whisper-1");
});

/* ── the vocabulary hint ─────────────────────────────────────────────────── */

test("the vocabulary hint carries items only, de-duplicated", () => {
  const hint = vocabularyHint(["ging", "sah", "ging", " nahm "]);
  assert.equal(hint, "Deutschunterricht, Präteritum. Mögliche Antworten: ging, sah, nahm.");
  assert.equal(vocabularyHint([]), undefined);
  assert.equal(vocabularyHint(["  "]), undefined);
});

/* ── failing soft ────────────────────────────────────────────────────────── */

test("an oversized note is refused with a clear reason and NEVER a string", async () => {
  const reasons: string[] = [];
  const { impl, calls } = stubFetch("should not be reached");
  const result = await transcribeVoice(Buffer.alloc(MAX_AUDIO_BYTES + 1), "voice.oga", {
    ...KEY,
    fetchImpl: impl,
    onError: (reason) => reasons.push(reason),
  });

  // The reason must arrive out of band. Returned, it would be graded as his answer.
  assert.equal(result, null);
  assert.equal(calls.length, 0, "an oversized file must not be uploaded at all");
  assert.match(reasons[0]!, /25 MB/);
  assert.match(reasons[0]!, /ffmpeg/);
});

test("an API error returns null instead of throwing into the student's turn", async () => {
  const reasons: string[] = [];
  const impl = (async () =>
    new Response('{"error":{"message":"Rate limit reached"}}', { status: 429 })) as typeof fetch;

  const result = await transcribeVoice(Buffer.from("audio"), "voice.oga", {
    ...KEY,
    fetchImpl: impl,
    onError: (reason) => reasons.push(reason),
  });
  assert.equal(result, null);
  assert.match(reasons[0]!, /HTTP 429/);
});

test("a thrown fetch returns null too", async () => {
  const reasons: string[] = [];
  const impl = (async () => {
    throw new Error("socket hang up");
  }) as typeof fetch;

  assert.equal(
    await transcribeVoice(Buffer.from("audio"), "voice.oga", {
      ...KEY,
      fetchImpl: impl,
      onError: (reason) => reasons.push(reason),
    }),
    null,
  );
  assert.match(reasons[0]!, /socket hang up/);
});

test("silence and its subtitle-credit artefact are both null, not an answer", async () => {
  const empty = await transcribeVoice(Buffer.from("audio"), "voice.oga", {
    ...KEY,
    fetchImpl: stubFetch("   ").impl,
    onError: () => {},
  });
  assert.equal(empty, null);

  // Whisper genuinely emits this over silence. Graded, it is a miss he never made.
  const artefact = await transcribeVoice(Buffer.from("audio"), "voice.oga", {
    ...KEY,
    fetchImpl: stubFetch("Untertitel von Stephanie Geiges").impl,
    onError: () => {},
  });
  assert.equal(artefact, null);
});

test("an empty recording and a missing key are refused before any request", async () => {
  const { impl, calls } = stubFetch("unused");
  assert.equal(
    await transcribeVoice(Buffer.alloc(0), "voice.oga", { ...KEY, fetchImpl: impl, onError: () => {} }),
    null,
  );
  assert.equal(
    await transcribeVoice(Buffer.from("audio"), "voice.oga", {
      apiKey: "",
      fetchImpl: impl,
      onError: () => {},
    }),
    null,
  );
  assert.equal(calls.length, 0);
});

test("a timeout gives up rather than holding the turn open", async () => {
  const reasons: string[] = [];
  const impl = (async (_url: unknown, init?: { signal?: AbortSignal }) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    })) as unknown as typeof fetch;

  assert.equal(
    await transcribeVoice(Buffer.from("audio"), "voice.oga", {
      ...KEY,
      timeoutMs: 10,
      fetchImpl: impl,
      onError: (reason) => reasons.push(reason),
    }),
    null,
  );
  assert.match(reasons[0]!, /aborted after 10ms/);
});

test("an ArrayBuffer and a Buffer are the same audio", async () => {
  const source = Buffer.from("audio bytes");
  const view = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);

  const fromBuffer = stubFetch("ging");
  const fromArrayBuffer = stubFetch("ging");
  await transcribeVoice(source, "voice.oga", { ...KEY, fetchImpl: fromBuffer.impl });
  await transcribeVoice(view, "voice.oga", { ...KEY, fetchImpl: fromArrayBuffer.impl });

  const sizeOf = (calls: { form: FormData }[]) => (calls[0]!.form.get("file") as File).size;
  assert.equal(sizeOf(fromBuffer.calls), source.byteLength);
  assert.equal(sizeOf(fromArrayBuffer.calls), source.byteLength);
});
