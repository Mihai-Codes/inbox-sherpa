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

if (!secret) {
  throw new Error("Missing MYMX_WEBHOOK_SECRET");
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

app.post("/webhook/mymx", (req, res) => {
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

    const record = {
      id: event.id,
      received_at: event.email.received_at,
      from: event.email.headers.from,
      subject: event.email.headers.subject,
      to: event.email.headers.to,
      body_text: event.email.parsed?.body_text || null,
      spam_score: event.email.analysis?.spamassassin?.score ?? null,
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
  console.log(`Mailbrain webhook receiver listening on :${port}`);
});
