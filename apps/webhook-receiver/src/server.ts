import express from "express";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { handleWebhook, MyMXWebhookError, MYMX_CONFIRMED_HEADER } from "mymx";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4567);
const secret = process.env.MYMX_WEBHOOK_SECRET || "";
const eventStorePath = process.env.EVENT_STORE || "./events.jsonl";
const rulesPath = process.env.RULES_PATH || "./rules.json";
const notifyThreshold = Number(process.env.NOTIFY_THRESHOLD || 60);
const notifier = (process.env.NOTIFIER || "matrix").toLowerCase();
const matrixHomeserver = process.env.MATRIX_HOMESERVER || "https://matrix.beeper.com";
const matrixAccessToken = process.env.MATRIX_ACCESS_TOKEN || "";
let matrixRoomId = process.env.MATRIX_ROOM_ID || "";
const matrixRoomStore = process.env.MATRIX_ROOM_STORE || "./matrix-room.json";
const matrixInviteUser = process.env.MATRIX_INVITE_USER || "";

const ntfyUrl = process.env.NTFY_URL || "https://ntfy.sh";
const ntfyTopic = process.env.NTFY_TOPIC || "";

const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || "";
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || "";

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || "";
const telegramChatId = process.env.TELEGRAM_CHAT_ID || "";

const genericWebhookUrl = process.env.WEBHOOK_NOTIFY_URL || "";

if (!secret) {
  throw new Error("Missing MYMX_WEBHOOK_SECRET");
}

type Rules = {
  vip_senders: string[];
  block_senders: string[];
  high_priority_keywords: string[];
  ai_news_keywords: string[];
  phishing_keywords: string[];
  nsfw_keywords: string[];
};

const defaultRules: Rules = {
  vip_senders: [],
  block_senders: [],
  high_priority_keywords: [],
  ai_news_keywords: [],
  phishing_keywords: [],
  nsfw_keywords: [],
};

function loadRules(): Rules {
  try {
    if (!fs.existsSync(rulesPath)) return defaultRules;
    const raw = fs.readFileSync(rulesPath, "utf8");
    const data = JSON.parse(raw);
    return { ...defaultRules, ...data };
  } catch (err) {
    console.warn("Failed to load rules.json, using defaults", err);
    return defaultRules;
  }
}

function includesAny(haystack: string, needles: string[]): string[] {
  const hits: string[] = [];
  const lower = haystack.toLowerCase();
  for (const n of needles) {
    if (!n) continue;
    if (lower.includes(n.toLowerCase())) hits.push(n);
  }
  return hits;
}

function isBlockedSender(from: string | null, rules: Rules): boolean {
  if (!from) return false;
  const lower = from.toLowerCase();
  return rules.block_senders.some((s) => lower.includes(s.toLowerCase()));
}

function isVipSender(from: string | null, rules: Rules): boolean {
  if (!from) return false;
  const lower = from.toLowerCase();
  return rules.vip_senders.some((s) => lower.includes(s.toLowerCase()));
}

function scoreEmail(subject: string | null, body: string | null, from: string | null, rules: Rules) {
  let score = 0;
  const reasons: string[] = [];
  const flags: string[] = [];

  const text = `${subject || ""}\n${body || ""}`.trim();

  if (isVipSender(from, rules)) {
    score += 50;
    reasons.push("VIP sender");
  }

  const waitlistHits = includesAny(text, ["off the waitlist", "accepted", "invitation", "you're in"]);
  if (waitlistHits.length) {
    score += 40;
    reasons.push("Waitlist/acceptance signal");
  }

  const highHits = includesAny(text, rules.high_priority_keywords);
  if (highHits.length) {
    score += Math.min(30, 10 * highHits.length);
    reasons.push(`High-priority keywords: ${highHits.slice(0, 3).join(", ")}`);
  }

  const aiHits = includesAny(text, rules.ai_news_keywords);
  if (aiHits.length) {
    score += Math.min(20, 5 * aiHits.length);
    reasons.push(`AI news keywords: ${aiHits.slice(0, 3).join(", ")}`);
  }

  const phishingHits = includesAny(text, rules.phishing_keywords);
  if (phishingHits.length) {
    flags.push("phishing");
  }

  const nsfwHits = includesAny(text, rules.nsfw_keywords);
  if (nsfwHits.length) {
    flags.push("nsfw");
  }

  return { score, reasons, flags };
}

