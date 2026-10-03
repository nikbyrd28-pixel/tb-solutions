-- Demo plumbing company for the public demo line + your mom's shop as the first real client.
-- Run after 001. Edit phones/fees before running for real.

insert into public.rx_businesses (slug, name, trade, owner_name, owner_phone, agent_name, service_area_note,
  service_fee_cents, after_hours_fee_cents, free_estimates, emergency_policy, knowledge)
values (
  'demo', 'Keystone Plumbing', 'plumbing', 'Nick', '+16105550100', 'Dana',
  'Pottstown, Phoenixville, Royersford, Limerick, Boyertown, Collegeville and anywhere within about 30 minutes of Pottstown PA',
  8900, 18900, true, 'after_hours_dispatch',
  'Family-owned, licensed and insured in PA. We take cash, check, and all major cards. We service all water heater brands (Bradford White, Rheem, AO Smith). Senior and veteran discount: 10% off labor. We do not do new construction or septic pumping.'
) on conflict (slug) do nothing;

insert into public.rx_services (business_id, name, keywords, urgency, safety_steps)
select b.id, s.name, s.keywords, s.urgency, s.safety_steps from public.rx_businesses b,
(values
  ('Water heater leak',        array['water heater','hot water tank','tank leaking','no hot water'], 'emergency', 'Find the cold-water shut-off valve on top of the tank and turn it clockwise until it stops. If it is gas, turn the gas knob to OFF.'),
  ('Burst pipe / active leak', array['burst pipe','pipe burst','water everywhere','flooding','spraying'], 'emergency', 'Shut off the main water valve — usually in the basement where the water line comes in, or near the meter. Turn clockwise.'),
  ('Sewer backup',             array['sewer','sewage','backing up','backup','toilets overflowing'], 'emergency', 'Stop running any water in the house and keep everyone away from the backup.'),
  ('Clogged drain / toilet',   array['clog','clogged','slow drain','toilet won''t flush','backed up sink'], 'urgent', null),
  ('Leaking faucet / fixture', array['dripping','faucet','leaky faucet','under the sink'], 'standard', 'Turn the small shut-off valves under the sink clockwise to stop the drip.'),
  ('Garbage disposal',         array['disposal','garbage disposal','humming'], 'standard', 'Do not put your hand in the disposal. Press the red reset button on the bottom of the unit.'),
  ('Sump pump',                array['sump pump','sump','basement water'], 'urgent', null),
  ('Water heater replacement', array['replace water heater','new water heater','tankless'], 'estimate', null),
  ('Bathroom / kitchen remodel plumbing', array['remodel','renovation','new bathroom'], 'estimate', null)
) as s(name, keywords, urgency, safety_steps)
where b.slug = 'demo';

insert into public.rx_on_call (business_id, name, phone, days, priority)
select id, 'Nick', '+16105550100', '{0,1,2,3,4,5,6}', 1 from public.rx_businesses where slug='demo';

-- First real client: D N E Contracting (Pottstown). Fill in the bracketed values.
-- insert into public.rx_businesses (slug, name, trade, owner_name, owner_phone, agent_name, service_area_note, service_fee_cents, after_hours_fee_cents)
-- values ('dne-contracting', 'D N E Contracting', 'plumbing', '[MOM NAME]', '+1[MOM CELL]', 'Dana', 'Pottstown and surrounding Montgomery / Chester / Berks county towns', [FEE_CENTS], [AFTER_HOURS_CENTS]);
