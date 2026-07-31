// Square component — renders a single board square with highlights and coordinates.

import { memo, type ReactNode } from 'react'
import type { Square } from '@/types'
import styles from './Board2D.module.css'

interface SquareProps {
  square: Square
  isLight: boolean
  background: string
  isSelected: boolean
  isTarget: boolean
  isCapture: boolean
  isLastMove: boolean
  isCheck: boolean
  showFile: boolean
  showRank: boolean
  fileLabel: string
  rankLabel: string
  lightColor: string
  darkColor: string
  onClick: () => void
  onPointerDown: (e: React.PointerEvent) => void
  children?: ReactNode
}

export const SquareComponent = memo(function Square({
  square,
  isLight,
  background,
  isSelected,
  isTarget,
  isCapture,
  isLastMove,
  isCheck,
  showFile,
  showRank,
  fileLabel,
  rankLabel,
  lightColor,
  darkColor,
  onClick,
  onPointerDown,
  children,
}: SquareProps) {
  const className = [
    styles.square,
    isSelected && styles.squareSelected,
    isTarget && !isCapture && styles.squareTarget,
    isCapture && styles.squareCapture,
    isLastMove && styles.squareLastMove,
    isCheck && styles.squareCheck,
  ].filter(Boolean).join(' ')

  const coordColor = isLight ? darkColor : lightColor

  return (
    <div
      className={className}
      data-square={square}
      data-testid="square"
      style={{ background }}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      {showRank && (
        <span className={styles.coordinate} style={{ top: 2, left: 3, color: coordColor }}>
          {rankLabel}
        </span>
      )}
      {showFile && (
        <span className={styles.coordinate} style={{ bottom: 2, right: 3, color: coordColor }}>
          {fileLabel}
        </span>
      )}
      {children}
    </div>
  )
})
