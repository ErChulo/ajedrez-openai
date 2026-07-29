import { ChessEngine } from '@/chess/engine'
import { supabase } from '@/lib/supabase'
import type { ClockSettings, OnlineRoomSummary, Side, ThemeName, PieceStyleId, Promotion, Square } from '@/types'

interface CreateRoomInput {
  hostName: string
  hostSide: Side
  boardTheme: ThemeName
  pieceStyle: PieceStyleId
  clockSettings: ClockSettings
}

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function mapRoom(row: Record<string, unknown>): OnlineRoomSummary {
  return {
    id: String(row.id),
    code: String(row.code),
    hostName: String(row.host_name),
    guestName: row.guest_name ? String(row.guest_name) : null,
    hostSide: row.host_side as Side,
    clockInitialSeconds: Number(row.clock_initial_seconds),
    clockIncrementSeconds: Number(row.clock_increment_seconds),
    theme: row.theme as ThemeName,
    pieceStyle: row.piece_style as PieceStyleId,
    status: row.status as OnlineRoomSummary['status'],
    fen: String(row.fen),
    pgn: String(row.pgn),
    winner: (row.winner === 'white' || row.winner === 'black' ? row.winner : null) as Side | null,
    resultReason: row.result_reason ? String(row.result_reason) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function createOnlineRoom(input: CreateRoomInput): Promise<OnlineRoomSummary> {
  if (!supabase) throw new Error('Supabase is not configured')

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode()
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        host_name: input.hostName,
        host_side: input.hostSide,
        guest_name: null,
        clock_initial_seconds: input.clockSettings.initialSeconds,
        clock_increment_seconds: input.clockSettings.incrementSeconds,
        theme: input.boardTheme,
        piece_style: input.pieceStyle,
        status: 'waiting',
        fen: new ChessEngine().fen(),
        pgn: '',
      })
      .select('*')
      .single()

    if (!error && data) return mapRoom(data)
    if (error && error.code !== '23505') throw error
  }

  throw new Error('Could not generate a unique room code')
}

export async function getOnlineRoomByCode(code: string): Promise<OnlineRoomSummary | null> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapRoom(data)
}

export async function joinOnlineRoom(code: string, guestName: string): Promise<OnlineRoomSummary> {
  if (!supabase) throw new Error('Supabase is not configured')
  const room = await getOnlineRoomByCode(code)
  if (!room) throw new Error('Room not found')
  if (room.status !== 'waiting') throw new Error('Room is not available to join')

  const { data, error } = await supabase
    .from('rooms')
    .update({ guest_name: guestName, status: 'active' })
    .eq('id', room.id)
    .eq('status', 'waiting')
    .select('*')
    .single()

  if (error) throw error
  return mapRoom(data)
}

export interface OnlineMoveRecord {
  from: Square
  to: Square
  promotion?: Promotion
}

export class StalePositionError extends Error {
  constructor() {
    super('Stale position')
    this.name = 'StalePositionError'
  }
}

export class NotYourTurnError extends Error {
  constructor() {
    super('Not your turn')
    this.name = 'NotYourTurnError'
  }
}

export class RoomInactiveError extends Error {
  constructor() {
    super('Room is not active')
    this.name = 'RoomInactiveError'
  }
}

function classifyRpcError(error: { code?: string; message?: string }): Error {
  const code = error?.code
  const message = error?.message ?? ''
  if (code === 'P0004') return new StalePositionError()
  if (code === 'P0005') return new NotYourTurnError()
  if (code === 'P0003') return new RoomInactiveError()
  if (code === 'P0006') return new StalePositionError()
  return new Error(message || 'apply_room_move failed')
}

/**
 * Apply a move to a room using server-authoritative CAS.
 *
 * Locally validates the move with ChessEngine (producing the next FEN/PGN),
 * then asks the server to commit it only if the stored position still matches
 * the caller's prior FEN and the side-to-move in that FEN is `side`. Returns
 * the refreshed room row, or throws one of StalePositionError /
 * NotYourTurnError / RoomInactiveError so the caller can reconcile.
 */
export async function applyOnlineMove(
  code: string,
  side: Side,
  priorFen: string,
  move: OnlineMoveRecord,
): Promise<OnlineRoomSummary> {
  if (!supabase) throw new Error('Supabase is not configured')

  const simulator = new ChessEngine(priorFen)
  const record = simulator.apply(move)
  const fenAfter = record.fen
  const pgnAfter = simulator.pgn()

  const { data, error } = await supabase.rpc('apply_room_move', {
    p_code: code,
    p_side: side,
    p_prior_fen: priorFen,
    p_fen_after: fenAfter,
    p_pgn_after: pgnAfter,
  })
  if (error) throw classifyRpcError(error)
  if (!data) throw new Error('apply_room_move returned no row')
  return mapRoom(data as Record<string, unknown>)
}

/** Finalize a room (resignation/checkmate/draw/timeout uses 'finished'; leaving uses 'aborted'). Idempotent. */
export async function finishOnlineRoom(
  code: string,
  finalStatus: 'finished' | 'aborted',
  winner: Side | null,
  reason: string,
): Promise<OnlineRoomSummary> {
  if (!supabase) throw new Error('Supabase is not configured')

  const { data, error } = await supabase.rpc('finish_room', {
    p_code: code,
    p_final_status: finalStatus,
    p_winner: winner ?? '',
    p_reason: reason,
  })
  if (error) throw error
  if (!data) throw new Error('finish_room returned no row')
  return mapRoom(data as Record<string, unknown>)
}

/** Abort a waiting room if the guest never joined, or mark the room broken. */
export async function leaveOnlineRoom(code: string): Promise<OnlineRoomSummary | null> {
  if (!supabase) throw new Error('Supabase is not configured')
  const room = await getOnlineRoomByCode(code)
  if (!room) return null

  const finalStatus: 'finished' | 'aborted' = room.status === 'waiting' ? 'aborted' : 'finished'
  const winner: Side | null = room.status === 'waiting' ? null : (room.hostSide === 'white' ? 'black' : 'white')

  return finishOnlineRoom(code, finalStatus, winner, room.status === 'waiting' ? 'Abandoned' : 'Opponent left')
}

export interface RoomSubscription {
  unsubscribe: () => void
  roomId: string
}

/**
 * Subscribe to realtime updates for a room. The `onChange` callback fires with
 * the latest OnlineRoomSummary whenever the row changes (move applied, room
 * finalized, room aborted, guest joined). Returns a handle whose `unsubscribe`
 * removes the channel.
 */
export function subscribeRoom(
  roomId: string,
  onChange: (room: OnlineRoomSummary) => void,
): RoomSubscription {
  if (!supabase) throw new Error('Supabase is not configured')

  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown>
        if (row) onChange(mapRoom(row))
      },
    )
    .subscribe()

  return {
    roomId,
    unsubscribe: () => {
      if (supabase) void supabase.removeChannel(channel)
    },
  }
}