async function sendMatrixNotification(message: string) {
  if (!matrixAccessToken) return false;
  if (!matrixRoomId) {
    const created = await ensureMatrixRoom();
    if (!created) return false;
  }
  const txnId = `inbox-sherpa-${Date.now()}`;
  const url = `${matrixHomeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
    matrixRoomId
  )}/send/m.room.message/${txnId}?access_token=${encodeURIComponent(matrixAccessToken)}`;

  const payload = {
    msgtype: "m.text",
    body: message,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return resp.ok;
}

async function sendNtfyNotification(message: string) {
  if (!ntfyTopic) return false;
  const url = `${ntfyUrl.replace(/\/$/, "")}/${encodeURIComponent(ntfyTopic)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: message,
  });
  return resp.ok;
}

async function sendSlackNotification(message: string) {
  if (!slackWebhookUrl) return false;
  const resp = await fetch(slackWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
  return resp.ok;
}

async function sendDiscordNotification(message: string) {
  if (!discordWebhookUrl) return false;
  const resp = await fetch(discordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
  return resp.ok;
}

async function sendTelegramNotification(message: string) {
  if (!telegramBotToken || !telegramChatId) return false;
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: telegramChatId, text: message }),
  });
  return resp.ok;
}

async function sendGenericWebhook(message: string) {
  if (!genericWebhookUrl) return false;
  const resp = await fetch(genericWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return resp.ok;
}

async function sendNotification(message: string) {
  switch (notifier) {
    case "matrix":
      return sendMatrixNotification(message);
    case "ntfy":
      return sendNtfyNotification(message);
    case "slack":
      return sendSlackNotification(message);
    case "discord":
      return sendDiscordNotification(message);
    case "telegram":
      return sendTelegramNotification(message);
    case "webhook":
      return sendGenericWebhook(message);
    default:
      return false;
  }
}

function loadStoredRoomId(): string | null {
  try {
    if (!fs.existsSync(matrixRoomStore)) return null;
    const raw = fs.readFileSync(matrixRoomStore, "utf8");
    const data = JSON.parse(raw);
    return typeof data.room_id === "string" ? data.room_id : null;
  } catch {
    return null;
  }
}

function saveRoomId(roomId: string) {
  ensureStoreDir(matrixRoomStore);
  fs.writeFileSync(matrixRoomStore, JSON.stringify({ room_id: roomId }, null, 2), "utf8");
}

async function ensureMatrixRoom(): Promise<boolean> {
  if (matrixRoomId) return true;
  const stored = loadStoredRoomId();
  if (stored) {
    matrixRoomId = stored;
    return true;
  }

  const url = `${matrixHomeserver}/_matrix/client/v3/createRoom?access_token=${encodeURIComponent(
    matrixAccessToken
  )}`;

  const payload = {
    name: "Inbox Sherpa Alerts",
    topic: "Priority email alerts from Inbox Sherpa",
    preset: "private_chat",
    is_direct: false,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) return false;
  const data = await resp.json();
  const roomId = data?.room_id;
  if (typeof roomId !== "string") return false;

  matrixRoomId = roomId;
  saveRoomId(roomId);

  if (matrixInviteUser) {
    await inviteMatrixUser(roomId, matrixInviteUser);
  }
  return true;
}

async function inviteMatrixUser(roomId: string, userId: string): Promise<boolean> {
  const url = `${matrixHomeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
    roomId
  )}/invite?access_token=${encodeURIComponent(matrixAccessToken)}`;
  const payload = { user_id: userId };
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return resp.ok;
}

// MyMX needs raw text body to verify signatures.
app.use(
  express.text({
    type: "*/*",
    limit: "10mb",
  })
);

function ensureStoreDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendEvent(line: string) {
  ensureStoreDir(eventStorePath);
  fs.appendFileSync(eventStorePath, line + "\n", "utf8");
}

// Idempotency in MVP: keep last 10k IDs in memory.
const seen = new Set<string>();
const seenQueue: string[] = [];
function remember(id: string) {
  if (seen.has(id)) return;
  seen.add(id);
  seenQueue.push(id);
  if (seenQueue.length > 10_000) {
    const old = seenQueue.shift();
    if (old) seen.delete(old);
  }
}

app.post("/webhook/mymx", async (req, res) => {
  const rawBody = req.body;
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v])
  );

  try {
    const event = handleWebhook({
      body: rawBody,
      headers,
      secret,
    });

    if (seen.has(event.id)) {
      return res.status(200).set(MYMX_CONFIRMED_HEADER, "true").end();
    }

    remember(event.id);

    const rules = loadRules();

    const from = event.email.headers.from;
    const subject = event.email.headers.subject;
    const bodyText = event.email.parsed?.body_text || null;

    const blocked = isBlockedSender(from, rules);
    const { score, reasons, flags } = scoreEmail(subject, bodyText, from, rules);

    let notified = false;
    if (!blocked) {
      const isVip = isVipSender(from, rules);
      const hasFlags = flags.length > 0;
      const shouldNotify = (score >= notifyThreshold && !hasFlags) || (isVip && !hasFlags);

      if (shouldNotify) {
        const summary = [
          `📬 ${subject || "(no subject)"}`,
          `From: ${from || "unknown"}`,
          `Score: ${score}`,
          reasons.length ? `Why: ${reasons.join(" | ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        notified = await sendNotification(summary);
      }
    }

    const record = {
      id: event.id,
      received_at: event.email.received_at,
      from,
      subject,
      to: event.email.headers.to,
      body_text: bodyText,
      spam_score: event.email.analysis?.spamassassin?.score ?? null,
      score,
      reasons,
      flags,
      blocked,
      notified,
      raw_event: event,
    };

    appendEvent(JSON.stringify(record));

    return res.status(200).set(MYMX_CONFIRMED_HEADER, "true").end();
  } catch (err) {
    if (err instanceof MyMXWebhookError) {
      return res.status(400).json({ error: err.code });
    }
    console.error(err);
    return res.status(500).json({ error: "internal_error" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Inbox Sherpa webhook receiver listening on :${port}`);
});
