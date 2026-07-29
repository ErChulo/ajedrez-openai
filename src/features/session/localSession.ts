import type { BoardBridge, MoveKind } from '@/chess/view'
import { ChessEngine } from '@/chess/engine'
import { sounds } from '@/features/audio/sounds'
import { createAI, type AIAdapter } from '@/features/ai/stockfish'
import { Clock } from '@/features/clock/Clock'
import type {
  AIDifficulty,
  ApplyMoveInput,
  ClockSettings,
  GameSnapshot,
  MoveRecord,
  Side,
  Square,
} from '@/types'

interface LocalGameSessionOptions {
  getHumanSide: () => Side
  getAiDifficulty: () => AIDifficulty
  getSoundEnabled: () => boolean
  getClockSettings: () => ClockSettings
  setIsAiThinking: (thinking: boolean) => void
  setGameStatus: (status: GameSnapshot['status']) => void
  setGameResult: (result: { winner: Side | null; reason: string } | null) => void
  onSnapshot: (snapshot: GameSnapshot) => void
  onClock: (clock: { whiteMs: number; blackMs: number; active: Side | null }) => void
  onAfterMove: (record: MoveRecord) => void
  onClearSelection: () => void
}

export class LocalGameSession {
  private engine = new ChessEngine()
  private ai: AIAdapter | null = null
  private clock: Clock | null = null
  private boardBridge: BoardBridge | null = null
  private isProcessing = false
  private aiThinkAbort: AbortController | null = null

  constructor(private readonly options: LocalGameSessionOptions) {}

  setBoardBridge(boardBridge: BoardBridge | null): void {
    this.boardBridge = boardBridge
  }

  snapshot(): GameSnapshot {
    return this.engine.snapshot()
  }

  boardMap() {
    return this.engine.boardMap()
  }

  turn(): Side {
    return this.engine.turn()
  }

  fen(): string {
    return this.engine.fen()
  }

  legalMovesFrom(square: Square) {
    return this.engine.legalMovesFrom(square)
  }

  isLegal(input: ApplyMoveInput): boolean {
    return this.engine.isLegal(input)
  }

  async applyMove(input: ApplyMoveInput): Promise<void> {
    this.isProcessing = true
    try {
      const record = this.engine.apply(input)
      const kind = this.inferKind(record)

      if (this.boardBridge) {
        await this.boardBridge.animateMove(record, { kind })
        if (kind === 'castle') {
          const rookMove = this.inferRookCastle(record)
          if (rookMove) await this.boardBridge.animateRookMove(rookMove.from, rookMove.to)
        }
      }

      if (this.options.getSoundEnabled()) {
        if (kind === 'capture' || kind === 'enpassant') sounds.play('capture')
        else if (kind === 'castle') sounds.play('castle')
        else if (kind === 'promote') sounds.play('promote')
        else sounds.play('move')
        if (this.engine.snapshot().inCheck) sounds.play('check')
      }

      const mover = this.engine.turn() === 'white' ? 'black' : 'white'
      this.clock?.applyMove(mover)
      this.publishClock()
      this.options.onAfterMove(record)
      this.options.onClearSelection()
      this.boardBridge?.clearSelection()
      this.publishSnapshot()

      const snapshot = this.engine.snapshot()
      if (snapshot.status !== 'playing') {
        this.clock?.finalize()
        if (this.options.getSoundEnabled()) sounds.play('gameEnd')
        if (snapshot.status === 'checkmate') {
          this.options.setGameResult({ winner: snapshot.winner, reason: 'Checkmate' })
        } else if (snapshot.status === 'stalemate') {
          this.options.setGameResult({ winner: null, reason: 'Stalemate' })
        } else {
          this.options.setGameResult({ winner: null, reason: 'Draw' })
        }
        return
      }

      if (this.engine.turn() !== this.options.getHumanSide()) {
        await this.kickoffAiThink()
      }
    } finally {
      this.isProcessing = false
    }
  }

