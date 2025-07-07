# User-Provided Telegram Channels

This document describes how **News-Server** lets authenticated users add their own Telegram sources (public or private) and how the data is stored, secured and delivered in real-time.

---
## 1. Database changes (Migration `0003_add_private_sources.sql`)

```sql
-- news_sources table additions
is_private      BOOLEAN DEFAULT FALSE NOT NULL,
owner_user_id   UUID REFERENCES app_users(id) ON DELETE SET NULL,

-- helpful index
CREATE INDEX idx_news_sources_owner ON public.news_sources(owner_user_id);
```

*  `is_private`: **false** for seed / public channels, **true** for invite-only chats supplied by users.
*  `owner_user_id`: first user that supplied the private source. (Informational; permissions are enforced via `news_source_subscriptions`.)

---
## 2. Single Telegram client

* A single authenticated `TelegramClient` instance lives in `src/ingestors/telegram.ts` and is exported as `telegramClient`.
* All API routes **reuse** this instance; no second session is ever created.  
  (Telegram will invalidate sessions if multiple clients use the same session key.)
* An optional `p-limit(1)` guard can serialise RPC calls if you expect high write concurrency.

---
## 3. Auth middleware

`src/middleware/auth.ts` extracts a JWT from `Authorization: Bearer <token>` and attaches `req.userId`.  
It rejects the request with **401** if the token is missing or invalid.

---
## 4. Channel-management HTTP API

Base path: **`/channels`** (all routes require the auth middleware)

| Method | Path         | Body example                              | Description                             |
|--------|--------------|-------------------------------------------|-----------------------------------------|
| POST   | `/public`    | `{ "handle": "crypto_whale_alerts" }`    | Add / subscribe to a public `@handle`.  |
| POST   | `/private`   | `{ "invite": "https://t.me/+AbCdEfGh..." }` | Join invite link, mark as private.      |

### Behaviour
1. Server attempts to **join** the chat using the singleton Telegram client.
2. If successful it resolves the numeric chat **ID** and **title**.
3. Upserts a `news_sources` row (`platform='telegram'`, `source_uid=chatId`, …).
4. Upserts a row in `news_source_subscriptions` for the current user.
5. Returns JSON `{ ok: true, source_id: <chatId> }`.

The invite link is **not stored**; only the chatId and metadata remain in the DB.

---
## 5. Real-time delivery path (unchanged)

```
Telegram BOTS / Client  →  ingestRawNews()  →  LLM Enrich
                                          ↘ emitNewItem() ➟ EventEmitter ➟ WebSocket Gateway ➟ Browser
```

* Once the chat is joined, the existing ingestor picks up messages automatically.
* The EventEmitter fan-out and permission filtering (`ctx.sources`) ensure that **only subscribed users** receive private-source headlines.

---
## 6. Security notes

* JWT + RLS still control who can call the API and which sources are delivered.
* The gateway never ships the invite link; only numeric IDs and high-level titles are visible.
* Private rows can be audited by joining `news_sources` on `owner_user_id`.

---
## 7. Ops checklist

1. Apply migration `0003_add_private_sources.sql` (Supabase CLI or Studio).
2. Deploy the new code (includes routes & middleware).
3. No additional environment variables required.

Everything else runs as before – zero Redis, single process, instant push. 🚀 