# Signal Desk

A private, single-owner web dashboard for your KamdenAI signal webhooks. It receives signed deliveries, keeps a permanent record of every session, and gives you a trade journal and risk-sizing tool alongside it.

**Next.js 16 · Postgres · deploys to Vercel**

| Page | What it shows |
|---|---|
| **Today** | Morning timeline (research → scan → opening review → results), the ranked board with each decision, entry/stop/target, modeled morning result, and prep lists labeled *not official signals* |
| **History** | Every session received, with confirmed counts and winners/losers (losses included) |
| **Journal** | Your own broker fills, exits, fees and notes, with realized P&L. Kept separate from published records |
| **Risk sizing** | Shares from account size, risk %, entry and stop. "Size" on any confirmed row pre-fills it |
| **Event log** | Every verified delivery exactly as received |
| **Setup** | Your webhook URL, configuration checks, and sample data |

It never places broker orders.

## How it works

```text
KamdenAI ── signed POST ──▶ /api/webhook ──▶ Postgres ◀── dashboard pages (password login)
```

- **Signature check:** HMAC-SHA256 of `timestamp.rawBody`, constant-time compare, 5-minute replay window. Without `KAMDENAI_SIGNING_SECRET` every delivery is rejected.
- **Idempotent:** a repeated `X-KamdenAI-Delivery` id returns `200 {duplicate: true}` and is never applied twice. Without the header, the body hash is used.
- **Order-independent:** events can arrive in any order or be retried. Later events fill in fields and never erase earlier ones, and a completed review stays complete.
- **Faithful to the published record:**
  - `research_watchlist` and `morning_scan` are stored as prep only and never become candidates.
  - Status comes from the payload's `statusLabel`, and raw codes are kept as they arrive.
  - A result counts as completed only when `finalized` is true with a numeric `profitPerShare`.
- **Login:** one password, and an HMAC-signed `httpOnly` cookie lasting 30 days. `proxy.ts` guards every route except `/login`, `/api/webhook` and `/api/health`. Pages and server actions check the cookie again.

## Deploy (Vercel + Neon)

1. **Database:** create a free Postgres database on [Neon](https://neon.tech) and copy the **pooled** connection string.
2. **Run migrations** from your machine:
   ```bash
   cd platform
   npm install
   DATABASE_URL="postgres://…" npm run db:migrate
   ```
3. **Vercel:**
   - Import this repo and set **Root Directory** to `platform`.
   - Add these environment variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled connection string |
   | `KAMDENAI_SIGNING_SECRET` | from KamdenAI → Developer webhooks |
   | `DASHBOARD_PASSWORD` | a long password you'll log in with |
   | `SESSION_SECRET` | `openssl rand -hex 32` |

4. **Connect KamdenAI:**
   - Open `/setup` on your deployment and copy the webhook URL (`https://<your-app>.vercel.app/api/webhook`).
   - Paste it into KamdenAI and subscribe to the four events.
5. **Test it end to end** with real signatures:
   ```bash
   KAMDENAI_SIGNING_SECRET=… npm run send-samples -- https://<your-app>.vercel.app/api/webhook
   ```
   These test deliveries are tagged as sample data, so **Setup → Clear sample data** removes them.

## Local development

```bash
cd platform
npm install
cp .env.example .env.local      # fill in values; any local Postgres works
npm run db:migrate              # reads DATABASE_URL from your shell
npm run dev                     # http://localhost:3000
```

To look around without a webhook, log in and click **Load sample data**. It loads the fictional DEMO session from `samples/`.

## Tests

```bash
npm run lint                    # TypeScript
npm test                        # unit tests
TEST_DATABASE_URL=postgres://…/throwaway_db npm test   # + Postgres integration tests (wipes that DB)
```

## Layout

```text
app/api/webhook/route.ts   signed webhook receiver
app/(app)/…                dashboard pages (Today, History, Journal, Risk, Events, Setup)
app/actions.ts             login/logout, journal and sample-data server actions
lib/signature.ts           HMAC + replay window
lib/normalize.ts           payload → session/candidate patches (pure)
lib/store.ts               transactional, idempotent ingest
lib/queries.ts             reads and journal writes
lib/auth.ts                password check and session cookie
lib/risk.ts                sizing and P&L arithmetic
migrations/*.sql           schema, applied by scripts/migrate.mjs
proxy.ts                   login guard
```

> Educational software, not financial advice. Confirmed is an official published signal, not a broker fill. Modeled results exclude your own fills and costs. Signals can lose money, and several confirmed names can lose together. See [DISCLAIMER.md](../DISCLAIMER.md).
