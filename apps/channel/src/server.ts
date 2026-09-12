/**
 * There is no `channel.start()`. Attaching the Channel to a CopilotRuntime and
 * creating the listener is what starts it — which is why teardown is wired
 * before the listener exists.
 *
 * This is the DIRECT adapter path: WE hold the Telegram token and the adapter
 * long-polls out to Telegram, so no webhook and no public URL.
 *
 * An Intelligence key is still required. `CopilotRuntime` will not construct
 * with `channels` unless `intelligence` is present — that is enforced in the
 * types, not just documented. The runtime owns the Channel lifecycle either way;
 * the adapter choice only decides who holds the *platform* credentials. There is
 * no CHANNEL_CODE here because a direct-adapter Channel has no Channel Code to
 * match — `name` is only for managed delivery.
 *
 * The HTTP server exists to satisfy a host's health check. Nothing arrives on it.
 */
import { createServer } from "node:http";
import { CopilotKitIntelligence, CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";
import { channel } from "./channel";
import { required } from "./env";

const intelligence = new CopilotKitIntelligence({
  apiKey: required("INTELLIGENCE_API_KEY"),
  apiUrl: process.env.INTELLIGENCE_API_URL,
  wsUrl: process.env.INTELLIGENCE_GATEWAY_WS_URL,
});

const runtime = new CopilotRuntime({
  agents: {}, // required even though the Channel supplies the agent
  intelligence,
  channels: [channel],
});

let teardown: (() => Promise<void>) | undefined;
const shutdown = async () => {
  await teardown?.();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

const listener = createCopilotNodeListener({ runtime, basePath: "/api/copilotkit" });
const channels = listener.channels;
const server = createServer(listener);

teardown = async () => {
  await channels.stop();
  if (server.listening) server.close();
};

await channels.ready({ timeoutMs: 30_000 });

// `ready()` is NOT proof of life — it resolves on a degraded state too. Skip
// this and you get a process that boots cleanly, serves 200s, and answers
// nothing.
const status = channels.status();
if (status.overall !== "online") {
  console.error(`\n  Channel is not online: ${JSON.stringify(status)}\n`);
  await teardown();
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`\n  ✓ Between is live on Telegram — @${process.env.TELEGRAM_BOT_USERNAME}`);
  console.log(`    long-polling; no webhook, no tunnel needed for the bot`);
  console.log(`    health check on :${port}\n`);
});
