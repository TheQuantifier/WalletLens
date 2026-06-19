alter table organizations
  add column if not exists logo_url text not null default '',
  add column if not exists default_currency text not null default 'USD',
  add column if not exists timezone text not null default 'UTC',
  add column if not exists fiscal_year_start_month integer not null default 1,
  add column if not exists subscription_status text not null default 'trial',
  add column if not exists access_expires_at timestamptz null;

update organizations
set access_expires_at = created_at + interval '14 days'
where subscription_status = 'trial' and access_expires_at is null;

alter table organizations alter column access_expires_at set default (now() + interval '14 days');

alter table organizations drop constraint if exists organizations_fiscal_year_month_check;
alter table organizations add constraint organizations_fiscal_year_month_check
  check (fiscal_year_start_month between 1 and 12);
alter table organizations drop constraint if exists organizations_subscription_status_check;
alter table organizations add constraint organizations_subscription_status_check
  check (subscription_status in ('trial', 'active', 'past_due', 'suspended', 'canceled'));

alter table organization_invitations
  add column if not exists custom_message text not null default '',
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivery_error text not null default '',
  add column if not exists sent_at timestamptz null;

alter table organization_invitations drop constraint if exists organization_invitations_delivery_status_check;
alter table organization_invitations add constraint organization_invitations_delivery_status_check
  check (delivery_status in ('pending', 'sent', 'failed'));

create table if not exists organization_member_archives (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  user_id uuid null references users(id) on delete set null,
  archived_by uuid null references users(id) on delete set null,
  member_snapshot jsonb not null default '{}'::jsonb,
  disposition text not null,
  transferred_to uuid null references users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint organization_member_archives_disposition_check
    check (disposition in ('retain', 'transfer', 'archive'))
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'records', 'receipts', 'budget_sheets', 'rules', 'recurring_schedules',
    'plaid_items', 'plaid_accounts', 'net_worth_items', 'net_worth_snapshots', 'receipt_jobs'
  ] loop
    execute format('alter table %I add column if not exists organization_id text null references organizations(id) on delete restrict', table_name);
    execute format('alter table %I add column if not exists organization_owner_user_id uuid null references users(id) on delete set null', table_name);
    execute format(
      'update %I resource set organization_id = u.organization_id from users u where resource.user_id = u.id and resource.organization_id is null',
      table_name
    );
    execute format('update %I set organization_owner_user_id = user_id where organization_id is not null and organization_owner_user_id is null', table_name);
    execute format('create index if not exists %I on %I (organization_id)', 'idx_' || table_name || '_organization_id', table_name);
  end loop;
end $$;

create or replace function sync_resource_organization_id_from_user()
returns trigger language plpgsql as $$
begin
  select organization_id into new.organization_id from users where id = new.user_id;
  if tg_op = 'INSERT' and new.organization_id is not null and new.organization_owner_user_id is null then
    new.organization_owner_user_id := new.user_id;
  end if;
  return new;
end;
$$;

create or replace function can_access_organization_resource(
  resource_user_id uuid,
  resource_organization_id text,
  actor_user_id uuid
) returns boolean language sql stable as $$
  select case
    when resource_organization_id is null then resource_user_id = actor_user_id
    else exists (
      select 1 from users actor
      where actor.id = actor_user_id
        and actor.organization_id = resource_organization_id
        and actor.role in ('org_user', 'org_admin')
    )
  end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'records', 'receipts', 'budget_sheets', 'rules', 'recurring_schedules',
    'plaid_items', 'plaid_accounts', 'net_worth_items', 'net_worth_snapshots', 'receipt_jobs'
  ] loop
    execute format('drop trigger if exists %I on %I', 'trg_' || table_name || '_organization_id', table_name);
    execute format(
      'create trigger %I before insert or update of user_id on %I for each row execute function sync_resource_organization_id_from_user()',
      'trg_' || table_name || '_organization_id', table_name
    );
  end loop;
end $$;
