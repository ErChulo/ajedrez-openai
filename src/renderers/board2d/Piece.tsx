// Piece component — renders an SVG chess piece with forward ref for GSAP animations.

import { forwardRef, memo } from 'react'
import type { PieceSymbol, PieceStyleId, Square } from '@/types'
import { renderPieceSvg } from './piece-styles'
import styles from './Board2D.module.css'

interface PieceProps {
  symbol: PieceSymbol
  square: Square
  pieceStyle: PieceStyleId
  isDragging?: boolean
}

export const PieceComponent = memo(forwardRef<HTMLDivElement, PieceProps>(
  function Piece({ symbol, pieceStyle, isDragging }, ref) {
    return (
      <div
        ref={ref}
        className={`${styles.piece} ${isDragging ? styles.pieceDragging : ''}`}
        data-piece={symbol}
        dangerouslySetInnerHTML={{ __html: renderPieceSvg(symbol, pieceStyle) }}
      />
    )
  }
))
