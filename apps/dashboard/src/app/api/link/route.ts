/**
 * `POST /api/link` — mint the deep link that joins the two doors.
 *
 * Returns `{ url: "https://t.me/<bot>?start=link_<token>" }` for the tutor who
 * is signed in, and nothing at all for anyone who is not.
 *
 * **The session check is the entire security model of this endpoint.** The token
 * it mints is a bearer credential that says "attach whatever Telegram account
 * taps this to user X". A mintable token without a session would let anyone ask
 * for a link bound to another tutor's id, tap it themselves, and land inside her
 * account reading a named minor's practice records. So: no session, no token,
 * 401 — and the user id comes from the verified session, never from the request
 * body, which is why this route reads no body at all.
 *
 * POST rather than GET on purpose. Minting is a side effect, it must not be
 * prefetched by a browser or a link scanner, and a GET is trivially triggered
 * cross-site.
 */
import { getSession } from "@/lib/auth";
import { linkStartPayload, mintLinkToken } from "@/lib/link-token";

/** `node:crypto` and the `pg` session lookup. Never the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

/** Read an env var, treating blank and whitespace as absent. */
function env(name: string): string | undefined {
  const trimmed = process.env[name]?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession(request.headers);
  if (!session) {
    return Response.json(
      {
        error: "unauthenticated",
        message:
          "Sign in first. A link token is bound to one tutor account, so it is " +
          "only ever minted for the tutor who asked for it.",
      },
      { status: 401, headers: NO_STORE },
    );
  }

  // BotFather usernames are sometimes pasted with the @ still attached.
  const bot = env("TELEGRAM_BOT_USERNAME")?.replace(/^@/, "");
  if (!bot) {
    return Response.json(
      {
        error: "bot_not_configured",
        message:
          "TELEGRAM_BOT_USERNAME is not set on this server, so there is no bot " +
          "to link to. See docs/AUTH-SETUP.md.",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  let token: string;
  try {
    token = mintLinkToken(session.user.id);
  } catch (error) {
    // Missing secret, or a user id too long for Telegram's 64-character
    // payload. Both are server misconfiguration; neither is the tutor's fault.
    console.error("[link] could not mint a link token:", error);
    return Response.json(
      {
        error: "link_not_configured",
        message:
          "Telegram linking is not configured on this server. " +
          "BETTER_AUTH_SECRET signs the link token.",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  return Response.json(
    { url: `https://t.me/${bot}?start=${linkStartPayload(token)}` },
    { headers: NO_STORE },
  );
}
