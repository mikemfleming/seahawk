-- Aggregate counters only: no raw events, visitor identifiers, IPs or user agents.
create table public.page_view_daily (
  day date not null,
  page text not null check (page = '/' or page = '/atlas' or page ~ '^/entries/[A-Za-z0-9_-]{1,100}$'),
  views bigint not null default 0 check (views >= 0),
  primary key (day, page)
);
alter table public.page_view_daily enable row level security;
revoke all on public.page_view_daily from anon, authenticated;
grant all on public.page_view_daily to service_role;

create function public.record_page_view(page_path text) returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.page_view_daily(day, page, views)
  values ((now() at time zone 'UTC')::date, page_path, 1)
  on conflict (day, page) do update set views = public.page_view_daily.views + 1;
end;
$$;
revoke all on function public.record_page_view(text) from public, anon, authenticated;
grant execute on function public.record_page_view(text) to service_role;
