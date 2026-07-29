create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_name text not null,
  guest_name text,
  host_side text not null check (host_side in ('white', 'black')),
  clock_initial_seconds integer not null check (clock_initial_seconds >= 0),
  clock_increment_seconds integer not null check (clock_increment_seconds >= 0),
  theme text not null,
  piece_style text not null,
  status text not null check (status in ('waiting', 'active', 'finished', 'aborted')) default 'waiting',
  fen text not null,
  pgn text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

 drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at();

alter table public.rooms enable row level security;

create policy "rooms are readable by anyone"
on public.rooms
for select
using (true);

create policy "rooms are insertable by anyone"
on public.rooms
for insert
with check (true);

create policy "rooms are updatable by anyone"
on public.rooms
for update
using (true)
with check (true);

alter publication supabase_realtime add table public.rooms;
