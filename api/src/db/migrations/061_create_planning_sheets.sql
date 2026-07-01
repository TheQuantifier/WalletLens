create table if not exists planning_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references users(id) on delete set null,
  organization_id text null references organizations(id) on delete restrict,
  organization_owner_user_id uuid null references users(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_planning_sheets_user_id on planning_sheets (user_id);
create index if not exists idx_planning_sheets_organization_id on planning_sheets (organization_id);

drop trigger if exists trg_planning_sheets_organization_id on planning_sheets;
create trigger trg_planning_sheets_organization_id
  before insert or update of user_id on planning_sheets
  for each row execute function sync_resource_organization_id_from_user();
