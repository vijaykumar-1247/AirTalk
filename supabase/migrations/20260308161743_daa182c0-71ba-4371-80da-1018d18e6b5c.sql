-- Real-time incoming call invitations for one-on-one web calls
create table if not exists public.call_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  receiver_id uuid not null,
  call_room_id text not null,
  call_type text not null default 'video',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes')
);

create index if not exists call_invites_receiver_status_idx
  on public.call_invites (receiver_id, status, created_at desc);

create index if not exists call_invites_sender_status_idx
  on public.call_invites (sender_id, status, created_at desc);

create index if not exists call_invites_room_idx
  on public.call_invites (call_room_id);

alter table public.call_invites enable row level security;

create policy "Users can view own call invites"
on public.call_invites
for select
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "Users can create outgoing call invites"
on public.call_invites
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and sender_id <> receiver_id
  and status = 'pending'
);

create policy "Users can update own call invites"
on public.call_invites
for update
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid())
with check (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "Call sender can delete own invites"
on public.call_invites
for delete
to authenticated
using (sender_id = auth.uid());

create trigger call_invites_set_updated_at
before update on public.call_invites
for each row
execute function public.set_updated_at();

alter publication supabase_realtime add table public.call_invites;