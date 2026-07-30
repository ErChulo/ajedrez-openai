// Shared types for the chess application.

export type Square = 'a1' | 'b1' | 'c1' | 'd1' | 'e1' | 'f1' | 'g1' | 'h1'
  | 'a2' | 'b2' | 'c2' | 'd2' | 'e2' | 'f2' | 'g2' | 'h2'
  | 'a3' | 'b3' | 'c3' | 'd3' | 'e3' | 'f3' | 'g3' | 'h3'
  | 'a4' | 'b4' | 'c4' | 'd4' | 'e4' | 'f4' | 'g4' | 'h4'
  | 'a5' | 'b5' | 'c5' | 'd5' | 'e5' | 'f5' | 'g5' | 'h5'
  | 'a6' | 'b6' | 'c6' | 'd6' | 'e6' | 'f6' | 'g6' | 'h6'
  | 'a7' | 'b7' | 'c7' | 'd7' | 'e7' | 'f7' | 'g7' | 'h7'
  | 'a8' | 'b8' | 'c8' | 'd8' | 'e8' | 'f8' | 'g8' | 'h8'

export type Color = 'w' | 'b'
export type Side = 'white' | 'black'
export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export type PieceSymbol = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'
export type PieceGlyph = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export type Promotion = 'q' | 'r' | 'b' | 'n'
export type PlayerId = 'white' | 'black' | 'spectator'

export interface ApplyMoveInput {
  from: Square
  to: Square
  promotion?: Promotion
}

export interface MoveRecord {
  from: Square
  to: Square
  piece: PieceSymbol
  captured?: PieceSymbol
  promotion?: PieceSymbol
  san: string
  lan: string
  fen: string
  ply: number
}

export interface GameSnapshot {
  fen: string
  pgn: string
  turn: Side
  history: MoveRecord[]
  inCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isInsufficientMaterial: boolean
  isThreefoldRepetition: boolean
  is50MoveRule: boolean
  canWhiteCastleKingside: boolean
  canWhiteCastleQueenside: boolean
  canBlackCastleKingside: boolean
  canBlackCastleQueenside: boolean
  status: GameStatus
  winner: Side | null
}

export type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned' | 'aborted' | 'timeout'
export type RenderMode = '2d' | '3d'
export type ThemeName = 'classic' | 'slate' | 'emerald' | 'neon'

// Piece style picker — eight canonical entries mirroring the sister repo.
// Default = 'asset-pack' (Unknuffig 2D PNG + Sketchfab chess3d 3D GLTF).
export type PieceStyleId = 'classic' | 'bold' | 'outline' | 'filled' | 'minimal' | 'ornate' | 'staunton' | 'asset-pack'
export const PIECE_STYLE_IDS: readonly PieceStyleId[] = ['classic', 'bold', 'outline', 'filled', 'minimal', 'ornate', 'staunton', 'asset-pack']
export const DEFAULT_PIECE_STYLE: PieceStyleId = 'asset-pack'

export interface PieceStyleMeta {
  id: PieceStyleId
  name: string
  blurb: string
}

export interface ThemeData {
  name: ThemeName
  label: string
  boardLight: string
  boardDark: string
  accent: string
  cssVars: Record<string, string>
  three: {
    boardLight: number
    boardDark: number
    pieceWhite: { color: number; roughness: number; metalness: number; emissive?: number }
    pieceBlack: { color: number; roughness: number; metalness: number; emissive?: number }
  }
}

export type AIDifficulty = 'beginner' | 'easy' | 'intermediate' | 'advanced' | 'expert'

export interface ClockSettings {
  initialSeconds: number
  incrementSeconds: number
}

export interface ClockSnapshot {
  whiteMs: number
  blackMs: number
  active: Side | null
  flagFall?: Side
}

export interface OnlineRoomSummary {
  id: string
  code: string
  hostName: string
  guestName: string | null
  hostSide: Side
  clockInitialSeconds: number
  clockIncrementSeconds: number
  theme: ThemeName
  pieceStyle: PieceStyleId
  status: 'waiting' | 'active' | 'finished' | 'aborted'
  fen: string
  pgn: string
  winner: Side | null
  resultReason: string | null
  createdAt: string
  updatedAt: string
}

export interface OnlinePresence {
  roomCode: string
  playerName: string
  role: PlayerId
}

export type SoundName =
  | 'move'
  | 'capture'
  | 'check'
  | 'castle'
  | 'promote'
  | 'illegal'
  | 'gameStart'
  | 'gameEnd'
  | 'lowtime'
  | 'tick'
