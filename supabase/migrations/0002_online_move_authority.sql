-- 0002_online_move_authority.sql
-- Server-authoritative move application and room finalization.
--
-- The rooms row holds the canonical position (fen/pgn). A move is committed
-- only when a guarded UPDATE matches the caller-supplied prior FEN and the
-- side-to-move derived from that FEN. This gives optimistic-concurrency
-- authority: the proposing client cannot overwrite a concurrently-updated row,
-- and the receiver always reconciles to the echoed server state.
--
-- Move legality itself is validated by ChessEngine on the proposing client
-- (illegal moves cannot be produced) and re-validated on the receiving client
-- when it applies the echoed SAN. See ADR-0003 for the tradeoff.

alter table public.rooms
  add column if not exists winner text check (winner is null or winner in ('white', 'black')),
  add column if not exists result_reason text;

-- Apply a move to a room. Returns the updated room row.
-- p_prior_fen must equal the room's current fen (optimistic lock).
-- p_side is the side that is claiming to move; it must match the turn in p_prior_fen.
create or replace function public.apply_room_move(
  p_code text,
  p_side text,
  p_prior_fen text,
  p_fen_after text,
  p_pgn_after text
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.rooms;
  prior_turn text;  -- 'w' | 'b'
begin
  select * into row from public.rooms where code = p_code for update;

  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;

  if row.status <> 'active' then
    raise exception 'Room is not active' using errcode = 'P0003';
  end if;

  if row.fen <> p_prior_fen then
    raise exception 'Stale position: room has moved' using errcode = 'P0004';
  end if;

  -- Turn is field 2 of a FEN.
  prior_turn := split_part(p_prior_fen, ' ', 2);
  if (prior_turn = 'w' and p_side <> 'white')
     or (prior_turn = 'b' and p_side <> 'black') then
    raise exception 'Not your turn' using errcode = 'P0005';
  end if;

  update public.rooms
    set fen = p_fen_after,
        pgn = p_pgn_after
    where id = row.id
      and status = 'active'
      and fen = p_prior_fen
  returning * into row;

  if not found then
    -- Concurrent update raced us between the SELECT FOR UPDATE and the UPDATE.
    raise exception 'Concurrent move rejected' using errcode = 'P0006';
  end if;

  return row;
end;
$$;

-- Finalize a room as finished or aborted, recording the winner/reason.
-- status 'finished' is used for checkmate/stalemate/draw/timeout/resignation;
-- 'aborted' is used when a player leaves before the game concludes.
create or replace function public.finish_room(
  p_code text,
  p_final_status text,
  p_winner text,
  p_reason text
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.rooms;
begin
  if p_final_status not in ('finished', 'aborted') then
    raise exception 'Invalid final status' using errcode = 'P0007';
  end if;

  select * into row from public.rooms where code = p_code for update;

  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;

  if row.status = 'finished' or row.status = 'aborted' then
    -- Idempotent: already finalized. Return current row unchanged.
    return row;
  end if;

  update public.rooms
    set status = p_final_status,
        winner = nullif(p_winner, '') ,
        result_reason = nullif(p_reason, '')
    where id = row.id
    returning * into row;

  return row;
end;
$$;

comment on function public.apply_room_move(text, text, text, text, text) is
  'Server-authoritative CAS move application. Caller must supply the prior FEN and the side claiming to move.';

comment on function public.finish_room(text, text, text, text) is
  'Finalize a room as finished or aborted. Idempotent.';
