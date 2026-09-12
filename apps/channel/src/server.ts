/**
 * There is no `channel.start()`. Attaching the Channel to a CopilotRuntime and
 * creating the listener is what starts it — which is why teardown is wired
 * before the listener exists.
 *
 * This is the DIRECT adapter path, not the starter's managed one:
 * `CopilotKitIntelligence` is gone, and with it INTELLIGENCE_API_KEY and
 * CHANNEL_CODE. `intelligence` is optional on CopilotRuntime, and the Telegram
 * adapter long-polls out to Telegram rather than waiting to be dialled, so
 * nothing has to reach us. The HTTP server is only here to satisfy a host's
 * health check.
 */
import { createServer } from "node:http";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";
import { channel } from "./channel";

const runtime = new CopilotRuntime({
  agents: {}, // required even though the Channel supplies the agent
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
