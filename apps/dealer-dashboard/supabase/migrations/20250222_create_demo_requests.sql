create table if not exists demo_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  dealership text,
  role text,
  interest text,
  message text,
  source text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table demo_requests enable row level security;
