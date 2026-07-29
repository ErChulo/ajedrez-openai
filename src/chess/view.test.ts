import { describe, it, expectTypeOf } from 'vitest'
import type { ChessView, MoveKind } from './view'

describe('view contract', () => {
  it('exposes the expected move kinds', () => {
    expectTypeOf<MoveKind>().toEqualTypeOf<'move' | 'capture' | 'castle' | 'enpassant' | 'promote'>()
  })

  it('keeps ChessView as an imperative renderer contract', () => {
    expectTypeOf<ChessView['animateMove']>().toBeFunction()
    expectTypeOf<ChessView['clearSelection']>().toBeFunction()
    expectTypeOf<ChessView['setLegalTargets']>().toBeFunction()
  })
})
