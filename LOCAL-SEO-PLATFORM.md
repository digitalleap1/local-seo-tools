# Local SEO Platform — Architecture, Schema & Roadmap

This document is the analysis + plan for turning the tool suite into a BrightLocal /
Local Falcon–class platform. It is grounded in a full codebase analysis (see commit
history). **Read the "Reality check" first** — it explains what is deliverable
client-side now vs. what needs a backend.

---

## ✅ Phase 1 backend — BUILT & tested (free tier). Turn it on in ~5 min.

A real backend now ships in this repo (`/api`, `/lib`, `/db`, `vercel.json`). It is
**off by default** and the site works 100% without it; it activates when you add a
free Neon database. Everything below runs on **free** plans.

**What it adds:** saved data in a real database (businesses, keywords, scans,
schedules) + **unattended scheduled scans** that run on the server via Vercel Cron
(daily) even when no browser is open. The geo-grid tool gets a **"Save to cloud &
schedule"** button (Scheduled Scans panel) once the DB is connected.

**Setup (all free):**
1. **Create a free Neon database** → https://neon.tech (free tier). Copy the
   **pooled** connection string (looks like `postgresql://user:pass@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require`).
2. In **Vercel → your project → Settings → Environment Variables**, add:
   - `DATABASE_URL` = the Neon pooled connection string
   - `SERPER_KEY` = a free Serper.dev key (for the server-side cron scans)
   - *(optional)* `CRON_SECRET` = any random string (locks the cron endpoint to Vercel)
3. **Redeploy.** Then create the tables once: while signed in, send a POST to
   **`/api/migrate`** (e.g. browser console on your site:
   `fetch('/api/migrate',{method:'POST'}).then(r=>r.json()).then(console.log)`).
4. Open the **Geo-Grid Tracker** → Scheduled Scans → **"Save to cloud & schedule"**.
   The daily Vercel cron (`0 6 * * *`) will rescan and store results automatically.

**Verify:** `GET /api/health` returns `{configured:true, db:true}` when connected.

**Paid upgrades (add later when you want):**
- Sub-daily / more cron jobs → Vercel **Pro**.
- Higher-accuracy or higher-volume scans → **DataForSEO** (`DATAFORSEO_KEY`) or paid
  Serper/SerpAPI tiers.
- Email reports/alerts → add **Resend** (free 3k/mo) — Phase 3.

> Tested locally end-to-end against Postgres (Docker): auth, migrate, business /
> keyword / scan / schedule CRUD, and the cron engine running a due schedule,
> scanning all keywords, storing results, and rescheduling. 16/16 backend checks +
> browser cloud-sync checks passed.

---

## Reality check (read this first)

The suite is **100% static HTML on Vercel** (plus a tiny auth middleware). That shapes
what is possible:

| Capability | Possible client-side? | Needs backend? |
|---|---|---|
| Geo-grid rank tracking (real, per-coordinate) | ✅ Yes — via your **DataForSEO / SerpAPI / Serper** key, called from the browser | — |
| Heatmaps, metrics, competitor SoLV | ✅ Yes | — |
| Reports: PDF / Excel / CSV / PNG | ✅ Yes (jsPDF + SheetJS, lazy-loaded) | — |
| Scheduled scans **while a tab is open** | ✅ Yes (implemented) | — |
| **Unattended** daily/weekly scans (tab closed) | ❌ No | ✅ Vercel Cron + functions |
| Email reports / alerts | ❌ No | ✅ Resend/SendGrid + cron |
| Multi-device sync, team accounts, history forever | ❌ No (localStorage is per-browser, ~5 MB) | ✅ Neon Postgres + JWT API |
| AI insights | ⚠️ Partial (browser → OpenAI/Gemini key) | Better server-side |

**Real rank data always costs money** (DataForSEO/SerpAPI/Serper bill per query). A 7×7
grid = 49 API calls per keyword per scan. There is no free/legal way around this.

---

## What already exists (most of the "19 modules" are built tools)

| Spec module | Existing tool(s) |
|---|---|
| 1 Business Manager | `workspace.html`, `nap-checker.html`, `multi-location.html` |
| 2 Keyword Manager | **built into `geo-grid-tracker.html`**, `keyword-research.html`, `keyword-mapper.html` |
| 3 Location Manager | `service-area-mapper.html`, `multi-location.html` |
| 4 Exact GPS Rank Tracker | ✅ **`geo-grid-tracker.html` (this build)** |
| 5 Local Heatmap | ✅ **`geo-grid-tracker.html`** |
| 6 Competitor Tracking | `competitor-gap.html`, geo-grid competitors panel |
| 7 GBP Audit | `gbp-audit.html`, `gbp-categories.html`, `gbp-services.html` |
| 8 Review Monitoring | `sentiment-monitor.html`, `review-reply.html` |
| 9 Citation Audit | `citation-finder.html`, `nap-checker.html`, `niche-citations.html` |
| 10 Organic SEO Tracking | `serp-ranker.html`, `pack-tracker.html`, `gsc-analyzer.html` |
| 11 AI Insights | `ai-assistant.html`, `ai-seo-scanner.html`, `strategy-generator.html` |
| 12 Reporting | `white-label-report.html` + geo-grid PDF/Excel/CSV/PNG |
| 13 Dashboard | `dashboard.html`, `index.html` (hub), `health-monitor.html` |

So the platform is largely **already assembled** as the tool suite. The missing piece —
a deep, real geo-grid rank tracker with reports — is what this build adds.

---

## What this build delivered (geo-grid-tracker.html)

- **Unlimited keywords** — add/import/export, scan one or **all** keywords, per-keyword
  heatmaps via keyword pills, ARP shown per keyword.
