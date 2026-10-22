create table public.password_help_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references auth.users(id)
);
create unique index one_pending_password_request on public.password_help_requests(user_id) where status = 'pending';
alter table public.password_help_requests enable row level security;
revoke all on public.password_help_requests from anon, authenticated;
grant all on public.password_help_requests to service_role;
create function public.request_password_help(account_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.password_help_requests(user_id)
  select id from public.profiles where lower(email) = lower(trim(account_email))
  on conflict (user_id) where status = 'pending' do nothing;
end;
$$;
create function public.complete_password_help(request_id uuid, reviewer uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id = reviewer and role = 'archivist') then
    raise exception 'Archivist required';
  end if;
  update public.password_help_requests set status = 'completed', completed_at = now(), completed_by = reviewer
  where id = request_id and status = 'pending';
  if not found then raise exception 'Request no longer pending'; end if;
end;
$$;
revoke all on function public.request_password_help(text), public.complete_password_help(uuid,uuid) from public, anon, authenticated;
grant execute on function public.request_password_help(text), public.complete_password_help(uuid,uuid) to service_role;
