// ChessView interface — abstract contract shared by 2D and 3D board renderers.
// The Game controller interacts only through this interface.

import type {
  MoveRecord,
  Promotion,
  Side,
  Square,
} from '@/types'

export type MoveKind = 'move' | 'capture' | 'castle' | 'enpassant' | 'promote'

export interface BoardBridge {
  animateMove(rec: MoveRecord, animate: { kind: MoveKind }): Promise<void>
  animateRookMove(from: Square, to: Square): Promise<void>
  setLegalTargets(origin: Square, targets: Square[], captures?: Square[]): void
  clearSelection(): void
}

export interface ChessView {
  redraw(board: Record<Square, string | null>): void
  animateMove(
    rec: MoveRecord,
    animate: { kind: MoveKind },
  ): Promise<void>
  animateRookMove(from: Square, to: Square): Promise<void>
  setSelectable(side: Side | null): void
  setLegalTargets(origin: Square, targets: Square[], captures: Square[]): void
  setLastMove(from?: Square, to?: Square): void
  setCheck(square: Square | null): void
  awaitPromotion(from: Square, to: Square): Promise<Promotion | null>
  flashIllegal(sq: Square): void
  clearSelection(): void
  highlightFromSquare(sq: Square): void
  setHint(from: Square, to: Square): void
  setFlipped(flipped: boolean): void
}
