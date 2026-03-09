-- src/db/migrations/023_create_achievements_catalog_table.sql
-- Moves achievements catalog storage from app_settings JSONB into a dedicated table.

create table if not exists achievements_catalog (
  key text primary key,
  title text not null,
  description text not null,
  icon text not null default '🏆',
  metric text not null,
  target jsonb not null,
  sort_order integer not null default 0,
  updated_by uuid null references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_achievements_catalog_sort_order
  on achievements_catalog (sort_order asc, key asc);

create or replace function migrate_achievements_catalog_from_app_settings()
returns integer
language plpgsql
as $$
declare
  inserted_count integer := 0;
begin
  if exists (select 1 from achievements_catalog limit 1) then
    return 0;
  end if;

  with source_rows as (
    select
      elem,
      ordinality as ord
    from app_settings s
    cross join lateral jsonb_array_elements(coalesce(s.achievements_catalog, '[]'::jsonb))
      with ordinality as t(elem, ordinality)
    order by s.created_at asc, ordinality asc
    limit 10000
  ),
  inserted as (
    insert into achievements_catalog (
      key,
      title,
      description,
      icon,
      metric,
      target,
      sort_order
    )
    select
      lower(regexp_replace(coalesce(nullif(trim(source_rows.elem->>'key'), ''), 'achievement_' || source_rows.ord::text), '[^a-z0-9_]+', '_', 'g')) as key,
      coalesce(nullif(trim(source_rows.elem->>'title'), ''), 'Achievement ' || source_rows.ord::text) as title,
      coalesce(nullif(trim(source_rows.elem->>'description'), ''), 'Achievement milestone.') as description,
      coalesce(nullif(trim(source_rows.elem->>'icon'), ''), '🏆') as icon,
      coalesce(nullif(trim(source_rows.elem->>'metric'), ''), 'records_total') as metric,
      coalesce(source_rows.elem->'target', '1'::jsonb) as target,
      source_rows.ord::integer - 1 as sort_order
    from source_rows
    on conflict (key) do nothing
    returning 1
  )
  select count(*)::integer into inserted_count from inserted;

  return inserted_count;
end;
$$;

select migrate_achievements_catalog_from_app_settings();

drop function if exists migrate_achievements_catalog_from_app_settings();
