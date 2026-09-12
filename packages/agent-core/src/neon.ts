/**
 * Server-only Neon connection factory.
 *
 * Keep the URL in the ignored root `env` file. Nothing imports this from the
 * browser bundle; the store migration will consume it from server-side code.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cached: NeonQueryFunction<false, false> | undefined;

export function hasNeonDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function neonSql(): NeonQueryFunction<false, false> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to use Neon persistence.");
  }

  cached ??= neon(databaseUrl);
  return cached;
}
