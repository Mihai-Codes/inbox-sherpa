# Inbox Sherpa

Inbox Sherpa is a local-first mail intelligence system that ingests inbound email via MyMX webhooks, prioritizes what matters, and notifies you through your preferred channel (Matrix/Beeper, ntfy, Slack, Discord, Telegram, Pushover-style, or generic webhooks). The goal: you stop checking mail and only get alerts for high‑value messages.

## MVP goals
- Receive inbound email webhooks (MyMX)
- Verify webhook signatures
- Normalize/store email payloads
- Score/prioritize messages (people, AI news, waitlist acceptances, etc.)
- Send concise notifications via a pluggable notifier
- Provide rules for allow/block/unsubscribe + safety flags

## Repository layout
```
apps/
  webhook-receiver/      # Node/TS webhook endpoint
docs/
  vision.md              # Product vision + use cases
  architecture.md        # Data flow + components
  student-benefits.md    # Free programs & credits
  beta-access-email.md   # MyMX beta request email
  roadmap.md             # Next steps
```

## Quick start (dev)
```bash
cd apps/webhook-receiver
npm install
npm run dev
```

## Environment
See `.env.example` in `apps/webhook-receiver`.

## Notifications (pluggable)
Supported channels (MVP):
- **Matrix/Beeper** (recommended for local-first). Works great with [CodeBeep](https://github.com/Mihai-Codes/codebeep).
- **ntfy** (simple, free, self-hostable): https://ntfy.sh
- **Slack Incoming Webhooks**: https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks
- **Discord Webhooks**: https://docs.discord.com/developers/resources/webhook
- **Telegram Bot API**: https://telegram-bot-sdk.readme.io/reference/sendmessage
- **Generic webhook** (POST JSON)

If `MATRIX_ROOM_ID` is not set, Inbox Sherpa will auto-create a private room
using your Matrix access token and store the room ID in `MATRIX_ROOM_STORE`.

## Notes
- Webhook handler must be idempotent (same event ID can be retried).
- MyMX signature verification is required in production.
- Store secrets in env; never commit.

## References
- MyMX docs: https://mymx.dev/docs
- Webhook payload: https://mymx.dev/docs/webhook-payload
