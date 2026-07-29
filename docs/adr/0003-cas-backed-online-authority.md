# ADR-0003: Use CAS-backed rooms as the online authority seam

## Status
Accepted

## Context
The app already supports local play through `ChessEngine` and `LocalGameSession`, and the next feature step is online multiplayer over Supabase Realtime. The stack does not include a server runtime that can execute `chess.js` inside Postgres, so pure server-side legality validation is not available inside SQL alone.

## Decision
Use the `rooms` row as the canonical online authority. Clients propose moves through the `apply_room_move` RPC in `supabase/migrations/0002_online_move_authority.sql`, passing:
- room code
- moving side
- prior FEN
- resulting FEN
- resulting PGN

The RPC performs optimistic-concurrency validation:
- the room must exist
- the room must be active
- the stored FEN must match the caller's prior FEN
- the side-to-move in that FEN must match the caller's side

If those checks pass, the server commits the new canonical FEN/PGN. Clients subscribe to the room row over Realtime and reconcile from the echoed server state.

## Consequences
- Canonical online state lives in Supabase, not in either browser.
- Clients cannot overwrite a newer position without being rejected by the CAS guard.
- Move legality is still enforced by `ChessEngine` on the proposing client and re-applied from canonical PGN on the receiving client.
- This is stronger than peer echo or host-authoritative play, but weaker than a dedicated server process running `chess.js` server-side.
- Undo is intentionally unsupported online because the server history is append-only.
- Online clocks are still client-driven display clocks; timeout reporting is best-effort until clock state is persisted server-side.
