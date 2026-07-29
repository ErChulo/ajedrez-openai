import type { BoardBridge, MoveKind } from '@/chess/view'
import { ChessEngine } from '@/chess/engine'
import { sounds } from '@/features/audio/sounds'
import { Clock } from '@/features/clock/Clock'
import {
  applyOnlineMove,
  finishOnlineRoom,
  getOnlineRoomByCode,
  subscribeRoom,
  type RoomSubscription,
  NotYourTurnError,
  RoomInactiveError,
  StalePositionError,
} from '@/features/session/rooms'
import type {
  ApplyMoveInput,
  ClockSettings,
  GameSnapshot,
  MoveRecord,
  OnlineRoomSummary,
  Side,
  Square,
} from '@/types'

interface OnlineGameSessionOptions {
  roomCode: string
  role: Side | 'spectator'
  getSoundEnabled: () => boolean
  getClockSettings: () => ClockSettings
  setGameStatus: (status: GameSnapshot['status']) => void
  setGameResult: (result: { winner: Side | null; reason: string } | null) => void
  onSnapshot: (snapshot: GameSnapshot) => void
  onClock: (clock: { whiteMs: number; blackMs: number; active: Side | null }) => void
  onAfterMove: (record: MoveRecord) => void
  onClearSelection: () => void
}

function parsePgnToSans(pgn: string): string[] {
  return pgn
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^\d+\.{1,3}$/.test(token))
    .filter((token) => !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token))
}

function statusFromResultReason(reason: string | null, fallback: GameSnapshot['status']): GameSnapshot['status'] {
  if (reason === 'Checkmate') return 'checkmate'
  if (reason === 'Stalemate') return 'stalemate'
  if (reason === 'Draw') return 'draw'
  if (reason === 'Resignation') return 'resigned'
  if (reason === 'Timeout') return 'timeout'
  if (reason === 'Abandoned' || reason === 'Opponent left') return 'aborted'
  return fallback
}

export class OnlineGameSession {
  private engine = new ChessEngine()
  private clock: Clock | null = null
  private boardBridge: BoardBridge | null = null
  private isProcessing = false
  private subscription: RoomSubscription | null = null
  private finished = false

  constructor(private readonly options: OnlineGameSessionOptions) {}

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

  get processing(): boolean {
    return this.isProcessing
  }

  async start(): Promise<void> {
    this.engine = new ChessEngine()
    this.finished = false

    const settings = this.options.getClockSettings()
    this.clock = new Clock(settings.initialSeconds, settings.incrementSeconds, {
      onLowTime: () => {
        if (this.options.getSoundEnabled()) sounds.play('lowtime')
      },
      onFlag: (side) => {
        if (this.options.getSoundEnabled()) sounds.play('gameEnd')
        if (this.options.role === side) void this.reportResult('timeout', side === 'white' ? 'black' : 'white', 'Timeout')
      },
    })

    this.options.onClearSelection()
    this.publishSnapshot()
    this.publishClock()
    if (this.options.getSoundEnabled()) sounds.play('gameStart')

    const room = await getOnlineRoomByCode(this.options.roomCode)
    if (!room) {
      this.options.setGameStatus('aborted')
      this.options.setGameResult({ winner: null, reason: 'Room not found' })
      return
    }

    this.subscribe(room.id)
    this.syncFromRoom(room)

    if (!this.finished) {
      this.clock.start(this.engine.turn())
      this.publishClock()
    }
  }

  async applyMove(input: ApplyMoveInput): Promise<void> {
    if (this.options.role === 'spectator') return
    if (this.isProcessing) return
    if (this.engine.snapshot().status !== 'playing') return
    if (this.engine.turn() !== this.options.role) return

    this.isProcessing = true
    try {
      const priorFen = this.engine.fen()
      const record = this.engine.apply(input)
      await this.animateAndPublish(record)

      try {
        const room = await applyOnlineMove(this.options.roomCode, this.options.role, priorFen, input)
        this.syncFromRoom(room)
      } catch (error) {
        if (error instanceof StalePositionError || error instanceof NotYourTurnError || error instanceof RoomInactiveError) {
          await this.recoverFromServer()
          if (this.options.getSoundEnabled()) sounds.play('illegal')
          return
        }
        throw error
      }

      const snapshot = this.engine.snapshot()
      if (snapshot.status !== 'playing') {
        await this.reportResult(statusFromResultReason(snapshot.status === 'checkmate' ? 'Checkmate' : snapshot.status === 'stalemate' ? 'Stalemate' : 'Draw', snapshot.status), snapshot.winner, snapshot.status === 'checkmate' ? 'Checkmate' : snapshot.status === 'stalemate' ? 'Stalemate' : 'Draw')
      }
    } finally {
      this.isProcessing = false
    }
  }

