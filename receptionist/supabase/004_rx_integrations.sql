-- Field-service app sync: Housecall Pro (live), Jobber (planned). One row per business per provider.
create table if not exists public.rx_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.rx_businesses(id) on delete cascade,
  provider text not null,                 -- housecallpro | jobber
  api_key text,                           -- HCP API key (Settings → API). Jobber will use settings.{access_token,refresh_token}
  settings jsonb not null default '{}',   -- {assign_to: employee_id, base_url}
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (business_id, provider)
);
alter table public.rx_integrations enable row level security;  -- no policies: service role + HQ RPCs only

create table if not exists public.rx_sync_log (
  id bigserial primary key, created_at timestamptz default now(),
  job_id uuid, business_id uuid, results jsonb
);
alter table public.rx_sync_log enable row level security;

-- Fire rx-sync on every new booked job (pg_net, async, never blocks the booking).
create or replace function public.rx_jobs_sync_trigger() returns trigger language plpgsql security definer set search_path = public as $$
declare v_secret text; v_url text;
begin
  select value into v_secret from rx_config where key = 'RX_SYNC_SECRET';
  v_url := 'https://qgbjiqdwzgkjkmqyjsmc.supabase.co/functions/v1/rx-sync';
  if exists (select 1 from rx_integrations where business_id = new.business_id and active) then
    perform net.http_post(url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-rx-sync-secret', coalesce(v_secret,'')),
      body := jsonb_build_object('record', to_jsonb(new)));
  end if;
  return new;
end $$;
drop trigger if exists rx_jobs_sync on public.rx_jobs;
create trigger rx_jobs_sync after insert on public.rx_jobs for each row execute function public.rx_jobs_sync_trigger();

-- HQ: read (masked) + save integrations
create or replace function public.hq_rx_integrations(p_business uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (select coalesce(jsonb_agg(jsonb_build_object('provider',provider,'active',active,'has_key',api_key is not null,'key_tail',right(coalesce(api_key,''),4),'settings',settings,'created_at',created_at)), '[]') from rx_integrations where business_id = p_business) else null end
$$;
create or replace function public.hq_rx_integration_save(p_business uuid, p_provider text, p_api_key text, p_active boolean, p_settings jsonb default '{}') returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  insert into rx_integrations (business_id, provider, api_key, active, settings) values (p_business, p_provider, nullif(p_api_key,''), p_active, coalesce(p_settings,'{}'))
  on conflict (business_id, provider) do update set api_key = coalesce(nullif(excluded.api_key,''), rx_integrations.api_key), active = excluded.active, settings = coalesce(excluded.settings, rx_integrations.settings);
end $$;
create or replace function public.hq_rx_sync_log(p_business uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then (select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc), '[]') from (select * from rx_sync_log where business_id = p_business order by created_at desc limit 20) l) else null end
$$;
grant execute on function public.hq_rx_integrations(uuid), public.hq_rx_integration_save(uuid,text,text,boolean,jsonb), public.hq_rx_sync_log(uuid) to authenticated;
