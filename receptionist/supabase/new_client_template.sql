-- NEW CLIENT (20-minute onboarding). Fill the [brackets] from the onboarding form, run in Supabase SQL editor.
-- Then: node receptionist/vapi/provision.mjs (with their Twilio number or AREA_CODE) → set agent_number → have them forward on no-answer.

with b as (
  insert into public.rx_businesses
    (slug, name, trade, owner_name, owner_phone, agent_name, timezone, service_area_note,
     service_fee_cents, after_hours_fee_cents, free_estimates, emergency_policy, transfer_number, hours, knowledge)
  values (
    '[slug-no-spaces]',            -- e.g. mikes-plumbing
    '[Business Name]',
    '[plumbing|hvac|electrical|drain|other]',
    '[Owner first name]',
    '+1[OWNER CELL 10 digits]',    -- gets every text
    'Dana',                        -- receptionist persona; change if they want
    'America/New_York',
    '[Towns / counties served, in plain words]',
    [8900],                        -- dispatch fee in cents, or null
    [18900],                       -- after-hours fee in cents, or null
    true,                          -- free estimates?
    'after_hours_dispatch',        -- or 'message_only' or 'transfer'
    null,                          -- transfer number if emergency_policy = transfer
    '{"mon":["07:00","17:00"],"tue":["07:00","17:00"],"wed":["07:00","17:00"],"thu":["07:00","17:00"],"fri":["07:00","17:00"],"sat":null,"sun":null}',
    '[Payment types, brands serviced, discounts, what they DO NOT do, anything the agent should never say]'
  )
  on conflict (slug) do update set name = excluded.name, owner_phone = excluded.owner_phone
  returning id
)
-- copy the demo service list (edit names/keywords to their trade afterwards)
insert into public.rx_services (business_id, name, keywords, urgency, safety_steps)
select b.id, s.name, s.keywords, s.urgency, s.safety_steps
from b, public.rx_services s join public.rx_businesses d on d.id = s.business_id and d.slug = 'demo';

-- on-call = owner by default
insert into public.rx_on_call (business_id, name, phone)
select id, owner_name, owner_phone from public.rx_businesses where slug = '[slug-no-spaces]';

-- after provision.mjs prints the number:
-- update public.rx_businesses set agent_number = '+1XXXXXXXXXX' where slug = '[slug-no-spaces]';
