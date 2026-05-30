create table if not exists lead_activities (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null references tenants(id) on delete cascade,
  lead_id    uuid        not null references leads(id) on delete cascade,
  type       text        not null,
  metadata   jsonb       not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx on lead_activities (lead_id, created_at desc);
create index if not exists lead_activities_tenant_idx on lead_activities (tenant_id, created_at desc);
