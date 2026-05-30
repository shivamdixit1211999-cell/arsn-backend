create table if not exists followups (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null references tenants(id) on delete cascade,
  lead_id    uuid        not null references leads(id) on delete cascade,
  message    text        not null,
  send_at    timestamptz not null,
  sent       boolean     not null default false,
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists followups_unsent_idx
  on followups (send_at) where sent = false;
