create table if not exists public.call_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  peer_user_id uuid not null,
  call_room_id text not null,
  call_type text not null,
  direction text not null,
  status text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists call_history_user_created_idx
  on public.call_history (user_id, created_at desc);

create index if not exists call_history_room_idx
  on public.call_history (call_room_id);

alter table public.call_history enable row level security;

create policy "Users can view own call history"
on public.call_history
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create own call history"
on public.call_history
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own call history"
on public.call_history
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create trigger call_history_set_updated_at
before update on public.call_history
for each row
execute function public.set_updated_at();