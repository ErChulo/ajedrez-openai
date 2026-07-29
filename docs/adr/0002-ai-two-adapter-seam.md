# ADR-0002: Preserve the AI seam as two adapters

## Status
Accepted

## Context
The application already supports computer play through Stockfish in a web worker, but it must remain functional when the worker or WASM payload fails to load.

## Decision
Keep AI behind the `AIAdapter` interface in `src/features/ai/stockfish.ts`, with two concrete adapters:
- `StockfishAI` for primary play strength
- `FallbackAI` for resilient degraded behavior

## Consequences
- The seam is real because two adapters already exist.
- UI and session code can request moves without caring which engine produced them.
- Tests can mock or substitute adapters cleanly.
- Future online or server-hosted engines can be introduced as another adapter without changing the caller contract.
