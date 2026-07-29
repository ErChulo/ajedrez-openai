// useGame hook — React-facing game state backed by a local session module.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardBridge } from '@/chess/view'
import { formatMs } from '@/features/clock/Clock'
import { LocalGameSession } from '@/features/session/localSession'
import { OnlineGameSession } from '@/features/session/onlineSession'
import { sounds } from '@/features/audio/sounds'
import { useAppStore } from '@/lib/store'
import type {
  ApplyMoveInput,
  GameSnapshot,
  Promotion,
  Side,
  Square,
} from '@/types'

export function useGame() {
  const boardBridgeRef = useRef<BoardBridge | null>(null)

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [clock, setClock] = useState<{ whiteMs: number; blackMs: number; active: Side | null }>({
    whiteMs: 0,
    blackMs: 0,
    active: null,
  })
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [legalTargets, setLegalTargets] = useState<Square[]>([])
  const [legalCaptures, setLegalCaptures] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [checkSquare, setCheckSquare] = useState<Square | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const moveErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const promotionResolveRef = useRef<((p: Promotion | null) => void) | null>(null)
  const [showPromotion, setShowPromotion] = useState(false)
  const [boardVersion, setBoardVersion] = useState(0)

  const {
    gameMode,
    humanSide,
    isAiThinking,
    soundEnabled,
    setIsAiThinking,
    setGameStatus,
    setGameResult,
    onlineRoomCode,
    onlineRole,
  } = useAppStore()

  const findKingSquare = useCallback((side: Side, nextSnapshot: GameSnapshot): Square | null => {
    const king = side === 'white' ? 'K' : 'k'
    const boardMap = nextSnapshot.history.at(-1)?.fen?.split(' ')[0]
    if (!boardMap) {
      const currentBoard = sessionRef.current.boardMap()
      for (const [sq, sym] of Object.entries(currentBoard)) {
        if (sym === king) return sq as Square
      }
      return null
    }

    const ranks = boardMap.split('/')
    for (let r = 0; r < 8; r++) {
      let file = 0
      for (const ch of ranks[r]) {
        if (/[1-8]/.test(ch)) {
          file += parseInt(ch, 10)
          continue
        }
        if (ch === king) return `${'abcdefgh'[file]}${8 - r}` as Square
        file += 1
      }
    }
    return null
  }, [])

  const clearSelectionState = useCallback(() => {
    setSelectedSquare(null)
    setLegalTargets([])
    setLegalCaptures([])
  }, [])

  type SessionLike = LocalGameSession | OnlineGameSession

  const sessionRef = useRef<SessionLike>(null as unknown as SessionLike)
  if (!sessionRef.current) {
    const baseOptions = {
      getSoundEnabled: () => useAppStore.getState().soundEnabled,
      getClockSettings: () => useAppStore.getState().clockSettings,
      setGameStatus,
      setGameResult,
      onSnapshot: (nextSnapshot: GameSnapshot) => {
        setSnapshot(nextSnapshot)
        setBoardVersion((version) => version + 1)
        setCheckSquare(nextSnapshot.inCheck ? findKingSquare(sessionRef.current.turn(), nextSnapshot) : null)
      },
      onClock: setClock,
      onAfterMove: (record: { from: Square; to: Square }) => {
        setLastMove({ from: record.from, to: record.to })
      },
      onClearSelection: clearSelectionState,
    }

    sessionRef.current = gameMode === 'online'
      ? new OnlineGameSession({
          ...baseOptions,
          roomCode: onlineRoomCode ?? '',
          role: onlineRole ?? 'spectator',
        })
      : new LocalGameSession({
          ...baseOptions,
          getHumanSide: () => useAppStore.getState().humanSide,
          getAiDifficulty: () => useAppStore.getState().aiDifficulty,
          setIsAiThinking,
        })
  }

  useEffect(() => {
    sessionRef.current.setBoardBridge(boardBridgeRef.current)
  }, [boardVersion])

  const handleMoveAttempt = useCallback((input: ApplyMoveInput) => {
    const session = sessionRef.current
    if (session.processing) return
    if (session.snapshot().status !== 'playing') return
    if (session.turn() !== humanSide) return

    const isLegal = session.isLegal(input) || session.isLegal({ from: input.from, to: input.to })
    if (!isLegal) {
      if (soundEnabled) sounds.play('illegal')
      if (moveErrorTimeoutRef.current) clearTimeout(moveErrorTimeoutRef.current)
      setMoveError('Illegal move')
      moveErrorTimeoutRef.current = setTimeout(() => setMoveError(null), 1500)
      return
    }

    const candidates = session.legalMovesFrom(input.from)
    const needsPromotion = candidates.some((candidate) => candidate.to === input.to && candidate.promotion)
    if (needsPromotion) {
      promotionResolveRef.current = (promotion) => {
        if (promotion) void session.applyMove({ ...input, promotion })
      }
      setShowPromotion(true)
      return
    }

    void session.applyMove(input)
  }, [humanSide, soundEnabled])

  const handleSelect = useCallback((square: Square) => {
    const session = sessionRef.current
    if (session.processing) return
    if (session.turn() !== humanSide) return

    const targets = session.legalMovesFrom(square)
    if (targets.length === 0) {
      clearSelectionState()
      boardBridgeRef.current?.clearSelection()
      return
    }

    const boardMap = session.boardMap()
    const simpleTargets = targets.map((target) => target.to)
    const captures: Square[] = []
    for (const target of targets) {
      const occupant = boardMap[target.to] ?? null
      if (!occupant) continue
      const isWhite = occupant === occupant.toUpperCase()
      const isOpponent = (humanSide === 'white' && !isWhite) || (humanSide === 'black' && isWhite)
      if (isOpponent) captures.push(target.to)
    }

    setSelectedSquare(square)
    setLegalTargets(simpleTargets)
    setLegalCaptures(captures)
    boardBridgeRef.current?.setLegalTargets(square, simpleTargets, captures)
  }, [clearSelectionState, humanSide])

  const handlePromotionChoice = useCallback((promotion: Promotion | null) => {
    promotionResolveRef.current?.(promotion)
    promotionResolveRef.current = null
    setShowPromotion(false)
    clearSelectionState()
    boardBridgeRef.current?.clearSelection()
  }, [clearSelectionState])

  const startGame = useCallback(() => {
    sessionRef.current.setBoardBridge(boardBridgeRef.current)
    void sessionRef.current.start()
  }, [])

  const resign = useCallback(() => {
    sessionRef.current.resign()
  }, [])

  const undoMove = useCallback(() => {
    sessionRef.current.undo(isAiThinking)
  }, [isAiThinking])

  useEffect(() => {
    return () => {
      sessionRef.current.cleanup()
    }
  }, [])

  const resetGame = useCallback(() => {
    sessionRef.current.reset()
    setSnapshot(null)
    setClock({ whiteMs: 0, blackMs: 0, active: null })
    clearSelectionState()
    setLastMove(null)
    setCheckSquare(null)
    setShowPromotion(false)
    promotionResolveRef.current = null
  }, [clearSelectionState])

  return {
    snapshot,
    clock,
    selectedSquare,
    legalTargets,
    legalCaptures,
    lastMove,
    checkSquare,
    showPromotion,
    moveError,
    handleMoveAttempt,
    handleSelect,
    handlePromotionChoice,
    startGame,
    resign,
    undoMove,
    resetGame,
    formatMs,
    boardBridgeRef,
    boardVersion,
    boardMap: sessionRef.current.boardMap(),
  }
}