  resign(): void {
    if (this.finished) return
    if (this.options.role === 'spectator') return
    if (this.engine.snapshot().status !== 'playing') return
    if (this.options.getSoundEnabled()) sounds.play('gameEnd')
    void this.reportResult('resigned', this.options.role === 'white' ? 'black' : 'white', 'Resignation')
  }

  undo(_isAiThinking: boolean): void {}

  reset(): void {
    this.subscription?.unsubscribe()
    this.subscription = null
    this.clock?.pause()
    this.engine = new ChessEngine()
    this.finished = false
    this.isProcessing = false
    this.options.onClearSelection()
    this.options.onClock({ whiteMs: 0, blackMs: 0, active: null })
  }

  cleanup(): void {
    this.subscription?.unsubscribe()
    this.subscription = null
    this.clock?.pause()
  }

  private subscribe(roomId: string): void {
    this.subscription?.unsubscribe()
    this.subscription = subscribeRoom(roomId, (room) => {
      void this.handleRoomUpdate(room)
    })
  }

  private async handleRoomUpdate(room: OnlineRoomSummary): Promise<void> {
    if (room.status === 'finished' || room.status === 'aborted') {
      this.syncFromRoom(room)
      return
    }
    if (this.isProcessing) return
    this.syncFromRoom(room)
  }

  private syncFromRoom(room: OnlineRoomSummary): void {
    const beforeHistoryLength = this.engine.snapshot().history.length
    const beforeFen = this.engine.fen()

    this.engine = new ChessEngine()
    let lastRecord: MoveRecord | null = null
    for (const san of parsePgnToSans(room.pgn)) {
      lastRecord = this.engine.applySan(san)
    }

    if (this.clock) {
      if (room.status === 'finished' || room.status === 'aborted') this.clock.finalize()
      else {
        const clockSnapshot = this.clock.snapshot()
        if (clockSnapshot.active === null) this.clock.start(this.engine.turn())
        else this.clock.resume(this.engine.turn())
      }
    }

    const historyLength = this.engine.snapshot().history.length
    if (lastRecord && (beforeFen !== room.fen || historyLength > beforeHistoryLength)) {
      this.options.onAfterMove(lastRecord)
    }

    if (room.status === 'finished' || room.status === 'aborted') {
      this.finished = true
      this.options.setGameStatus(statusFromResultReason(room.resultReason, room.status === 'aborted' ? 'aborted' : this.engine.snapshot().status))
      this.options.setGameResult({
        winner: room.winner,
        reason: room.resultReason ?? (room.status === 'aborted' ? 'Aborted' : 'Finished'),
      })
    } else {
      this.finished = false
      this.publishSnapshot()
      this.publishClock()
    }
  }

  private async recoverFromServer(): Promise<void> {
    const room = await getOnlineRoomByCode(this.options.roomCode)
    if (!room) {
      this.options.setGameStatus('aborted')
      this.options.setGameResult({ winner: null, reason: 'Room not found' })
      return
    }
    this.syncFromRoom(room)
  }

  private async reportResult(status: GameSnapshot['status'], winner: Side | null, reason: string): Promise<void> {
    this.finished = true
    this.clock?.finalize()
    this.options.setGameStatus(status)
    this.options.setGameResult({ winner, reason })
    try {
      await finishOnlineRoom(this.options.roomCode, status === 'aborted' ? 'aborted' : 'finished', winner, reason)
    } catch {
    }
  }

  private async animateAndPublish(record: MoveRecord): Promise<void> {
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
  }

  private publishSnapshot(): void {
    const snapshot = this.engine.snapshot()
    this.options.onSnapshot(snapshot)
    this.options.setGameStatus(snapshot.status)
  }

  private publishClock(): void {
    this.options.onClock(this.clock?.snapshot() ?? { whiteMs: 0, blackMs: 0, active: null })
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
