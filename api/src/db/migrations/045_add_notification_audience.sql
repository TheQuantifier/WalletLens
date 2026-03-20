alter table notifications
  add column if not exists audience text not null default 'all';

alter table notifications
  drop constraint if exists notifications_audience_check;

alter table notifications
  add constraint notifications_audience_check
  check (audience in ('all', 'student'));
