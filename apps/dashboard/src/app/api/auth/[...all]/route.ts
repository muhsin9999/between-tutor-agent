/**
 * Every Better Auth endpoint, mounted.
 *
 * Sign-in, callbacks, magic-link verification, session and sign-out all arrive
 * here. Two things this file adds on top of the stock handler:
 *
 * 1. **It degrades.** With no `DATABASE_URL` there is no auth instance, so every
 *    route answers `503` with a readable reason instead of throwing a 500 that
 *    reads like a crash.
 * 2. **`GET /api/auth/_status`.** The sign-in page is a client component and the
 *    credentials are server secrets, so the page has no other way to find out
 *    whether a session is even possible. Booleans only — no key, no secret, no
 *    connection string. Handled before delegation; Better Auth owns no route
 *    beginning with an underscore.
 */
import { authStatus, getAuth } from "@/lib/auth";

/** `pg` is a Node driver; this route must not be pushed to the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_CONFIGURED = {
  error: "auth_not_configured",
  message:
    "Sign-in is not configured on this server. DATABASE_URL is not set, so " +
    "there is nowhere to store a session. See docs/AUTH-SETUP.md.",
} as const;

async function handle(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname.endsWith("/_status")) {
    return Response.json(authStatus(), {
      headers: { "cache-control": "no-store" },
    });
  }

  const auth = getAuth();
  if (!auth) {
    return Response.json(NOT_CONFIGURED, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }

  return auth.handler(request);
}

export const GET = handle;
export const POST = handle;