  start(): void {
    this.engine = new ChessEngine()
    this.ai = null
    this.aiThinkAbort = null
    this.isProcessing = false

    const clockSettings = this.options.getClockSettings()
    this.clock = new Clock(clockSettings.initialSeconds, clockSettings.incrementSeconds, {
      onLowTime: () => {
        if (this.options.getSoundEnabled()) sounds.play('lowtime')
      },
      onFlag: (side) => {
        if (this.options.getSoundEnabled()) sounds.play('gameEnd')
        const winner = side === 'white' ? 'black' : 'white'
        this.options.setGameResult({ winner, reason: 'Timeout' })
        this.options.setGameStatus('timeout')
      },
    })

    this.options.onClearSelection()
    this.publishSnapshot()
    if (this.options.getSoundEnabled()) sounds.play('gameStart')

    this.clock.start(this.engine.turn())
    this.publishClock()

    if (this.engine.turn() !== this.options.getHumanSide()) {
      void this.kickoffAiThink()
    }
  }

  resign(): void {
    if (this.engine.snapshot().status !== 'playing') return
    if (this.options.getSoundEnabled()) sounds.play('gameEnd')
    const winner = this.options.getHumanSide() === 'white' ? 'black' : 'white'
    this.options.setGameResult({ winner, reason: 'Resignation' })
    this.options.setGameStatus('resigned')
    this.clock?.finalize()
  }

  undo(isAiThinking: boolean): void {
    if (this.engine.snapshot().history.length < 2) return
    if (isAiThinking) return
    if (this.engine.snapshot().status !== 'playing') return

    const lastMover = this.engine.turn() === 'white' ? 'black' : 'white'
    this.engine.undo()
    this.clock?.unapplyMove(lastMover)
    this.engine.undo()
    this.clock?.unapplyMove(lastMover === 'white' ? 'black' : 'white')

    this.options.onClearSelection()
    this.boardBridge?.clearSelection()
    this.publishSnapshot()
    this.publishClock()
  }

  reset(): void {
    this.aiThinkAbort?.abort()
    this.ai?.shutdown()
    this.clock?.pause()
    this.ai = null
    this.aiThinkAbort = null
    this.isProcessing = false
    this.engine = new ChessEngine()
    this.options.onClearSelection()
    this.options.onClock({ whiteMs: 0, blackMs: 0, active: null })
  }

  cleanup(): void {
    this.aiThinkAbort?.abort()
    this.ai?.shutdown()
    this.clock?.pause()
  }

  get processing(): boolean {
    return this.isProcessing
  }

  private publishSnapshot(): void {
    const snapshot = this.engine.snapshot()
    this.options.onSnapshot(snapshot)
    this.options.setGameStatus(snapshot.status)
  }

  private publishClock(): void {
    this.options.onClock(this.clock?.snapshot() ?? { whiteMs: 0, blackMs: 0, active: null })
  }

  private async kickoffAiThink(): Promise<void> {
    this.aiThinkAbort?.abort()
    const controller = new AbortController()
    this.aiThinkAbort = controller
    this.options.setIsAiThinking(true)

    try {
      if (!this.ai) {
        this.ai = await createAI()
      }
      const move = await this.ai.requestMove(this.engine.fen(), this.options.getAiDifficulty())
      if (controller.signal.aborted) return
      if (this.engine.snapshot().status !== 'playing') return
      if (!move) return
      if (!this.engine.isLegal(move)) return
      await this.applyMove(move)
    } catch {
    } finally {
      if (this.aiThinkAbort === controller) this.aiThinkAbort = null
      this.options.setIsAiThinking(false)
    }
  }

  private inferKind(record: MoveRecord): MoveKind {
    if (record.promotion) return 'promote'
    if (record.san === 'O-O' || record.san === 'O-O-O') return 'castle'
    if (record.captured) {
      if (/\be\.p\./.test(record.san)) return 'enpassant'
      return 'capture'
    }
    return 'move'
  }

  private inferRookCastle(record: MoveRecord): { from: Square; to: Square } | null {
    if (record.to === 'g1') return { from: 'h1', to: 'f1' }
    if (record.to === 'c1') return { from: 'a1', to: 'd1' }
    if (record.to === 'g8') return { from: 'h8', to: 'f8' }
    if (record.to === 'c8') return { from: 'a8', to: 'd8' }
    return null
  }
}
