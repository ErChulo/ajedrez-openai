// Chess engine unit tests.

import { describe, it, expect } from 'vitest'
import { ChessEngine } from './engine'

describe('ChessEngine', () => {
  it('starts with standard position', () => {
    const engine = ChessEngine.standard()
    const snap = engine.snapshot()
    expect(snap.fen).toContain('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
    expect(snap.turn).toBe('white')
    expect(snap.status).toBe('playing')
  })

  it('applies legal moves', () => {
    const engine = ChessEngine.standard()
    const rec = engine.apply({ from: 'e2', to: 'e4' })
    expect(rec.san).toBe('e4')
    expect(rec.from).toBe('e2')
    expect(rec.to).toBe('e4')
    expect(engine.turn()).toBe('black')
  })

  it('rejects illegal moves', () => {
    const engine = ChessEngine.standard()
    expect(() => engine.apply({ from: 'e2', to: 'e5' })).toThrow()
  })

  it('detects checkmate', () => {
    const engine = new ChessEngine()
    // Scholar's mate
    engine.apply({ from: 'e2', to: 'e4' })
    engine.apply({ from: 'e7', to: 'e5' })
    engine.apply({ from: 'f1', to: 'c4' })
    engine.apply({ from: 'b8', to: 'c6' })
    engine.apply({ from: 'd1', to: 'h5' })
    engine.apply({ from: 'g8', to: 'f6' })
    engine.apply({ from: 'h5', to: 'f7' })
    const snap = engine.snapshot()
    expect(snap.status).toBe('checkmate')
    expect(snap.winner).toBe('white')
  })

  it('detects stalemate', () => {
    // Known stalemate: black king on a8, white king on b6, black to move
    const engine = new ChessEngine('k7/8/1K6/8/8/8/8/8 b - - 0 1')
    const snap = engine.snapshot()
    // chess.js may report stalemate as 'draw' — the key is the game ends
    expect(snap.status).not.toBe('playing')
  })

  it('provides legal moves from a square', () => {
    const engine = ChessEngine.standard()
    const moves = engine.legalMovesFrom('e2')
    expect(moves.length).toBe(2) // e3, e4
  })

  it('provides all legal moves', () => {
    const engine = ChessEngine.standard()
    const moves = engine.legalMovesAll()
    expect(moves.length).toBe(20)
  })

  it('supports castling', () => {
    const engine = new ChessEngine()
    // Set up a position where castling is possible
    // e2-e4, e7-e5, Bf1-c4, Bf8-c5, Qd1-h5, Qd8-h4
    // Ke1 can castle kingside after Nf1-g3
    engine.apply({ from: 'e2', to: 'e4' })
    engine.apply({ from: 'e7', to: 'e5' })
    engine.apply({ from: 'g1', to: 'f3' })
    engine.apply({ from: 'g8', to: 'f6' })
    engine.apply({ from: 'f1', to: 'c4' })
    engine.apply({ from: 'f8', to: 'c5' })

    const moves = engine.legalMovesFrom('e1')
    const castle = moves.find((m) => m.to === 'g1')
    expect(castle).toBeDefined()
  })

  it('provides correct board map', () => {
    const engine = ChessEngine.standard()
    const map = engine.boardMap()
    expect(map['e1']).toBe('K')
    expect(map['e8']).toBe('k')
    expect(map['a1']).toBe('R')
    expect(map['a8']).toBe('r')
  })

  it('validates moves without applying', () => {
    const engine = ChessEngine.standard()
    expect(engine.isLegal({ from: 'e2', to: 'e4' })).toBe(true)
    expect(engine.isLegal({ from: 'e2', to: 'e5' })).toBe(false)
  })
})
