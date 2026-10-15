// Run explicitly with: node --env-file=.env scripts/telegram-chat-id.js
// This reads existing bot updates; it does not set webhooks or send messages.
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("Set TELEGRAM_BOT_TOKEN in your local .env first.");
  async function call(method, body = {}) {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error("Telegram rejected the request.");
    return data.result;
  }
  const webhook = await call("getWebhookInfo");
  if (webhook.url) {
    console.error("This bot already uses a webhook. Do not disable it: obtain chat.id from the existing bot integration instead.");
    process.exitCode = 1;
    return;
  }
  const updates = await call("getUpdates", { limit: 50, timeout: 0 });
  const chats = new Map();
  for (const update of updates) {
    const chat = (update.message || update.channel_post || update.edited_message)?.chat;
    if (chat) chats.set(chat.id, { id: chat.id, type: chat.type });
  }
  if (!chats.size) console.log("No chats found. Send /start and a new message to the bot, then retry. Existing polling may already have consumed the update.");
  else console.table([...chats.values()]);
}

main().catch(() => {
  // Fetch error objects can contain the URL with the token: never print them.
  console.error("Could not read chat IDs. Check the local .env token, send a message to the bot, and check for an existing polling integration. No bot settings were changed.");
  process.exitCode = 1;
});
