// Promotion picker — shows piece options when a pawn reaches the last rank.

import type { Promotion, Side, PieceSymbol } from '@/types'
import styles from './PromotionPicker.module.css'

interface PromotionPickerProps {
  side: Side
  onSelect: (choice: Promotion | null) => void
}

const PIECE_OPTIONS: { promo: Promotion; symbol: PieceSymbol }[] = [
  { promo: 'q', symbol: 'Q' },
  { promo: 'r', symbol: 'R' },
  { promo: 'b', symbol: 'B' },
  { promo: 'n', symbol: 'N' },
]

export function PromotionPicker({ side, onSelect }: PromotionPickerProps) {
  const isWhite = side === 'white'
  const fill = isWhite ? '#f5f0e1' : '#2c2c2c'
  const stroke = isWhite ? '#333' : '#ccc'

  return (
    <div
      className={styles.promotionOverlay}
      onClick={(e) => e.stopPropagation()}
    >
  {PIECE_OPTIONS.map(({ promo, symbol }) => {
    const vb = '0 0 45 45'
    return (
      <button
        key={promo}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(promo)
        }}
        className={styles.promoBtn}
        aria-label={`Promote to ${symbol}`}
      >
        <svg viewBox={vb} style={{ width: '100%', height: '100%' }}>
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={PROMO_PATHS[symbol]} />
          </g>
        </svg>
      </button>
    )
  })}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSelect(null)
        }}
        className={styles.cancelBtn}
        aria-label="Cancel promotion"
      >
        ×
      </button>
    </div>
  )
}

// Fallback paths for envelope styles (Cburnett-based)
const PROMO_PATHS: Record<string, string> = {
  Q: 'M8.5 13.5L11 16l3-3 3 3 3-3 3 3 3-3 3 3 2.5-2.5L31 16l-2 2v9c0 2.5-1.5 4.5-4 5.5-2 1-4 1-6 1s-4 0-6-1c-2.5-1-4-3-4-5.5v-9l-2-2z',
  R: 'M9 39h27v-3H9v3zm3.5-7l1.5-2.5h17l1.5 2.5h-20zm-.5-27v3h3v-3h-3zm9 0v3h3v-3h-3zm9 0v3h3v-3h-3zm-9 4.5V9h12v4.5h-12zM7 33.5l2-5h26l2 5H7z',
  B: 'M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0-.5-4-3-7-3-12 0-5 3-9 3-12 0-2-2-3-4-3-3.5 0-5 3-7 3-1 0-2-1-2-2 0-1 .5-2 .5-2-1.5 1-3 4-3 7 0 5 3 9 3 12 0 5-2.5 8-3 12z',
  N: 'M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-5.5 6-8 9-8z',
}
