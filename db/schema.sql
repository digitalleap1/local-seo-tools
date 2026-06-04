create extension if not exists pgcrypto;

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'admin',
  name text not null,
  gbp_url text, place_id text,
  primary_cat text, secondary_cats text[],
  website text, phone text,
  address text, city text, state text, country text, postal_code text,
  latitude double precision, longitude double precision,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_businesses_owner on businesses(owner);

create table if not exists keywords (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  owner text not null default 'admin',
  keyword text not null,
  intent text, category text, target_page text,
  priority int default 3, tags text[],
  status text not null default 'active', notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_keywords_biz on keywords(business_id);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  owner text not null default 'admin',
  label text, country text, state text, city text, zip text, postal_code text,
  latitude double precision not null, longitude double precision not null,
  radius_km numeric, created_at timestamptz not null default now()
);

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'admin',
  business_id uuid references businesses(id) on delete cascade,
  keyword text not null,
  center_lat double precision, center_lng double precision,
  grid int, radius numeric, unit text, circular boolean,
  source text,
  metrics jsonb, results jsonb, comps jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_scans_biz_kw on scans(business_id, keyword, created_at desc);
create index if not exists idx_scans_owner on scans(owner, created_at desc);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'admin',
  business_id uuid references businesses(id) on delete cascade,
  frequency text not null default 'weekly',         -- daily | weekly | monthly
  provider text default 'serper',                    -- serper | serpapi | dataforseo
  grid int default 5, radius numeric default 2, unit text default 'mi', circular boolean default false,
  scan_all boolean default true, enabled boolean default true,
  next_run timestamptz, last_run timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_schedules_due on schedules(enabled, next_run);

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  owner text not null default 'admin',
  business_id uuid references businesses(id) on delete cascade,
  scan_id uuid references scans(id) on delete cascade,
  name text, maps_rank int, top3_points int, captured_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  owner text, action text, entity text, entity_id uuid, meta jsonb,
  at timestamptz not null default now()
);
