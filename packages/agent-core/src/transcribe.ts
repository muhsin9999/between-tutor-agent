/**
 * T-?? — a spoken answer, turned into text the existing grader can read.
 *
 * This file does ONE thing: bytes in, a clean transcript out. It deliberately
 * knows nothing about plans, days, attempts or evidence. A voice note becomes a
 * string and then walks the SAME path a typed message walks —
 * `recordStudentTurn` → `gradeAttempt` → exact normalised comparison first, a
 * model only on a miss. Grading a transcript "specially" would fork the one
 * rule the whole product rests on, so it is not done here, and must not be done
 * by the caller either.
 *
 * Two things shape every decision below.
 *
 *   1. NO FFMPEG. Telegram voice notes are OGG/Opus (`.oga`) and OpenAI's
 *      transcription endpoint takes that container as-is. There is no ffmpeg on
 *      a serverless runtime, so a transcode step would not merely be slow — it
 *      would not run at all. The bytes go up exactly as they came down. (One
 *      measured caveat, about the FILENAME and not the audio: see
 *      `uploadFilename`.)
 *
 *   2. FAIL SOFT, ALWAYS. This sits in the middle of a student's chat turn. A
 *      rate limit, a cold socket or a 25 MB voice memo must never throw into the
 *      turn handler and lose his answer. Every failure path returns `null` and
 *      reports a readable reason through `onError`. That reason is NEVER
 *      returned in place of the transcript: a string coming out of this function
 *      gets graded, so "Voice note is too large" would be recorded as the
 *      student's answer to day 2.
 *
 * ── MEASURED, not assumed ────────────────────────────────────────────────────
 * Real calls against real OGG/Opus clips (3 s, German, one-word drill answers).
 * Numbers are wall-clock for the whole HTTP round trip from a laptop.
 *
 *   `.oga` sent as-is   whisper-1 200 OK · gpt-4o-transcribe and
 *                       gpt-4o-mini-transcribe both 400
 *                       "Unsupported file format oga".
 *                       So the ".oga goes straight up" claim holds for exactly
 *                       one of the three models. Renaming to `.ogg` — see
 *                       `uploadFilename`, a string edit, not a transcode —
 *                       makes all three take the identical bytes.
 *
 *   latency             Six consecutive calls on a 3 s / 23 KB clip:
 *                         gpt-4o-mini-transcribe  median 0.87 s
 *                                                 (585, 643, 785, 871, 936, 2355 ms)
 *                         whisper-1               median 1.02 s
 *                                                 (628, 742, 817, 1225, 1323, 1606 ms)
 *                       Typically the student waits under a second, with an
 *                       occasional two-second outlier on either model, plus the
 *                       Telegram download on top (not measured here — it needs
 *                       a real chat, and it is two small requests). Affordable.
 *                       The fear that killed this the first time was not.
 *
 *   accuracy            The single most important result: WITHOUT a vocabulary
 *                       hint, one-word German answers are mostly WRONG.
 *                       "ging" came back "Ding"/"Ming"; "nahm" came back
 *                       "Namm"/"numb"/"nam". A domain-only hint
 *                       ("Deutschunterricht, Präteritum") did not fix it.
 *                       Passing the WEEK's target verbs as `prompt` did: every
 *                       correct answer then transcribed exactly. See
 *                       `vocabularyHint` — voice is not usable without it.
 *
 *   the honest caveat   A learner's regularised NON-WORD ("nehmte", "sehte") is
 *                       the signal the whole evidence loop is built on, and it
 *                       is the one thing ASR is worst at: these decoders reach
 *                       for real words. "sehte" came back "Safety"; whisper-1
 *                       with a vocabulary hint dropped "nehmte" from the
 *                       transcript altogether. Reassuringly the hint never
 *                       snapped a wrong answer to the RIGHT one — no false
 *                       "correct" was manufactured — but a typed miss is worth
 *                       more than a spoken one, and the caller should treat an
 *                       incorrect voice answer as worth confirming before it
 *                       tags an error and revises a plan. (Caveat on the
 *                       caveat: those clips were text-to-speech reading a
 *                       nonsense word, which is not the same as a real student
 *                       mispronouncing one.)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** OpenAI's hard limit on an uploaded audio file. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * The reason this feature was cut once already was cost and latency, so the
 * default is the cheap end of the line and the one that measured fastest and
 * most consistently (0.6–0.9 s against whisper-1's 0.7–3.0 s). `whisper-1` and
 * `gpt-4o-transcribe` are drop-in via TRANSCRIBE_MODEL.
 */
