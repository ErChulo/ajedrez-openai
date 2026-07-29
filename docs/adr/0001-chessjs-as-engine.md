# ADR-0001: Keep chess.js behind ChessEngine

## Status
Accepted

## Context
The project needs tournament-legal move validation, status detection, SAN history, FEN/PGN support, and a stable application-owned interface that both local AI play and planned online play can share.

## Decision
Use `chess.js` as the underlying rules engine, but never expose it directly to the rest of the application. All move application, legality checks, history generation, board mapping, and status queries flow through `src/chess/engine.ts` and its `ChessEngine` interface.

## Consequences
- The rest of the codebase depends on an application-owned module, not a third-party API.
- Tests focus on `ChessEngine` behavior rather than `chess.js` internals.
- Online multiplayer can validate moves with the same interface on both client and server.
- Replacing the underlying rules library later is possible without rewriting UI or session orchestration code.
