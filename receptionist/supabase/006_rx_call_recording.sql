-- Record every call, and tell the caller.
--
-- Pennsylvania is an all-party consent state (18 Pa.C.S. ch. 57): recording a call without
-- telling the other party is a crime, and every shop on this system is in PA. Notice at the
-- top of the call, and carrying on after it, is the consent. Short enough not to cost a booking.
--
-- Per-business so a client in a one-party state can drop the notice, and so recording can be
-- turned off entirely for anyone who asks. Run after 005.

alter table public.rx_businesses add column if not exists record_calls boolean not null default true;
alter table public.rx_businesses add column if not exists recording_notice text
  default 'Heads up, this call''s recorded.';

update public.rx_businesses set recording_notice = 'Heads up, this call''s recorded.'
where recording_notice is null;
