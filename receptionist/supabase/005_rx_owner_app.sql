-- Owner app (tbsol.net/receptionist/app/): a client logs in and runs their own line.
-- Access via rx_business_users. HQ invites by email; the owner's first login claims the invite.

create table if not exists public.rx_owner_invites (
  business_id uuid not null references public.rx_businesses(id) on delete cascade,
  email text not null,
  created_at timestamptz default now(),
  claimed_at timestamptz,
  primary key (business_id, email)
);
alter table public.rx_owner_invites enable row level security;

create or replace function public.hq_rx_invite(p_business uuid, p_email text) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  insert into rx_owner_invites (business_id, email) values (p_business, lower(trim(p_email))) on conflict do nothing;
  -- if that user already exists, link now
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is not null then
    insert into rx_business_users (business_id, user_id) values (p_business, v_uid) on conflict do nothing;
    update rx_owner_invites set claimed_at = now() where business_id = p_business and email = lower(trim(p_email));
  end if;
end $$;
create or replace function public.hq_rx_owners(p_business uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then jsonb_build_object(
    'users', (select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'role', bu.role)), '[]') from rx_business_users bu join auth.users u on u.id = bu.user_id where bu.business_id = p_business),
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('email', email, 'claimed', claimed_at is not null)), '[]') from rx_owner_invites where business_id = p_business)) else null end
$$;

-- which business is the caller's? (claims pending invite by email on first call)
create or replace function public.rx_owner_business_id() returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid; v_email text;
begin
  if auth.uid() is null then return null; end if;
  select business_id into v from rx_business_users where user_id = auth.uid() limit 1;
  if v is not null then return v; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  select business_id into v from rx_owner_invites where email = v_email and claimed_at is null limit 1;
  if v is not null then
    insert into rx_business_users (business_id, user_id) values (v, auth.uid()) on conflict do nothing;
    update rx_owner_invites set claimed_at = now() where business_id = v and email = v_email;
  end if;
  return v;
end $$;

create or replace function public.rx_owner_me(p_days int default 30) returns jsonb language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then return null; end if;
  return jsonb_build_object(
    'business', (select to_jsonb(b) - 'vapi_assistant_id' from rx_businesses b where b.id = v),
    'services', (select coalesce(jsonb_agg(to_jsonb(s) order by s.urgency, s.name), '[]') from rx_services s where s.business_id = v),
    'jobs', (select coalesce(jsonb_agg(to_jsonb(j) order by j.window_start desc), '[]') from rx_jobs j where j.business_id = v and j.created_at > now() - make_interval(days => p_days)),
    'calls', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'caller_phone',caller_phone,'started_at',started_at,'duration_s',duration_s,'outcome',outcome,'urgency',urgency,'summary',summary,'recording_url',recording_url) order by started_at desc), '[]') from rx_calls where business_id = v and created_at > now() - make_interval(days => p_days)),
    'messages', (select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc), '[]') from rx_messages m where m.business_id = v and m.created_at > now() - make_interval(days => p_days)),
    'stats', jsonb_build_object(
      'calls', (select count(*) from rx_calls where business_id = v and created_at > now() - make_interval(days => p_days)),
      'jobs', (select count(*) from rx_jobs where business_id = v and created_at > now() - make_interval(days => p_days)),
      'booked_value', (select coalesce(sum(quoted_fee_cents),0)/100 from rx_jobs where business_id = v and created_at > now() - make_interval(days => p_days)),
      'after_hours_jobs', (select count(*) from rx_jobs j join rx_businesses b on b.id=j.business_id where j.business_id = v and j.created_at > now() - make_interval(days => p_days) and (extract(hour from j.created_at at time zone coalesce(b.timezone,'America/New_York')) not between 7 and 17)),
      'unhandled_msgs', (select count(*) from rx_messages where business_id = v and not handled)));
end $$;

-- Owner can change what the receptionist says, not the plumbing (slug, agent_number, active stay with Nick)
create or replace function public.rx_owner_save(p jsonb) returns void language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin
  if v is null then raise exception 'no business'; end if;
  update rx_businesses set
    owner_name = coalesce(p->>'owner_name', owner_name),
    owner_phone = coalesce(nullif(p->>'owner_phone',''), owner_phone),
    agent_name = coalesce(nullif(p->>'agent_name',''), agent_name),
    service_zips = case when p ? 'service_zips' then array(select jsonb_array_elements_text(p->'service_zips')) else service_zips end,
    service_area_note = case when p ? 'service_area_note' then nullif(p->>'service_area_note','') else service_area_note end,
    service_fee_cents = case when p ? 'service_fee_cents' then (p->>'service_fee_cents')::int else service_fee_cents end,
    after_hours_fee_cents = case when p ? 'after_hours_fee_cents' then (p->>'after_hours_fee_cents')::int else after_hours_fee_cents end,
    free_estimates = coalesce((p->>'free_estimates')::boolean, free_estimates),
    hours = coalesce(p->'hours', hours), windows = coalesce(p->'windows', windows),
    jobs_per_window = coalesce((p->>'jobs_per_window')::int, jobs_per_window),
    emergency_policy = coalesce(p->>'emergency_policy', emergency_policy),
    transfer_number = case when p ? 'transfer_number' then nullif(p->>'transfer_number','') else transfer_number end,
    knowledge = case when p ? 'knowledge' then p->>'knowledge' else knowledge end,
    updated_at = now()
  where id = v;
end $$;
create or replace function public.rx_owner_service_save(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id(); v_id uuid;
begin
  if v is null then raise exception 'no business'; end if;
  if nullif(p->>'id','') is null then
    insert into rx_services (business_id, name, keywords, urgency, fee_cents, safety_steps, active)
    values (v, p->>'name', coalesce(array(select jsonb_array_elements_text(p->'keywords')), '{}'), coalesce(p->>'urgency','standard'), (p->>'fee_cents')::int, nullif(p->>'safety_steps',''), coalesce((p->>'active')::boolean, true)) returning id into v_id;
  else
    update rx_services set name = coalesce(p->>'name', name), keywords = case when p ? 'keywords' then array(select jsonb_array_elements_text(p->'keywords')) else keywords end,
      urgency = coalesce(p->>'urgency', urgency), fee_cents = case when p ? 'fee_cents' then (p->>'fee_cents')::int else fee_cents end,
      safety_steps = case when p ? 'safety_steps' then nullif(p->>'safety_steps','') else safety_steps end, active = coalesce((p->>'active')::boolean, active)
    where id = (p->>'id')::uuid and business_id = v returning id into v_id;
  end if;
  return v_id;
end $$;
create or replace function public.rx_owner_job_status(p_id uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin update rx_jobs set status = p_status, updated_at = now() where id = p_id and business_id = v; end $$;
create or replace function public.rx_owner_message_handled(p_id uuid, p_handled boolean) returns void language plpgsql security definer set search_path = public as $$
declare v uuid := rx_owner_business_id();
begin update rx_messages set handled = p_handled where id = p_id and business_id = v; end $$;

grant execute on function public.hq_rx_invite(uuid,text), public.hq_rx_owners(uuid), public.rx_owner_business_id(), public.rx_owner_me(int), public.rx_owner_save(jsonb), public.rx_owner_service_save(jsonb), public.rx_owner_job_status(uuid,text), public.rx_owner_message_handled(uuid,boolean) to authenticated;