export const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

/** The student answers in German; the hint earns real accuracy on two-second clips. */
export const DEFAULT_LANGUAGE = "de";

const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

export interface TranscribeOptions {
  /** ISO-639-1 hint. Defaults to TRANSCRIBE_LANGUAGE, then "de". */
  language?: string;
  /** Defaults to TRANSCRIBE_MODEL, then `DEFAULT_TRANSCRIBE_MODEL`. */
  model?: string;
  /** Optional domain hint ("Deutsche Verben im Präteritum"); biases short clips. */
  prompt?: string;
  apiKey?: string;
  /** Abandon the call after this long. A late transcript is a lost turn. */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Where a failure reason goes. Defaults to console.warn. Never returned. */
  onError?: (reason: string) => void;
  /** Injected for tests, mirroring the `revise` seam in evidence.ts. */
  fetchImpl?: typeof fetch;
}

/**
 * Hesitation noises. These are never an answer in any language, so they come
 * out wherever they appear: "ähm ging ähm" is the answer "ging".
 */
const HESITATIONS = new Set([
  "uh", "uhm", "um", "umm", "er", "erm", "ah", "aah", "eh", "ehm", "em", "hm",
  "mh", "hmm", "hmmm", "mhm", "mm", "mmm", "äh", "ähm", "ähem", "öh", "öhm", "hä",
]);
// Deliberately absent: "am". Whisper really does render a stalled "ähm" as
// "Am", but "am" is also ordinary German ("am Montag"), and quietly deleting a
// word a student said is worse than leaving one in that he didn't.

/**
 * Discourse openers. Unlike the noises above these ARE real words, so they are
 * stripped only where a student stalls — at the very front of the utterance.
 * "also, ging" is the answer "ging"; the same word mid-sentence is left alone.
 */
const LEADING_FILLERS = new Set([
  "also", "naja", "nagut", "tja", "okay", "ok", "so", "well", "ja",
]);

/**
 * Whisper-family models emit subtitle credits over silence or room noise — a
 * real, reproducible artefact rather than a transcription. Grading
 * "Untertitel von …" would score a miss the student never made.
 */
const SUBTITLE_ARTEFACT = /untertitel|amara\.org|subtitles? by|zdf,? \d{4}/i;

/**
 * Speech is messier than typing, and the grader is an exact comparison. This
 * closes the gap between what a person SAYS and what the same person would have
 * TYPED, and nothing more: it removes hesitation, it does not repair German.
 *
 * Lowercasing costs German noun capitalisation, which is acceptable only
 * because `normalizeAnswer` in evidence.ts lowercases before comparing anyway —
 * the transcript is never compared case-sensitively to anything.
 */
export function normalizeSpeech(raw: string): string {
  const trimmed = raw.trim().toLocaleLowerCase();
  if (!trimmed) return "";

  const words = trimmed
    .split(/\s+/)
    // Edge punctuation only. Interior punctuation is the grader's own
    // normaliser's business — it already strips it, so the two never disagree.
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((word) => word.length > 0);

  const kept: string[] = [];
  for (const word of words) {
    if (HESITATIONS.has(word)) continue;
    if (kept.length === 0 && LEADING_FILLERS.has(word)) continue;
    kept.push(word);
  }

  const cleaned = kept.join(" ");
  // Never hand back an empty string when the student clearly said SOMETHING: an
  // over-eager filler list would otherwise turn a real answer into a blank, and
  // a blank is graded as a miss.
  return cleaned || trimmed;
}

/**
 * Build the `prompt` hint from the week's target items.
 *
 * Not a nicety — measured above, one-word German answers are mostly wrong
 * without it. Two rules make it safe, and they are the point of this helper
 * existing rather than callers assembling a string:
 *
 *   1. Pass the WHOLE WEEK's target items, never today's `expects` alone.
 *      Biasing the decoder toward the one right answer is how you manufacture
 *      a correct grade out of a student who said something else. With all six
 *      verbs present the decoder still picked the one that was actually
 *      spoken, and it never turned a wrong answer into the right one.
 *   2. Items only. No "the expected answer is…", no instructions. This field
 *      is a decoding bias, not a system prompt.
 *
 * German because that is what `DEFAULT_LANGUAGE` is and the hint works in the
 * language being spoken; change both together if the subject ever changes.
 */
