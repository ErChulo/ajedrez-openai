// Move history display — shows all played moves in standard notation.

import type { MoveRecord } from '@/types'
import styles from './MoveList.module.css'

interface MoveListProps {
  history: MoveRecord[]
}

export function MoveList({ history }: MoveListProps) {
  if (history.length === 0) {
    return (
      <div data-testid="move-list" className={styles.moveList} style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', padding: '12px' }}>
        No moves yet
      </div>
    )
  }

  const rows: { num: number; white: MoveRecord; black: MoveRecord | null }[] = []
  for (let i = 0; i < history.length; i += 2) {
    rows.push({
      num: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1] ?? null,
    })
  }

  return (
    <div data-testid="move-list" className={styles.moveList}>
      {rows.map((row) => (
        <div key={row.num} className={styles.moveRow}>
          <span className={styles.moveNum}>{row.num}.</span>
          <span className={styles.moveWhite}>{row.white.san}</span>
          <span className={styles.moveBlack}>{row.black?.san ?? ''}</span>
        </div>
      ))}
    </div>
  )
}