- **Auto + custom area** — grid sizes 3×3 → 15×15, radius/unit, **circular grids**,
  **Preview grid**, and **per-point include/exclude** ("Select points" → click the map).
- **Real per-coordinate Google Maps rank** — `DataForSEO` (`location_coordinate`),
  `SerpAPI` (`google_maps` + `ll`), `Serper` (`/maps` + `ll`), plus demo + local-engine.
  Keys are inherited from Citation Finder (`cf_state_v1.settings.keys`) or entered here.
- **Scheduled scans** — daily/weekly/monthly, due-on-open auto-run (honest client-side).
- **Reports** — PDF (heatmap image + metrics + competitor tables, jsPDF), Excel
  (multi-sheet, SheetJS), CSV, PNG heatmap (own canvas — no tile-CORS issue), JSON.
- Backward compatible with old `gg_state_v1` scans; all prior features preserved.

---

## Database schema (Neon PostgreSQL) — for the backend phase

```sql
create extension if not exists pgcrypto;

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  role          text not null default 'admin',   -- admin | agency | client
  created_at    timestamptz not null default now()
);

create table businesses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  name          text not null,
  gbp_url       text,
  place_id      text,
  primary_cat   text,
  secondary_cats text[],
  website       text,
  phone         text,
  address       text, city text, state text, country text, postal_code text,
  latitude      double precision,
  longitude     double precision,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on businesses(user_id);

create table keywords (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  keyword     text not null,
  intent      text, category text, target_page text,
  priority    int default 3,
  tags        text[],
  status      text not null default 'active',
  notes       text,
  created_at  timestamptz not null default now()
);
create index on keywords(business_id);

create table locations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  label       text,
  country text, state text, city text, zip text, postal_code text,
  latitude double precision not null,
  longitude double precision not null,
  radius_km   numeric,
  created_at  timestamptz not null default now()
);

create table rankings (        -- one row per (keyword, point, scan)
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  keyword_id  uuid not null references keywords(id)   on delete cascade,
  scan_id     uuid not null,
  grid_row int, grid_col int,
  latitude double precision, longitude double precision,
  maps_rank int, local_pack_rank int, organic_rank int,
  visibility numeric, distance_km numeric, ranking_url text,
  source      text,                         -- dataforseo | serpapi | serper
  checked_at  timestamptz not null default now()
);
create index on rankings(keyword_id, scan_id);
create index on rankings(business_id, checked_at);

create table heatmaps (        -- scan summary / metrics
  id          uuid primary key default gen_random_uuid(),
  scan_id     uuid not null,
  business_id uuid not null references businesses(id) on delete cascade,
  keyword_id  uuid not null references keywords(id)   on delete cascade,
  grid_size int, radius_km numeric, center_lat double precision, center_lng double precision,
  arp numeric, solv int, coverage int, top3 int, top10 int,
  created_at  timestamptz not null default now()
);

create table competitors (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  scan_id     uuid,
  name text, rating numeric, review_count int, primary_cat text,
  maps_rank int, website text, address text, phone text,
  distance_km numeric, score numeric,
  captured_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  total int, new_count int, velocity numeric, avg_rating numeric,
  snapshot_at timestamptz not null default now()
);

create table citations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  directory text, status text, nap_match boolean, url text, found_at timestamptz default now()
);

create table gbp_audits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  score int, findings jsonb, audited_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text, format text, params jsonb, storage_url text, created_at timestamptz default now()
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text, entity text, entity_id uuid, meta jsonb, at timestamptz not null default now()
);

create table schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  frequency text not null,            -- daily | weekly | monthly | cron
  cron text, next_run timestamptz, last_run timestamptz,
  scan_all boolean default true, enabled boolean default true
);
```

---

## Backend folder structure (Vercel Functions + Neon)

```
/api
  /auth        login.js  refresh.js  me.js          (JWT)
  /businesses  index.js  [id].js  import.js  export.js
  /keywords    index.js  [id].js  bulk.js
  /locations   index.js  [id].js
  /rankings    scan.js   history.js                  (calls DataForSEO per point)
  /heatmaps    [scanId].js
  /competitors index.js
  /reviews     index.js
  /citations   audit.js
  /reports     generate.js                           (PDF/Excel server-side)
/cron
  daily.js  weekly.js  monthly.js                    (vercel.json "crons")
/lib
  db.js (Neon pg client)  auth.js (JWT)  serp.js (provider clients)  email.js (Resend)
/db
  schema.sql  migrations/
```

`vercel.json` cron example:
```json
{ "crons": [ { "path": "/cron/daily", "schedule": "0 6 * * *" } ] }
```

---

## Implementation roadmap (phased, each phase independently shippable)

- **Phase 0 — done:** client-side geo-grid rank tracker (this build).
- **Phase 1 — Backend foundation:** Neon DB + `schema.sql`, `/api/auth` (JWT),
  `/api/businesses`, `/api/keywords`. Migrate the geo-grid tool to read/write the API
  when logged in (fallback to localStorage offline).
- **Phase 2 — Server scans:** `/api/rankings/scan` (DataForSEO per point, stored in
  `rankings`/`heatmaps`). `/cron/*` for unattended daily/weekly/monthly scans.
- **Phase 3 — Reporting:** server-side PDF/Excel in `/api/reports`, white-label, email
  delivery (Resend), scheduled report emails.
- **Phase 4 — Competitors / Reviews / Citations / GBP:** wire the existing tools'
  logic into API endpoints writing to their tables; alerting (rank-drop/review/citation).
- **Phase 5 — AI insights & dashboard:** server AI summaries over stored history;
  agency/client dashboards and roles.

> Cost note: enabling real scans requires a DataForSEO/SerpAPI/Serper account and (for
> automation/email) a paid Vercel plan + email provider. Budget per scan accordingly.
