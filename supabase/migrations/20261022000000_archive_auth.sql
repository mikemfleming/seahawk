-- All app data is accessed through the trusted Node server. Never expose its
-- secret key. Browser tokens cannot select or mutate the archive or Storage.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null default 'crew' check (role in ('crew', 'archivist')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Crew member'), 120));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
create table public.membership_reviews (
  id bigint generated always as identity primary key,
  member_id uuid not null references auth.users(id),
  reviewer_id uuid not null references auth.users(id),
  status text not null,
  created_at timestamptz not null default now()
);
alter table public.membership_reviews enable row level security;
revoke all on public.membership_reviews from anon, authenticated;
create function public.review_member(member uuid, decision text, reviewer uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if decision not in ('approved', 'declined', 'pending') or not exists
    (select 1 from public.profiles where id = reviewer and role = 'archivist') then
    raise exception 'Invalid review';
  end if;
  update public.profiles set status = decision, reviewed_at = now(), reviewed_by = reviewer where id = member and role = 'crew';
  if not found then raise exception 'Crew member not found'; end if;
  insert into public.membership_reviews(member_id, reviewer_id, status) values (member, reviewer, decision);
end;
$$;
revoke all on function public.review_member(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.review_member(uuid,text,uuid) to service_role;
create table public.archive (
  id integer primary key check (id = 1),
  version bigint not null default 0,
  document jsonb not null
);
alter table public.archive enable row level security;
revoke all on public.archive from anon, authenticated;
insert into public.archive (id, document) values (1, '{"schema_version":1,"volumes":[{"id":"V001","title":"The Ship’s Log"}],"pages":[],"entries":[],"trips":[],"artifacts":[],"contributions":[]}');
create function public.commit_archive(expected_version bigint, next_document jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.archive set document = next_document, version = version + 1 where id = 1 and version = expected_version;
  return found;
end;
$$;
revoke all on function public.commit_archive(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.commit_archive(bigint,jsonb) to service_role;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('archive-photos', 'archive-photos', false, 12582912, array['image/jpeg','image/png','image/webp']);
grant all on public.profiles, public.membership_reviews, public.archive to service_role;
grant usage, select on sequence public.membership_reviews_id_seq to service_role;
revoke all on function public.create_profile() from public, anon, authenticated;
