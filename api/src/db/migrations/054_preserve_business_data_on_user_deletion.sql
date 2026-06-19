do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'records', 'receipts', 'budget_sheets', 'rules', 'recurring_schedules',
    'plaid_items', 'plaid_accounts', 'net_worth_items', 'net_worth_snapshots', 'receipt_jobs'
  ] loop
    execute format('alter table %I alter column user_id drop not null', table_name);
  end loop;
end $$;

create or replace function sync_resource_organization_id_from_user()
returns trigger language plpgsql as $$
begin
  if new.user_id is not null then
    select organization_id into new.organization_id from users where id = new.user_id;
    if tg_op = 'INSERT' and new.organization_id is not null and new.organization_owner_user_id is null then
      new.organization_owner_user_id := new.user_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function preserve_organization_resources_before_user_delete()
returns trigger language plpgsql as $$
begin
  update records set user_id = null where user_id = old.id and organization_id is not null;
  update receipts set user_id = null where user_id = old.id and organization_id is not null;
  update budget_sheets set user_id = null where user_id = old.id and organization_id is not null;
  update rules set user_id = null where user_id = old.id and organization_id is not null;
  update recurring_schedules set user_id = null where user_id = old.id and organization_id is not null;
  update plaid_items set user_id = null where user_id = old.id and organization_id is not null;
  update plaid_accounts set user_id = null where user_id = old.id and organization_id is not null;
  update net_worth_items set user_id = null where user_id = old.id and organization_id is not null;
  update net_worth_snapshots set user_id = null where user_id = old.id and organization_id is not null;
  update receipt_jobs set user_id = null where user_id = old.id and organization_id is not null;
  return old;
end;
$$;

drop trigger if exists trg_preserve_organization_resources_before_user_delete on users;
create trigger trg_preserve_organization_resources_before_user_delete
before delete on users for each row execute function preserve_organization_resources_before_user_delete();
