// Stockfish AI adapter — spawns a Web Worker running Stockfish WASM.
// Falls back to a random-move engine if Stockfish fails to load.

import { ChessEngine } from '@/chess/engine'
import type { AIDifficulty, ApplyMoveInput } from '@/types'

export type AIEngineKind = 'stockfish' | 'fallback'

export interface AIAdapter {
  readonly kind: AIEngineKind
  requestMove(fen: string, difficulty: AIDifficulty): Promise<ApplyMoveInput | null>
  cancel(): void
  shutdown(): void
}

const SKILL_BY_LEVEL: Record<AIDifficulty, number> = {
  beginner: 1,
  easy: 5,
  intermediate: 10,
  advanced: 15,
  expert: 20,
}

const TIME_BY_LEVEL_MS: Record<AIDifficulty, number> = {
  beginner: 200,
  easy: 400,
  intermediate: 800,
  advanced: 1500,
  expert: 4000,
}

export class StockfishAI implements AIAdapter {
  public readonly kind: AIEngineKind = 'stockfish'
  private worker: Worker | null = null
  private ready = false
  private startingPromise: Promise<boolean> | null = null

  async requestMove(
    fen: string,
    difficulty: AIDifficulty,
  ): Promise<ApplyMoveInput | null> {
    const booted = await this.ensureStarted()
    if (!booted || !this.worker) return null
    return new Promise((resolve) => {
      const w = this.worker!
      const skill = SKILL_BY_LEVEL[difficulty] ?? 10
      const moveTime = TIME_BY_LEVEL_MS[difficulty] ?? 800

      const onMsg = (e: MessageEvent) => {
        const line: string =
          typeof e.data === 'string'
            ? e.data
            : (e.data as { line?: string })?.line ?? ''
        if (line.startsWith('bestmove') || line.startsWith('engine_load_failed')) {
          w.removeEventListener('message', onMsg)
          if (line.startsWith('engine_load_failed') || line === 'bestmove (none)')
            return resolve(null)
          const uci = line.split(/\s+/)[1]
          if (!uci || uci === '(none)') return resolve(null)
          const from = uci.slice(0, 2)
          const to = uci.slice(2, 4)
          const promotion = (uci.length === 5 ? uci[4] : undefined) as
            | ApplyMoveInput['promotion']
          resolve({
            from: from as ApplyMoveInput['from'],
            to: to as ApplyMoveInput['to'],
            promotion,
          })
        }
      }
      w.addEventListener('message', onMsg)
      try {
        w.postMessage(`setoption name Skill Level value ${skill}`)
        w.postMessage(`position fen ${fen}`)
        w.postMessage(`go movetime ${moveTime}`)
      } catch {
        resolve(null)
      }
    })
  }

  cancel(): void {
    if (!this.worker) return
    try {
      this.worker.postMessage('stop')
    } catch {
      /* worker may be terminating */
    }
  }

  shutdown(): void {
    this.worker?.terminate()
    this.worker = null
    this.ready = false
    this.startingPromise = null
  }

  async ensureStarted(): Promise<boolean> {
    if (this.ready && this.worker) return true
    if (this.startingPromise) return this.startingPromise
    this.startingPromise = new Promise<boolean>((resolve) => {
      try {
        const w = new Worker('/stockfish-bridge.js')
        const timeout = window.setTimeout(() => {
          w.removeEventListener('message', onMsg)
          w.removeEventListener('message', onReady)
          w.terminate()
          this.worker = null
          this.ready = false
          resolve(false)
        }, 2500)
        const finish = (ok: boolean) => {
          window.clearTimeout(timeout)
          this.worker = w
          this.ready = ok
          resolve(ok)
        }
        const onReady = (ev: MessageEvent) => {
          const l: string =
            typeof ev.data === 'string' ? ev.data : ''
          if (l === 'readyok') finish(true)
        }
        const onMsg = (e: MessageEvent) => {
          const line: string =
            typeof e.data === 'string' ? e.data : ''
          if (line === 'engine_load_failed') {
            w.terminate()
            this.worker = null
            this.ready = false
            window.clearTimeout(timeout)
            resolve(false)
            return
          }
          if (line === 'uciok') {
            w.removeEventListener('message', onMsg)
            w.addEventListener('message', onReady)
            try {
              w.postMessage('isready')
            } catch {
              /* ignore */
            }
          }
        }
        w.addEventListener('message', onMsg)
        try {
          w.postMessage('uci')
        } catch {
          /* ignore */
        }
      } catch {
        this.ready = false
        resolve(false)
      }
    })
    try {
      return await this.startingPromise
    } finally {
      this.startingPromise = null
    }
  }
}

/** Fallback AI — picks captures when available, otherwise random legal move. */
export class FallbackAI implements AIAdapter {
  public readonly kind: AIEngineKind = 'fallback'

  async requestMove(
    fen: string,
    _difficulty: AIDifficulty,
  ): Promise<ApplyMoveInput | null> {
    const engine = new ChessEngine(fen)
    const map = expandBoardFromFen(fen)
    const moves = engine.legalMovesAll()
    if (moves.length === 0) return null
    const captures = moves.filter((m) => Boolean(map[m.to]))
    const pool = captures.length > 0 ? captures : moves
    const pick = pool[Math.floor(Math.random() * pool.length)]
    return sanitize(pick, fen)
  }

  cancel(): void { /* no-op */ }
  shutdown(): void { /* no-op */ }
}

function expandBoardFromFen(fen: string): Record<string, string> {
  const board: Record<string, string> = {}
  const ranks = fen.split(' ')[0].split('/')
  for (let r = 0; r < 8; r++) {
    let file = 0
    for (const ch of ranks[r]) {
      if (/[1-8]/.test(ch)) {
        file += parseInt(ch, 10)
        continue
      }
      if (file < 8) {
        const sq = `${'abcdefgh'[file]}${8 - r}`
        board[sq] = ch
        file++
      }
    }
  }
  return board
}

function sanitize(input: ApplyMoveInput, fen: string): ApplyMoveInput {
  const engine = new ChessEngine(fen)
  if (engine.isLegal(input)) return input
  if (engine.isLegal({ from: input.from, to: input.to })) {
    return { from: input.from, to: input.to }
  }
  return engine.legalMovesAll()[0] ?? input
}

export async function createAI(): Promise<AIAdapter> {
  const sf = new StockfishAI()
  const ok = await sf.ensureStarted()
  if (ok) return sf
  sf.shutdown()
  return new FallbackAI()
}
