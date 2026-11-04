-- Temporary rule shares. The link carries only this id. Rows are unowned and
-- expire; nothing here is an account.
create table if not exists shares (
  id text primary key,
  name text not null,
  rules text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists shares_expires_at_idx on shares (expires_at);
