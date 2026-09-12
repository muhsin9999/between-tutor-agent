/**
 * Better Auth — the browser half.
 *
 * Talks to `/api/auth/*` in this same app, so there is no base URL to configure
 * and nothing to get wrong between environments. Creating the client is inert:
 * it opens no connection and reads no credential, so this module is safe to
 * import on a machine where nothing is provisioned yet. The *calls* are what can
 * fail, and every one of them returns `{ error }` rather than throwing.
 */
"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

import type { AuthStatus } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;

/**
 * Ask the server what is actually wired.
 *
 * The sign-in page is a client component and the credentials are server-side
 * secrets, so the page cannot read `process.env` to find out whether a session
 * is even possible. `/api/auth/_status` answers with booleans only — never a
 * key, a secret or a connection string.
 *
 * Returns `null` if the request fails, which the UI treats as "unknown" rather
 * than as "configured".
 */
export async function fetchAuthStatus(
  signal?: AbortSignal,
): Promise<AuthStatus | null> {
  try {
    const response = await fetch("/api/auth/_status", {
      cache: "no-store",
      signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as AuthStatus;
  } catch {
    return null;
  }
}
