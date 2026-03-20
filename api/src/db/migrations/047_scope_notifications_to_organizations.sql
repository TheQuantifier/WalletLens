alter table notifications
  add column if not exists organization_id text null;

update notifications
set audience = 'organization',
    organization_id = coalesce(nullif(trim(organization_id), ''), 'legacy-org')
where audience = 'student';

alter table notifications
  drop constraint if exists notifications_audience_check;

alter table notifications
  add constraint notifications_audience_check
  check (audience in ('all', 'organization'));

create index if not exists idx_notifications_audience_org
  on notifications (audience, organization_id);
