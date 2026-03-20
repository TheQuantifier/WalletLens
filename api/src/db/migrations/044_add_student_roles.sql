alter table users
  drop constraint if exists users_role_check;

alter table users
  add constraint users_role_check
  check (role in ('user', 'student', 'admin', 'student_admin', 'support_admin', 'analyst'));
