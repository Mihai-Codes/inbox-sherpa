# Vision

Inbox Sherpa is a personal email intelligence layer that aggregates inbound email from all providers (Gmail, iCloud, forwarded domains, Cloudflare email routing, edu addresses, etc.), scores and filters it, and sends only the most important notifications to you.

## Pain points solved
- You no longer need to check email manually.
- You won't miss critical messages from important people.
- You will be notified immediately when you get off waitlists.
- You won’t miss high‑signal AI news or project-relevant updates.

## Core outcomes
- **Priority alerts**: Only the most important items become notifications.
- **Safety**: Detect and suppress social engineering, phishing, or NSFW content.
- **Control**: Block or unsubscribe with one action.
- **Extensible**: Add new sources and routing rules without rewriting everything.

## Channels
- **Primary**: Beeper via CodeBeep (Matrix)
- **Later**: ElevenLabs voice agent for spoken alerts and daily briefing

## Ideal daily workflow
1. Mailbrain sends a morning summary (top 3–10 emails) + urgent alerts.
2. You ask: “What should I focus on today?” and get a ranked list.
3. For urgent items (waitlist acceptance, human VIP mail), you get an immediate ping.

## Non‑goals (MVP)
- Full email client replacement
- Multi-user SaaS
- Two‑way replies

## Success metrics
- Manual inbox checks reduced by >90%
- Zero misses of user‑defined “critical” emails
- Mean time to notify <60s for urgent events
