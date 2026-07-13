insert into public.app_health(id) values (1) on conflict (id) do nothing;
