-- Extensions
create extension if not exists pgcrypto;

-- Profiles (linked to auth users)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  device_id text,
  online_status boolean not null default false,
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contact requests
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

-- Contacts (bi-directional rows)
create table if not exists public.contacts (
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, contact_id),
  check (user_id <> contact_id)
);

-- Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Participants
create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(conversation_id, user_id)
);

-- Attachments metadata
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  mime_type text not null,
  file_size bigint not null,
  created_at timestamptz not null default now()
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text,
  attachment_id uuid references public.attachments(id) on delete set null,
  created_at timestamptz not null default now(),
  check (content is not null or attachment_id is not null)
);

-- Indexes
create index if not exists idx_profiles_online on public.profiles(online_status);
create index if not exists idx_contact_requests_receiver on public.contact_requests(receiver_id, status, created_at desc);
create index if not exists idx_contact_requests_sender on public.contact_requests(sender_id, status, created_at desc);
create index if not exists idx_contacts_user on public.contacts(user_id);
create index if not exists idx_messages_conversation_created on public.messages(conversation_id, created_at desc);
create index if not exists idx_conversation_participants_user on public.conversation_participants(user_id);
create index if not exists idx_attachments_conversation on public.attachments(conversation_id, created_at desc);

-- Updated at trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_contact_requests_updated_at
before update on public.contact_requests
for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'User'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- Helper function
create or replace function public.is_conversation_participant(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = _conversation_id
      and cp.user_id = auth.uid()
  );
$$;

-- Realtime helper: create or return 1:1 conversation
create or replace function public.get_or_create_direct_conversation(_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _current_user uuid := auth.uid();
  _conversation_id uuid;
begin
  if _current_user is null then
    raise exception 'Not authenticated';
  end if;

  if _other_user_id is null or _other_user_id = _current_user then
    raise exception 'Invalid recipient';
  end if;

  select cp1.conversation_id into _conversation_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2
    on cp1.conversation_id = cp2.conversation_id
  where cp1.user_id = _current_user
    and cp2.user_id = _other_user_id
  group by cp1.conversation_id
  having count(*) = 2
  limit 1;

  if _conversation_id is not null then
    return _conversation_id;
  end if;

  insert into public.conversations (created_by)
  values (_current_user)
  returning id into _conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (_conversation_id, _current_user), (_conversation_id, _other_user_id)
  on conflict do nothing;

  return _conversation_id;
end;
$$;

-- Accept request helper (creates bi-directional contacts)
create or replace function public.accept_contact_request(_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _sender uuid;
  _receiver uuid := auth.uid();
begin
  if _receiver is null then
    raise exception 'Not authenticated';
  end if;

  select sender_id, receiver_id
  into _sender, _receiver
  from public.contact_requests
  where id = _request_id
    and receiver_id = auth.uid()
    and status = 'pending';

  if _sender is null then
    raise exception 'Request not found';
  end if;

  update public.contact_requests
  set status = 'accepted', updated_at = now()
  where id = _request_id;

  insert into public.contacts (user_id, contact_id)
  values (_sender, _receiver), (_receiver, _sender)
  on conflict do nothing;
end;
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.contact_requests enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.attachments enable row level security;
alter table public.messages enable row level security;

-- Profiles policies
create policy "Authenticated users can view profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Contact requests policies
create policy "Users can view their contact requests"
on public.contact_requests
for select
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "Users can create contact requests"
on public.contact_requests
for insert
to authenticated
with check (sender_id = auth.uid() and status = 'pending');

create policy "Users can update received requests"
on public.contact_requests
for update
to authenticated
using (receiver_id = auth.uid())
with check (receiver_id = auth.uid());

create policy "Users can delete own related requests"
on public.contact_requests
for delete
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

-- Contacts policies
create policy "Users can view own contacts"
on public.contacts
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can manage own contacts rows"
on public.contacts
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Conversations policies
create policy "Users can view own conversations"
on public.conversations
for select
to authenticated
using (public.is_conversation_participant(id));

create policy "Users can create conversations"
on public.conversations
for insert
to authenticated
with check (created_by = auth.uid());

-- Conversation participants policies
create policy "Users can view participants in own conversations"
on public.conversation_participants
for select
to authenticated
using (public.is_conversation_participant(conversation_id));

create policy "Users can add themselves as participant"
on public.conversation_participants
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.created_by = auth.uid()
  )
);

create policy "Users can remove themselves from conversations"
on public.conversation_participants
for delete
to authenticated
using (user_id = auth.uid());

-- Attachments policies
create policy "Participants can view attachments"
on public.attachments
for select
to authenticated
using (public.is_conversation_participant(conversation_id));

create policy "Participants can upload attachments metadata"
on public.attachments
for insert
to authenticated
with check (uploader_id = auth.uid() and public.is_conversation_participant(conversation_id));

create policy "Uploaders can delete own attachments"
on public.attachments
for delete
to authenticated
using (uploader_id = auth.uid());

-- Messages policies
create policy "Participants can read messages"
on public.messages
for select
to authenticated
using (public.is_conversation_participant(conversation_id));

create policy "Participants can create messages"
on public.messages
for insert
to authenticated
with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));

create policy "Senders can update own messages"
on public.messages
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

create policy "Senders can delete own messages"
on public.messages
for delete
to authenticated
using (sender_id = auth.uid());

-- Storage bucket + policies
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "Attachment objects readable by participants"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id::text = (storage.foldername(name))[1]
      and cp.user_id = auth.uid()
  )
);

create policy "Attachment objects insertable by participants"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id::text = (storage.foldername(name))[1]
      and cp.user_id = auth.uid()
  )
);

create policy "Attachment objects deletable by owner folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
);