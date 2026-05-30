-- Initial Dozeage schema
-- Run before: 20260530000000_create_followups.sql

create extension if not exists "uuid-ossp";

-- ─── Waitlist ─────────────────────────────────────────────────────────────────

create table if not exists waitlist (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  created_at timestamptz not null default now()
);

-- ─── Tenants ──────────────────────────────────────────────────────────────────

create table if not exists tenants (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null,
  niche             text,
  city              text,
  description       text,
  type              text,
  owner_id          uuid        references auth.users(id) on delete set null,
  ai_system_prompt  text,
  whatsapp_phone_id text,
  whatsapp_token    text,
  razorpay_key_id   text,
  razorpay_secret   text,
  plan              text        not null default 'free',
  created_at        timestamptz not null default now()
);

-- ─── Tenant members ───────────────────────────────────────────────────────────

create table if not exists tenant_members (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null references tenants(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null default 'member',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- ─── Leads ────────────────────────────────────────────────────────────────────

create table if not exists leads (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references tenants(id) on delete cascade,
  phone            text        not null,
  name             text,
  state            text        not null default 'new'
                               check (state in ('new','engaged','qualified','converted','lost')),
  source           text        not null default 'whatsapp',
  notes            text,
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (tenant_id, phone)
);

create index if not exists leads_tenant_state_idx    on leads (tenant_id, state);
create index if not exists leads_last_activity_idx   on leads (tenant_id, last_activity_at desc);

-- ─── Conversations ────────────────────────────────────────────────────────────

create table if not exists conversations (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references tenants(id) on delete cascade,
  lead_id      uuid        not null references leads(id) on delete cascade,
  is_ai_active boolean     not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists conversations_tenant_idx on conversations (tenant_id, created_at desc);
create index if not exists conversations_lead_idx   on conversations (lead_id);

-- ─── Messages ─────────────────────────────────────────────────────────────────

create table if not exists messages (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references tenants(id) on delete cascade,
  conversation_id uuid        not null references conversations(id) on delete cascade,
  role            text        not null check (role in ('user','ai')),
  content         text        not null,
  wa_message_id   text,
  sent_at         timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages (conversation_id, sent_at);

-- ─── Orders ───────────────────────────────────────────────────────────────────

create table if not exists orders (
  id                       uuid        primary key default gen_random_uuid(),
  tenant_id                uuid        not null references tenants(id) on delete cascade,
  lead_id                  uuid        references leads(id) on delete set null,
  amount                   integer     not null,
  status                   text        not null default 'pending'
                                       check (status in ('pending','paid','failed')),
  razorpay_payment_link_id text,
  razorpay_short_url       text,
  description              text,
  created_at               timestamptz not null default now()
);

create index if not exists orders_tenant_status_idx on orders (tenant_id, status);

-- ─── Products ─────────────────────────────────────────────────────────────────

create table if not exists products (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references tenants(id) on delete cascade,
  name        text        not null,
  description text,
  price       numeric(10,2),
  category    text,
  created_at  timestamptz not null default now()
);

create index if not exists products_tenant_idx on products (tenant_id);