export function vocabularyHint(targetItems: readonly string[]): string | undefined {
  const items = [...new Set(targetItems.map((item) => item.trim()).filter(Boolean))];
  if (items.length === 0) return undefined;
  return `Deutschunterricht, Präteritum. Mögliche Antworten: ${items.join(", ")}.`;
}

/**
 * Telegram voice notes arrive as `.oga`. OpenAI documents its accepted formats
 * by extension and lists `ogg`, not `oga` — the same OGG container, the same
 * Opus payload, and the API reads the extension to decide. So the one and only
 * transformation applied to an upload is to the FILENAME. No decode, no
 * re-encode, no ffmpeg: the bytes are untouched.
 */
export function uploadFilename(filename: string): string {
  return filename.replace(/\.oga$/i, ".ogg");
}

const MIME_BY_EXTENSION: Record<string, string> = {
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  mp3: "audio/mpeg",
  mpga: "audio/mpeg",
  mpeg: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  wav: "audio/wav",
  webm: "audio/webm",
  flac: "audio/flac",
};

function mimeFor(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

function bytesOf(audio: ArrayBuffer | Buffer): Uint8Array {
  return audio instanceof ArrayBuffer
    ? new Uint8Array(audio)
    : new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength);
}

/**
 * Transcribe one voice note.
 *
 * Returns the normalised transcript, or `null` when anything at all went wrong —
 * too big, no key, a non-200, a timeout, silence. The caller's job on `null` is
 * to ask the student to type it instead; it is never to grade anything.
 */
export async function transcribeVoice(
  audio: ArrayBuffer | Buffer,
  filename: string,
  options: TranscribeOptions = {},
): Promise<string | null> {
  const report = options.onError ?? ((reason: string) => console.warn(`[transcribe] ${reason}`));

  const bytes = bytesOf(audio);
  if (bytes.byteLength === 0) {
    report("Voice note was empty; nothing to transcribe.");
    return null;
  }
  if (bytes.byteLength > MAX_AUDIO_BYTES) {
    const megabytes = (bytes.byteLength / 1024 / 1024).toFixed(1);
    report(
      `Voice note is ${megabytes} MB; the transcription API accepts at most 25 MB. ` +
        "Ask for a shorter recording — splitting the audio would need ffmpeg, which " +
        "is not available on the serverless runtime.",
    );
    return null;
  }

  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    report("OPENAI_API_KEY is not set; voice answers are off until it is.");
    return null;
  }

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeFor(filename) }), uploadFilename(filename));
  form.append("model", options.model ?? process.env.TRANSCRIBE_MODEL ?? DEFAULT_TRANSCRIBE_MODEL);
  form.append("language", options.language ?? process.env.TRANSCRIBE_LANGUAGE ?? DEFAULT_LANGUAGE);
  form.append("response_format", "json");
  // Two seconds of audio give the decoder almost nothing to go on, and any
  // creativity here becomes a wrong answer recorded against a real student.
  form.append("temperature", "0");
  if (options.prompt) form.append("prompt", options.prompt);

  // Hand-rolled rather than AbortSignal.any so the timer is always cleared and
  // this keeps working on the oldest runtime the channel might land on.
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeoutMs = options.timeoutMs ?? 20_000;
  const timer = setTimeout(abort, timeoutMs);

  try {
    const call = options.fetchImpl ?? fetch;
    const response = await call(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 400);
      report(`Transcription failed: HTTP ${response.status}. ${detail}`);
      return null;
    }

    const payload = (await response.json()) as { text?: unknown };
    const text = typeof payload.text === "string" ? payload.text : "";
    if (!text.trim()) {
      report("Transcription came back empty; the recording was probably silent.");
      return null;
    }
    if (SUBTITLE_ARTEFACT.test(text)) {
      report(`Discarded a subtitle-credit artefact from a silent clip: ${JSON.stringify(text)}`);
      return null;
    }

    const normalized = normalizeSpeech(text);
    return normalized || null;
  } catch (error) {
    report(
      controller.signal.aborted
        ? `Transcription aborted after ${timeoutMs}ms.`
        : `Transcription threw: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
