alter table activity_log
  drop constraint if exists activity_log_user_id_fkey;

alter table activity_log
  alter column user_id drop not null;

alter table activity_log
  add constraint activity_log_user_id_fkey
  foreign key (user_id) references users(id) on delete set null;
