# Klyra News-Server

End-to-end crypto-news ingestion, enrichment and distribution stack.

![architecture](docs/architecture.svg)

---

## 1 Quick start

```bash
# 1 Clone & install
pnpm i

# 2 Run local Supabase
supabase start  # -> prints local URL & keys
cp env.example .env          # fill in keys and TG credentials

# 3 Dev server (ingestor + WS API)
pnpm run dev     # src/app.ts

# 4 LLM enrichment worker (optional)
pnpm run start:llm-worker
```

> Requires **Node 18+**, **pnpm**, **Supabase CLI**, and a Telegram account with a saved `SERVICE_SESSION`.

---

## 2 Repository layout

```
news-server/
├─ src/
│  ├─ ingestors/            # one file per platform
│  │   └─ telegram.ts       # TG → supabase.news_items
│  ├─ services/
│  │   ├─ news/
│  │   │   ├─ ingest.ts     # generic insert helper (all platforms)
│  │   │   └─ SupabaseNewsWebSocketServer.ts
│  │   └─ supabase/
│  │       └─ client.ts     # pre-configured anon + service clients
│  ├─ workers/
│  │   └─ llmEnricherSupabase.ts
│  ├─ seed/                 # typed seed lists for dev
│  │   ├─ types.ts
│  │   └─ telegram.ts
│  └─ logger/
│      └─ logger.ts
├─ supabase/
│  └─ migrations/
│      └─ 0001_create_news_schema.sql
└─ README.md
```

---

## 3 Data model (Postgres/Supabase)

### 3.1 news_sources

| column      | type        | notes |
|-------------|-------------|-------|
| id          | uuid PK     | autogen |
| platform    | text        | `telegram`, `x`, `rss`, … |
| source_uid  | text        | unique per platform (channel handle, URL…) |
| title       | text        | pretty name |
| is_active   | boolean     | ingestor sets `false` when join fails |
| creator_id  | uuid        | null = global |
| created_at  | timestamptz | default `now()` |
| updated_at  | timestamptz | auto trigger |

`UNIQUE(platform, source_uid)`

### 3.2 news_items

| column      | type         | notes |
|-------------|--------------|-------|
| id          | uuid PK      | autogen |
| source_id   | uuid FK      | → news_sources.id |
| created_at  | timestamptz  | publish/origin time |
| fetched_at  | timestamptz  | ingestion time |
| title       | text         | first 120 chars |
| body        | text         | full text |
| llm_enriched| boolean      | initially `false` |
| llm_title   | text         | ≤10 word headline |
| sentiment   | real (0-1)   | 0 bearish, 1 bullish |
| relevance   | real (0-1)   | impact on crypto |
| strength    | real (0-1)   | price-move probability |
| coins       | text[]       | tickers |
| topics      | text[]       | taxonomy keywords |
| analysis    | text         | ≤400 chars |
| raw_payload | jsonb        | untouched source msg |
| hash        | text UNIQUE  | dedupe helper |

GIN indexes on `coins`, `topics`.

### 3.3 news_source_subscriptions

Many-to-many map for user-specific feeds. (See migration for RLS.)

---

## 4 Data flow

1. **Ingestor (per platform)**
   * Reads messages from Telegram/X/rss/etc.
   * Calls `services/news/ingest.ingestRawNews()` with:

     ```ts
     {
       platform: 'telegram',
       sourceUid: 'cointelegraph',
       text: 'BTC breaks $100k – details…',
       ts: 1690000000000,
     }
     ```

   * Helper upserts `news_sources` (caching IDs) and inserts a raw row into `news_items`.

2. **LLM Enricher worker**
   * Polls for `llm_enriched = false` rows.
   * Generates digest via Gemini → updates the row in place.
   * Future: switch to Supabase Realtime instead of polling.

3. **WebSocket server**
   * Subscribes to Supabase Realtime `INSERT` events on `news_items`.
   * Broadcasts raw news instantly to connected clients.
   * Clients receive an enriched UPDATE later (optional roadmap).

Latency path: platform API → ingestor insert (≈5–20 ms) → Postgres commit → Realtime push (≈50–300 ms) → client.

---

## 5 Environment variables (`.env`)

See `env.example` for full list.

*Core*

```
PORT=3001
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
```

*Telegram*

```
TG_API_ID=…
TG_API_HASH=…
SERVICE_SESSION=…    # generated via scripts/gen-session.ts
```

*LLM*

```
GEMINI_API_KEY=…
GEMINI_MODEL=gemini-2.5-flash
```

---

## 6 Scripts & npm tasks

| script                | description |
|-----------------------|-------------|
| `pnpm dev`            | ts-watch web server + Telegram ingestor |
| `pnpm build`          | compile to `dist/` |
| `pnpm start`          | run compiled server (production) |
| `pnpm start:llm-worker`| run enrichment worker |
| `supabase db reset`   | wipe local DB |
| `supabase db push`    | apply migrations |

---

## 7 Adding a new platform

1. Create `src/ingestors/<platform>.ts`.
2. Import the generic ingest helper:

   ```ts
   import { ingestRawNews } from '../services/news/ingest';
   ```

3. Fetch content, then call:

   ```ts
   ingestRawNews({
     platform: '<platform>',
     sourceUid: '<id>',
     text: '…',
   });
   ```

4. Add a typed seed file under `src/seed/` if needed.

---

## 8 Testing

*Unit*: Jest tests can import seed lists and the ingest helper directly.

*Integration*: Run `supabase start` and point the test runner at the local DB.

---

## 9 Roadmap

- Replace enrichment polling with Realtime subscription.
* Admin UI for managing feeds & user subscriptions.
* Support additional platforms (X, RSS, Discord, YouTube).
* Metrics & alerting on ingestion latency.
* Docker-compose stack for one-command local setup.

---

© 2025 Klyra Labs

# News Server

Real-time crypto and financial news aggregation server with WebSocket support.

## Features

* Telegram channel monitoring using MTProto
* WebSocket server for real-time news delivery
* TypeScript/Node.js implementation

## Prerequisites

* Node.js ≥ 20
* Telegram API credentials

## Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Copy .env.example to .env and fill in your credentials:

   ```bash
   cp src/.env.example .env
   ```

4. Start the development server:

   ```bash
   pnpm dev
   ```

## Architecture

* `src/app.ts` - Main Express server and WebSocket setup
* `src/telegram/` - Telegram channel monitoring and message ingestion
* `src/workers/` - Background processing workers

## Environment Variables

* `PORT` - HTTP server port (default: 3001)
* `TG_API_ID` - Telegram API ID
* `TG_API_HASH` - Telegram API hash
* `SERVICE_SESSION` - Telegram service account session string

## WebSocket API

Connect to `ws://localhost:3001/ws/news` to receive real-time news updates.

Message format:

```typescript
interface NewsMessage {
  id: string;
  source: string;
  channelId?: string;
  channelTitle?: string;
  ts: number;
  text: string;
  enriched: '0' | '1';
  llmTitle?: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  relevance?: number;
  coins?: string[];
  topics?: string[];
  analysis?: string;
  strength?: number;
}

