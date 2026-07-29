import { describe, it, expect } from 'vitest'
import { canPossiblyCheckmate, isDeadPosition, resolveTimeoutResult } from './draw-rules'

describe('draw-rules', () => {
  it('detects insufficient mating material', () => {
    expect(canPossiblyCheckmate('')).toBe(false)
    expect(canPossiblyCheckmate('B')).toBe(false)
    expect(canPossiblyCheckmate('N')).toBe(false)
  })

  it('detects material that can still mate', () => {
    expect(canPossiblyCheckmate('Q')).toBe(true)
    expect(canPossiblyCheckmate('R')).toBe(true)
    expect(canPossiblyCheckmate('BN')).toBe(true)
    expect(canPossiblyCheckmate('BBQ')).toBe(true)
    expect(canPossiblyCheckmate('RP')).toBe(true)
  })

  it('detects dead positions', () => {
    expect(isDeadPosition({ e1: 'K', e8: 'k' })).toBe(true)
    expect(isDeadPosition({ e1: 'K', e8: 'k', c1: 'B' })).toBe(true)
    expect(isDeadPosition({ e1: 'K', e8: 'k', a1: 'R' })).toBe(false)
  })

  it('resolves timeout as draw when opponent lacks mating material', () => {
    const result = resolveTimeoutResult({ e1: 'K', e8: 'k', c8: 'b' }, 'white')
    expect(result).toEqual({ winner: null, reason: 'Timeout - insufficient material' })
  })

  it('resolves timeout as loss when opponent can still mate', () => {
    const result = resolveTimeoutResult({ e1: 'K', e8: 'k', a8: 'r', h8: 'p' }, 'white')
    expect(result).toEqual({ winner: 'black', reason: 'Timeout' })
  })
})
