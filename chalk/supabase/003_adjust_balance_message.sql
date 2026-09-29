-- Friendlier failure: check the balance before the update so the error says "insufficient balance".
create or replace function chalk_adjust_balance(
  p_player uuid, p_delta int, p_kind text, p_match uuid default null, p_payment uuid default null, p_note text default null
) returns int
language plpgsql security definer set search_path = public as $$
declare v_cur int; v_new int;
begin
  select balance_cents into v_cur from chalk_players where id = p_player for update;
  if v_cur is null then raise exception 'player not found'; end if;
  if v_cur + p_delta < 0 then raise exception 'Insufficient balance'; end if;
  update chalk_players set balance_cents = balance_cents + p_delta where id = p_player returning balance_cents into v_new;
  insert into chalk_ledger(player_id, kind, amount_cents, balance_after_cents, match_id, payment_id, note)
  values (p_player, p_kind, p_delta, v_new, p_match, p_payment, p_note);
  return v_new;
end $$;
