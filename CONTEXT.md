# CONTEXT

## Domain glossary

- **ChessEngine** — application-owned module that wraps `chess.js` and exposes the project's move, history, board-map, and status interface.
- **GameSnapshot** — immutable game state published to React, including FEN, PGN, move history, turn, draw/checkmate status, and winner.
- **MoveRecord** — the canonical record of one applied move: from/to squares, SAN, LAN/UCI-like string, captured piece, promotion, resulting FEN, and ply.
- **Clock** — FIDE-style chess clock module that tracks both sides' remaining time, increment, low-time warnings, flag fall, and server-correction hooks.
- **AIAdapter** — seam for computer-move providers. Current adapters are `StockfishAI` and `FallbackAI`.
- **Local session** — a game where the browser owns move authority, applies moves with `ChessEngine`, and optionally asks an `AIAdapter` for the opposing move.
- **Online session** — a planned game where room state is synchronized over Supabase Realtime and canonical move history is stored server-side.
- **Board bridge** — the imperative adapter through which a game session requests board animation, selection clearing, and legal-target highlighting without depending on a specific renderer.
- **Renderer** — a visual board implementation (`Board2D` or `Board3D`) that renders position and satisfies the board bridge contract.
- **Lobby** — the pre-game surface where the player chooses side, time control, AI difficulty, theme, and future online room actions.
- **Spectator** — a read-only participant in an online room. Already named in `PlayerId`; planned for Phase 2.
- **Room code** — short shareable identifier for joining an online session.

## Architectural notes

- `ChessEngine` is the rules source of truth for local play.
- `AIAdapter` is already a real seam because two adapters exist.
- The next deepening step is to move orchestration out of `useGame` into a session module behind the board bridge seam.
