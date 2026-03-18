# Inbox Sherpa

Inbox Sherpa is a local-first mail intelligence system that ingests inbound email via MyMX webhooks, prioritizes what matters, and notifies you through Beeper/CodeBeep (later: ElevenLabs voice). The goal: you stop checking mail and only get alerts for high‑value messages.

## MVP goals
- Receive inbound email webhooks (MyMX)
- Verify webhook signatures
- Normalize/store email payloads
- Score/prioritize messages (people, AI news, waitlist acceptances, etc.)
- Send concise notifications to Beeper via CodeBeep
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

## Notes
- Webhook handler must be idempotent (same event ID can be retried).
- MyMX signature verification is required in production.
- Store secrets in env; never commit.

## References
- MyMX docs: https://mymx.dev/docs
- Webhook payload: https://mymx.dev/docs/webhook-payload
