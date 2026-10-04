-- HQ: edit each receptionist client's brain (the row rx-agent builds the prompt from) + their services.
-- Changes take effect on the next call — no redeploy, no prompt editing.

create or replace function public.hq_rx_business(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_hq_admin() then jsonb_build_object(
    'business', (select to_jsonb(b) - 'vapi_assistant_id' from rx_businesses b where b.id = p_id),
    'services', (select coalesce(jsonb_agg(to_jsonb(s) order by s.urgency, s.name), '[]') from rx_services s where s.business_id = p_id),
    'on_call',  (select coalesce(jsonb_agg(to_jsonb(o)), '[]') from rx_on_call o where o.business_id = p_id)
  ) else null end
$$;

-- Patch only the keys passed. Whitelisted columns; hours/windows/service_zips passed as JSON.
create or replace function public.hq_rx_business_save(p_id uuid, p jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  update rx_businesses set
    name = coalesce(p->>'name', name),
    trade = coalesce(p->>'trade', trade),
    owner_name = coalesce(p->>'owner_name', owner_name),
    owner_phone = coalesce(p->>'owner_phone', owner_phone),
    agent_name = coalesce(p->>'agent_name', agent_name),
    agent_number = case when p ? 'agent_number' then nullif(p->>'agent_number','') else agent_number end,
    timezone = coalesce(p->>'timezone', timezone),
    service_zips = case when p ? 'service_zips' then array(select jsonb_array_elements_text(p->'service_zips')) else service_zips end,
    service_area_note = case when p ? 'service_area_note' then nullif(p->>'service_area_note','') else service_area_note end,
    service_fee_cents = case when p ? 'service_fee_cents' then (p->>'service_fee_cents')::int else service_fee_cents end,
    after_hours_fee_cents = case when p ? 'after_hours_fee_cents' then (p->>'after_hours_fee_cents')::int else after_hours_fee_cents end,
    free_estimates = coalesce((p->>'free_estimates')::boolean, free_estimates),
    hours = coalesce(p->'hours', hours),
    windows = coalesce(p->'windows', windows),
    jobs_per_window = coalesce((p->>'jobs_per_window')::int, jobs_per_window),
    emergency_policy = coalesce(p->>'emergency_policy', emergency_policy),
    transfer_number = case when p ? 'transfer_number' then nullif(p->>'transfer_number','') else transfer_number end,
    knowledge = case when p ? 'knowledge' then p->>'knowledge' else knowledge end,
    active = coalesce((p->>'active')::boolean, active),
    updated_at = now()
  where id = p_id;
end $$;

create or replace function public.hq_rx_service_save(p_business uuid, p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  if nullif(p->>'id','') is null then
    insert into rx_services (business_id, name, keywords, urgency, fee_cents, safety_steps, active)
    values (p_business, p->>'name', coalesce(array(select jsonb_array_elements_text(p->'keywords')), '{}'), coalesce(p->>'urgency','standard'), (p->>'fee_cents')::int, nullif(p->>'safety_steps',''), coalesce((p->>'active')::boolean, true))
    returning id into v_id;
  else
    update rx_services set name = coalesce(p->>'name', name), keywords = case when p ? 'keywords' then array(select jsonb_array_elements_text(p->'keywords')) else keywords end,
      urgency = coalesce(p->>'urgency', urgency), fee_cents = case when p ? 'fee_cents' then (p->>'fee_cents')::int else fee_cents end,
      safety_steps = case when p ? 'safety_steps' then nullif(p->>'safety_steps','') else safety_steps end, active = coalesce((p->>'active')::boolean, active)
    where id = (p->>'id')::uuid and business_id = p_business returning id into v_id;
  end if;
  return v_id;
end $$;

-- No delete: services are turned off with active=false (hq_rx_service_save). Keeps call history consistent.

-- New client from HQ: copies the demo's services so the line works on day one.
create or replace function public.hq_rx_business_create(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_demo uuid;
begin
  if not is_hq_admin() then raise exception 'not admin'; end if;
  insert into rx_businesses (slug, name, trade, owner_name, owner_phone, agent_name, service_area_note, service_fee_cents, after_hours_fee_cents, knowledge, active)
  values (lower(regexp_replace(coalesce(p->>'slug', p->>'name'), '[^a-zA-Z0-9]+', '-', 'g')), p->>'name', coalesce(p->>'trade','plumbing'), p->>'owner_name', p->>'owner_phone',
          coalesce(p->>'agent_name','Jess'), p->>'service_area_note', coalesce((p->>'service_fee_cents')::int, 8900), (p->>'after_hours_fee_cents')::int, p->>'knowledge', false)
  returning id into v_id;
  select id into v_demo from rx_businesses where slug = 'demo';
  if v_demo is not null then
    insert into rx_services (business_id, name, keywords, urgency, fee_cents, safety_steps, active)
    select v_id, name, keywords, urgency, null, safety_steps, active from rx_services where business_id = v_demo;
  end if;
  return v_id;
end $$;

grant execute on function public.hq_rx_business(uuid), public.hq_rx_business_save(uuid,jsonb), public.hq_rx_service_save(uuid,jsonb), public.hq_rx_business_create(jsonb) to authenticated;
