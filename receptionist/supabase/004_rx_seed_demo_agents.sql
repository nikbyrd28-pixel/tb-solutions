-- Four lines on the demo business so you can hear the roles side by side.
-- Run after 003. Numbers stay null until you provision them:
--   node receptionist/vapi/provision.mjs demo main booking after-hours support
-- then paste the update statements it prints.

insert into public.rx_agents (business_id, slug, label, role, agent_name, greeting, prompt_extra, hours, emergency_policy, priority)
select b.id, v.slug, v.label, v.role, v.agent_name, v.greeting, v.prompt_extra, v.hours::jsonb, v.emergency_policy, v.priority
from public.rx_businesses b,
(values
  ('booking', 'Booking line', 'booking', 'Dana',
   null,
   'This number is on the truck wraps and the Google listing. Assume the caller wants an appointment, not a conversation.',
   null, null, 10),

  ('after-hours', 'After-hours emergency line', 'emergency', 'Marcus',
   'Keystone Plumbing emergency line, this is Marcus. Tell me what''s happening.',
   'The owner forwards the main line here nights and weekends. Treat every caller as if water is running right now: safety step first, then get the tech moving.',
   '{"mon":["00:00","23:59"],"tue":["00:00","23:59"],"wed":["00:00","23:59"],"thu":["00:00","23:59"],"fri":["00:00","23:59"],"sat":["00:00","23:59"],"sun":["00:00","23:59"]}',
   'transfer', 20),

  ('support', 'Existing customer line', 'support', 'Rae',
   'Keystone Plumbing customer care, this is Rae. Do you have a job with us already?',
   'Callers here already have an invoice, a warranty question, or a tech on the way. Never book new work on this line.',
   null, 'message_only', 30),

  ('estimates', 'Estimates & replacements line', 'estimates', 'Dana',
   null,
   'These are replacement and remodel shoppers. Get them on the calendar for a free estimate visit and never guess at a price.',
   null, 'message_only', 40)
) as v(slug, label, role, agent_name, greeting, prompt_extra, hours, emergency_policy, priority)
where b.slug = 'demo'
on conflict (business_id, slug) do nothing;
