// Draw rules — FIDE draw logic for threefold repetition, 50-move rule, etc.
// Supplements chess.js with server-side verification logic.

import type { Side } from '@/types'

/**
 * Material required for checkmate. Returns true if the given side
 * could theoretically checkmate with their remaining material.
 */
export function canPossiblyCheckmate(material: string): boolean {
  const normalized = material.toUpperCase().replace(/K/g, '')
  if (normalized.length === 0) return false
  if (normalized === 'B' || normalized === 'N') return false
  return true
}

/**
 * Check if a position is a dead position (no possible checkmate).
 * FIDE Article 9.6.
 */
export function isDeadPosition(
  boardMap: Record<string, string | null>,
): boolean {
  const pieces = Object.values(boardMap).filter(Boolean)
  if (pieces.length <= 2) return true // King vs King
  if (pieces.length === 3) {
    // King + Bishop vs King or King + Knight vs King
    const hasBishop = pieces.some((p) => p?.toLowerCase() === 'b')
    const hasKnight = pieces.some((p) => p?.toLowerCase() === 'n')
    if (hasBishop || hasKnight) return true
  }
  return false
}

/**
 * Resolve timeout result — award win only when opponent could possibly checkmate.
 * FIDE Article 6.9.
 */
export function resolveTimeoutResult(
  boardMap: Record<string, string | null>,
  timeoutSide: Side,
): { winner: Side; reason: string } | { winner: null; reason: string } {
  const opponentPieces = Object.entries(boardMap)
    .filter(([_, p]) => {
      if (!p) return false
      const isOpponentWhite = p === p.toUpperCase()
      return timeoutSide === 'white' ? !isOpponentWhite : isOpponentWhite
    })
    .map(([_, p]) => p!)
    .filter((p) => p.toLowerCase() !== 'k')

  const material = opponentPieces.join('')
  if (!canPossiblyCheckmate(material)) {
    return { winner: null, reason: 'Timeout - insufficient material' }
  }
  const winner = timeoutSide === 'white' ? 'black' : 'white'
  return { winner, reason: 'Timeout' }
}
