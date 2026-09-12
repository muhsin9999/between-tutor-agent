/**
 * T-?? — getting a voice note's bytes off Telegram. The surface half of voice
 * answers; the thinking half is `transcribeVoice` in agent-core.
 *
 * The split matters. This file knows about `file_id`s, bot tokens and an HTTP
 * download; it does not know what a plan or a day is. agent-core knows what a
 * transcript is worth; it does not know Telegram exists. The wiring between
 * them is three lines in the message handler:
 *
 *   const note = extractVoice(message);
 *   const bytes = note && (await downloadVoice(note.fileId, token));
 *   const text = bytes && (await transcribeVoice(bytes, VOICE_FILENAME, {...}));
 *
 * and then `text` goes into `handleStudentAnswer` exactly as a typed string
 * would. There is no second grading path and there must never be one.
 *
 * Everything here fails soft and returns `null`. A student's turn is not the
 * place to throw: Telegram rate-limits, file paths expire after an hour, and
 * the poll loop is a shared resource.
 */

/** Telegram's own ceiling on a bot download. Below OpenAI's 25 MB either way. */
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

/** Telegram voice notes are always OGG/Opus. See `uploadFilename` in transcribe.ts. */
export const VOICE_FILENAME = "voice.oga";

export interface VoiceNote {
  fileId: string;
  /** Seconds, as Telegram reports it. 0 when the payload omitted it. */
  duration: number;
}

type Bag = Record<string, unknown>;

function bag(value: unknown): Bag | null {
  return typeof value === "object" && value !== null ? (value as Bag) : null;
}

/**
 * Where a raw Telegram message can be hiding.
 *
 * The Channels adapter hands `onMessage` an `IncomingMessage` — text, actor,
 * ref, and `contentParts` for media — and stashes the untouched Telegram
 * update on the identity context as `raw`. Which of those the caller has in
 * hand depends on where in the pipeline they are standing, and the type is
 * `unknown` precisely so we can accept any of them rather than force one.
 *
 * `contentParts` is deliberately NOT one of these: the adapter has already
 * downloaded the audio into a base64 data part by then, which is a different
 * (and heavier) route to the same bytes. This function is about the `file_id`,
 * which is the cheap one.
 */
function candidates(message: unknown): Bag[] {
  const root = bag(message);
  if (!root) return [];
  const found: Bag[] = [root];
  for (const key of ["raw", "message", "update", "identityContext", "ctx"]) {
    const nested = bag(root[key]);
    if (!nested) continue;
    found.push(nested);
    // identityContext.raw / update.message — one more level, then stop. Any
    // deeper and we would start finding voice notes in quoted replies, which
    // are somebody else's message and not an answer to today's question.
    for (const inner of ["raw", "message"]) {
      const deeper = bag(nested[inner]);
      if (deeper) found.push(deeper);
    }
  }
  return found;
}

function noteFrom(candidate: Bag): VoiceNote | null {
  // `voice` is the held-to-talk recording. `audio` is an attached music file —
  // accepted too, because a student who taps the paperclip instead of the mic
  // has still answered, and the transcription endpoint cannot tell them apart.
  for (const key of ["voice", "audio"]) {
    const media = bag(candidate[key]);
    if (!media) continue;
    const fileId = media["file_id"] ?? media["fileId"];
    if (typeof fileId !== "string" || !fileId) continue;
    const duration = media["duration"];
    return { fileId, duration: typeof duration === "number" ? duration : 0 };
  }
  return null;
}

/**
 * Pull a voice note off an inbound Channels message, or `null` when there
 * isn't one — which is the common case, since most messages are text.
 */
export function extractVoice(message: unknown): VoiceNote | null {
  for (const candidate of candidates(message)) {
    const note = noteFrom(candidate);
    if (note) return note;
  }
  return null;
}

/** Keep the bot token out of logs. It is a credential and errors get pasted around. */
function redact(text: string, token: string): string {
  return token ? text.split(token).join("<bot-token>") : text;
}

/**
 * Telegram downloads are two hops: `getFile` resolves a `file_id` to a path,
 * then the file endpoint serves the bytes. The path is valid for about an hour
 * and `getFile` is the only way to mint a fresh one, so neither hop is
 * cacheable and both are done here, together.
 */
export async function getVoiceFile(
  fileId: string,
  botToken: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<{ bytes: Buffer; filename: string } | null> {
  const call = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const warn = (reason: string) => console.warn(`[voice] ${redact(reason, botToken)}`);

  if (!botToken) {
    warn("TELEGRAM_BOT_TOKEN is not set; voice answers are off until it is.");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const lookup = await call(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: controller.signal },
    );
    if (!lookup.ok) {
      warn(`getFile failed: HTTP ${lookup.status}.`);
      return null;
    }
    const payload = (await lookup.json()) as {
      ok?: boolean;
      description?: string;
      result?: { file_path?: string; file_size?: number };
    };
    const filePath = payload.result?.file_path;
    if (!payload.ok || !filePath) {
      warn(`getFile returned no path: ${payload.description ?? "unknown reason"}.`);
      return null;
    }
    // Checked before the download rather than after, so an oversized file costs
    // one small request instead of twenty megabytes of transfer.
    const declared = payload.result?.file_size ?? 0;
    if (declared > MAX_DOWNLOAD_BYTES) {
      warn(`Voice note is ${(declared / 1024 / 1024).toFixed(1)} MB; too large to fetch.`);
      return null;
    }

    const download = await call(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
      signal: controller.signal,
    });
    if (!download.ok) {
      warn(`Download failed: HTTP ${download.status}.`);
      return null;
    }
    const bytes = Buffer.from(await download.arrayBuffer());
    if (bytes.byteLength === 0) {
      warn("Download returned zero bytes.");
      return null;
    }

    // The real path carries the real extension (".oga" in practice). Keeping it
    // matters because the transcription endpoint decides the format from the
    // filename — see `uploadFilename` in agent-core/transcribe.ts.
    const name = filePath.split("/").pop();
    return { bytes, filename: name && name.includes(".") ? name : VOICE_FILENAME };
  } catch (error) {
    warn(
      controller.signal.aborted
        ? `Download aborted after ${timeoutMs}ms.`
        : `Download threw: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The bytes alone, for callers that already know it is a `.oga`. */
export async function downloadVoice(
  fileId: string,
  botToken: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<Buffer | null> {
  return (await getVoiceFile(fileId, botToken, options))?.bytes ?? null;
}
