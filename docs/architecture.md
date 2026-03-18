# Architecture (MVP)

## Data flow
1. **Inbound email** → MX records point to MyMX.
2. **MyMX webhook** → POST JSON payload to our webhook receiver.
3. **Verification** → verify MyMX signature + timestamp.
4. **Normalization** → extract headers/body/attachments metadata.
5. **Scoring** → priority classifier + rules engine.
6. **Routing** → notify (Beeper via CodeBeep) and store summary.

## Components
- **Webhook receiver (Node/TS)**
  - MyMX signature validation
  - Idempotent event handling
  - Normalization and storage

- **Storage (MVP)**
  - SQLite (local) or JSONL
  - Tables: events, emails, rules, notifications

- **Scoring engine (MVP)**
  - Rule-based scoring (VIP senders, keyword hits, waitlist signals)
  - Safety flags (phishing / social engineering / NSFW)

- **Notification adapter**
  - Matrix/Beeper push (via Matrix REST API)
  - Later: ElevenLabs voice

## Future upgrades
- ML-based classification
- Active learning on user feedback
- Attachment OCR and entity extraction
- Auto-unsubscribe with vendor APIs or list-unsubscribe headers
