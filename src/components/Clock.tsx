// Chess clock display — shows remaining time for both players.

import { Side } from '@/types'
import { formatMs } from '@/features/clock/Clock'
import styles from './Clock.module.css'

interface ClockDisplayProps {
  whiteMs: number
  blackMs: number
  active: Side | null
  playerSide: 'top' | 'bottom'
  playerName: string
}

export function ClockDisplay({ whiteMs, blackMs, active, playerSide, playerName }: ClockDisplayProps) {
  const isWhite = playerSide === 'bottom'
  const ms = isWhite ? whiteMs : blackMs
  const isActive = active === (isWhite ? 'white' : 'black')
  const isLow = ms <= 10_000 && ms > 0
  const isExpired = ms <= 0

  return (
    <div
      data-testid="clock-display"
      className={`${styles.clockDisplay} ${isActive ? styles.activeClock : ''}`}
    >
      <span className={styles.clockName}>{playerName}</span>
      <span
        className={styles.clockTime}
        style={{
          color: isExpired ? '#ff5a5a' : isLow ? '#ffeb78' : undefined,
        }}
      >
        {formatMs(ms)}
      </span>
    </div>
  )
}
