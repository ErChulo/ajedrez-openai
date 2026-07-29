// 2D Chess Board — declarative React rendering + GSAP animations.
// Squares and pieces are React components. Animations use imperative DOM refs.

import { useRef, useCallback, useEffect, useState, type MutableRefObject } from 'react'
import gsap from 'gsap'
import type { BoardBridge } from '@/chess/view'
import type {
  ApplyMoveInput,
  MoveRecord,
  PieceSymbol,
  Side,
  Square,
  ThemeName,
  PieceStyleId,
} from '@/types'
import { THEMES } from '@/features/themes'
import { SquareComponent } from './Square'
import { PieceComponent } from './Piece'
import styles from './Board2D.module.css'

interface Board2DProps {
  board: Record<Square, PieceSymbol | null>
  theme: ThemeName
  pieceStyle: PieceStyleId
  flipped: boolean
  selectable: Side | null
  lastMove?: { from: Square; to: Square } | null
  checkSquare?: Square | null
  onMoveAttempt: (input: ApplyMoveInput) => void
  onSelect: (sq: Square) => void
  boardBridgeRef?: MutableRefObject<BoardBridge | null>
}

export function Board2D({
  board,
  theme,
  pieceStyle,
  flipped,
  selectable,
  lastMove,
  checkSquare,
  onMoveAttempt,
  onSelect,
  boardBridgeRef,
}: Board2DProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const pieceRefsMap = useRef<Map<Square, HTMLDivElement>>(new Map())
  const resolversRef = useRef<Set<() => void>>(new Set())
  const [selectedSq, setSelectedSq] = useState<Square | null>(null)
  const [draggingSq, setDraggingSq] = useState<Square | null>(null)
  const selectedSqRef = useRef<Square | null>(null)

  const themeData = THEMES[theme]

  const squareName = useCallback(
    (row: number, col: number): Square => {
      if (flipped) return `${'hgfedcba'[col]}${row + 1}` as Square
      return `${'abcdefgh'[col]}${8 - row}` as Square
    },
    [flipped],
  )

  const canControlSide = useCallback(
    (sq: Square): boolean => {
      if (!selectable) return false
      const sym = board[sq]
      if (!sym) return false
      const isWhite = sym === sym.toUpperCase()
      return (selectable === 'white' && isWhite) || (selectable === 'black' && !isWhite)
    },
    [selectable, board],
  )


  // ---- Click handler ----
  const handleSquareClick = useCallback((sq: Square) => {
    if (!selectable) return

    if (selectedSqRef.current && sq !== selectedSqRef.current) {
      onMoveAttempt({ from: selectedSqRef.current, to: sq })
      setSelectedSq(null)
      selectedSqRef.current = null
      return
    }

    if (canControlSide(sq)) {
      setSelectedSq(sq)
      selectedSqRef.current = sq
      onSelect(sq)
    } else if (selectedSqRef.current) {
      onMoveAttempt({ from: selectedSqRef.current, to: sq })
      setSelectedSq(null)
      selectedSqRef.current = null
    }
  }, [selectable, canControlSide, onMoveAttempt, onSelect])

  // ---- Pointer down handler (drag start) ----
  const handlePointerDown = useCallback((e: React.PointerEvent, sq: Square) => {
    if (!selectable || !canControlSide(sq)) return
    e.preventDefault()

    const sym = board[sq]
    if (!sym) return

    setDraggingSq(sq)
    setSelectedSq(sq)
    selectedSqRef.current = sq
    onSelect(sq)

    // Create ghost element
    const ghostEl = document.createElement('div')
    ghostEl.className = styles.pieceGhost
    ghostEl.innerHTML = `<svg viewBox="0 0 45 45"><g fill="${sym === sym.toUpperCase() ? '#f5f0e1' : '#2c2c2c'}" stroke="${sym === sym.toUpperCase() ? '#333' : '#ccc'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></g></svg>`
    ghostEl.style.left = `${e.clientX - 30}px`
    ghostEl.style.top = `${e.clientY - 30}px`
    document.body.appendChild(ghostEl)

    const onMove = (ev: PointerEvent) => {
      ghostEl.style.left = `${ev.clientX - 30}px`
      ghostEl.style.top = `${ev.clientY - 30}px`
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      ghostEl.remove()
      setDraggingSq(null)
    }

    const onUp = (ev: PointerEvent) => {
      cleanup()
      const dropEl = document.elementFromPoint(ev.clientX, ev.clientY)
      const dropSq = dropEl?.closest?.('[data-square]')?.getAttribute('data-square') as Square | undefined
      if (dropSq && dropSq !== sq) {
        onMoveAttempt({ from: sq, to: dropSq })
        setSelectedSq(null)
        selectedSqRef.current = null
      }
    }

    const onCancel = () => cleanup()

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    window.addEventListener('pointercancel', onCancel, { once: true })
  }, [selectable, canControlSide, board, onMoveAttempt, onSelect])

  // ---- Expose imperative API for animations ----
  useEffect(() => {
    if (!boardBridgeRef) return
    boardBridgeRef.current = {
      animateMove: async (
        rec: MoveRecord,
        kind: { kind: 'move' | 'capture' | 'castle' | 'enpassant' | 'promote' },
      ): Promise<void> => {
        const fromEl = pieceRefsMap.current.get(rec.from)
        const toSquare = boardRef.current?.querySelector(`[data-square="${rec.to}"]`)
        if (!fromEl || !toSquare) return

        // Handle capture — fade out captured piece
        const existingCaptured = toSquare.querySelector(`[data-piece]`) as HTMLDivElement | null
        if (existingCaptured && kind.kind !== 'castle' && existingCaptured !== fromEl) {
          const isCaptureKind = kind.kind === 'capture' || kind.kind === 'enpassant' || kind.kind === 'promote'
          if (isCaptureKind) {
            await new Promise<void>((done) => {
              resolversRef.current.add(done)
              gsap.to(existingCaptured, {
                scale: 0.2, opacity: 0, duration: 0.22, ease: 'power2.in',
                onComplete: () => { resolversRef.current.delete(done); done() },
              })
            })
          }
        }

        // Animate piece movement
        const fromRect = fromEl.getBoundingClientRect()
        const toRect = toSquare.getBoundingClientRect()
        const dx = toRect.left - fromRect.left
        const dy = toRect.top - fromRect.top

        fromEl.style.zIndex = '5'
        await new Promise<void>((done) => {
          resolversRef.current.add(done)
          gsap.to(fromEl, {
            x: dx, y: dy, duration: 0.25, ease: 'power2.out',
            onComplete: () => {
              resolversRef.current.delete(done)
              fromEl.style.zIndex = ''
              fromEl.style.transform = ''
              done()
            },
          })
        })

        // Promotion transform
        if (kind.kind === 'promote' && rec.promotion) {
          await new Promise<void>((done) => {
            resolversRef.current.add(done)
            gsap.fromTo(fromEl, { scale: 0.4, opacity: 0.3 }, {
              scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)',
              onComplete: () => { resolversRef.current.delete(done); done() },
            })
          })
        }
      },

      // Animate rook during castling
      animateRookMove: (from: Square, to: Square): Promise<void> => {
        return new Promise((resolve) => {
          const el = pieceRefsMap.current.get(from)
          const dst = boardRef.current?.querySelector(`[data-square="${to}"]`)
          if (!el || !dst) return resolve()

          const fromRect = el.getBoundingClientRect()
          const toRect = dst.getBoundingClientRect()
          const dx = toRect.left - fromRect.left
          const dy = toRect.top - fromRect.top

          resolversRef.current.add(resolve)
          gsap.to(el, {
            x: dx, y: dy, duration: 0.3, ease: 'power2.out',
            onComplete: () => {
              resolversRef.current.delete(resolve)
              el.style.transform = ''
              resolve()
            },
          })
        })
      },

      // Set legal targets (called by useGame)
      setLegalTargets: (origin: Square, _targets: Square[], _captures: Square[]) => {
        setSelectedSq(origin)
        selectedSqRef.current = origin
      },

      // Clear selection (called by useGame)
      clearSelection: () => {
        setSelectedSq(null)
        selectedSqRef.current = null
      },
    }
    return () => {
      if (boardBridgeRef.current) boardBridgeRef.current = null
    }
  }, [boardBridgeRef])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const el of pieceRefsMap.current.values()) gsap.killTweensOf(el)
      for (const r of resolversRef.current) r()
      resolversRef.current.clear()
    }
  }, [])

  // Generate squares
  const squares = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8)
    const col = i % 8
    const sq = squareName(row, col)
    const isLight = (row + col) % 2 === 1
    const bg = isLight ? themeData.boardLight : themeData.boardDark
    const piece = board[sq] ?? null

    return {
      sq,
      row,
      col,
      isLight,
      bg,
      piece,
      isSelected: selectedSq === sq,
      isTarget: false, // Will be set by useGame via highlightSquares
      isCapture: false,
      isLastMove: lastMove?.from === sq || lastMove?.to === sq,
      isCheck: checkSquare === sq,
    }
  })

  return (
    <div
      ref={boardRef}
      className={styles.board2d}
      data-testid="board-2d"
      data-selectable-side={selectable ?? 'none'}
      style={{ border: `3px solid ${themeData.accent}` }}
    >
      {squares.map(({ sq, row, col, isLight, bg, piece, isSelected, isLastMove, isCheck }) => (
        <SquareComponent
          key={sq}
          square={sq}
          isLight={isLight}
          background={bg}
          isSelected={isSelected}
          isTarget={false}
          isCapture={false}
          isLastMove={isLastMove}
          isCheck={isCheck}
          showFile={row === 7}
          showRank={col === 0}
          fileLabel={flipped ? 'hgfedcba'[col] : 'abcdefgh'[col]}
          rankLabel={String(8 - row)}
          lightColor={themeData.boardLight}
          darkColor={themeData.boardDark}
          onClick={() => handleSquareClick(sq)}
          onPointerDown={(e) => handlePointerDown(e, sq)}
        >
          {piece && (
            <PieceComponent
              ref={(el) => {
                if (el) pieceRefsMap.current.set(sq, el)
                else pieceRefsMap.current.delete(sq)
              }}
              symbol={piece}
              square={sq}
              pieceStyle={pieceStyle}
              isDragging={draggingSq === sq}
            />
          )}
        </SquareComponent>
      ))}
    </div>
  )
}
