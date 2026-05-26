alter table public.categories
add column if not exists exclude_from_reports boolean not null default false;

notify pgrst, 'reload schema';
