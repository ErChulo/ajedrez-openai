// Zustand store for global application state.
// Uses persist middleware to save user preferences to localStorage.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AIDifficulty,
  ClockSettings,
  GameStatus,
  PieceStyleId,
  RenderMode,
  Side,
  ThemeName,
} from '@/types'

interface AppState {
  // Player identity
  playerName: string
  setPlayerName: (name: string) => void

  // Game mode
  gameMode: 'ai' | 'online' | null
  setGameMode: (mode: 'ai' | 'online' | null) => void

  // Game status
  gameStatus: GameStatus
  setGameStatus: (status: GameStatus) => void
  gameResult: { winner: Side | null; reason: string } | null
  setGameResult: (result: { winner: Side | null; reason: string } | null) => void

  // Settings
  humanSide: Side
  setHumanSide: (side: Side) => void
  aiDifficulty: AIDifficulty
  setAiDifficulty: (d: AIDifficulty) => void
  clockSettings: ClockSettings
  setClockSettings: (s: ClockSettings) => void
  pieceStyle: PieceStyleId
  setPieceStyle: (style: PieceStyleId) => void

  // UI state
  renderMode: RenderMode
  setRenderMode: (mode: RenderMode) => void
  boardTheme: ThemeName
  setBoardTheme: (theme: ThemeName) => void
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  soundVolume: number
  setSoundVolume: (volume: number) => void

  // Game flow
  isAiThinking: boolean
  setIsAiThinking: (thinking: boolean) => void
  gameStarted: boolean
  setGameStarted: (started: boolean) => void

  // Online room
  onlineRoomCode: string | null
  setOnlineRoomCode: (roomCode: string | null) => void
  onlineRole: 'white' | 'black' | 'spectator' | null
  setOnlineRole: (role: 'white' | 'black' | 'spectator' | null) => void

  // Reset game
  resetGame: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      playerName: `Guest-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      setPlayerName: (name) => set({ playerName: name }),

      gameMode: null,
      setGameMode: (mode) => set({ gameMode: mode }),

      gameStatus: 'playing',
      setGameStatus: (status) => set({ gameStatus: status }),
      gameResult: null,
      setGameResult: (result) => set({ gameResult: result }),

      humanSide: 'white',
      setHumanSide: (side) => set({ humanSide: side }),
      aiDifficulty: 'intermediate',
      setAiDifficulty: (d) => set({ aiDifficulty: d }),
      clockSettings: { initialSeconds: 600, incrementSeconds: 0 },
      setClockSettings: (s) => set({ clockSettings: s }),

      renderMode: '2d',
      setRenderMode: (mode) => set({ renderMode: mode }),
      boardTheme: 'classic' as ThemeName,
      setBoardTheme: (theme) => set({ boardTheme: theme }),
      pieceStyle: 'asset-pack',
      setPieceStyle: (style) => set({ pieceStyle: style }),
      soundEnabled: true,
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      soundVolume: 0.5,
      setSoundVolume: (volume) => set({ soundVolume: volume }),

      isAiThinking: false,
      setIsAiThinking: (thinking) => set({ isAiThinking: thinking }),
      gameStarted: false,
      setGameStarted: (started) => set({ gameStarted: started }),
      onlineRoomCode: null,
      setOnlineRoomCode: (roomCode) => set({ onlineRoomCode: roomCode }),
      onlineRole: null,
      setOnlineRole: (role) => set({ onlineRole: role }),

      resetGame: () =>
        set({
          gameStatus: 'playing',
          gameResult: null,
          isAiThinking: false,
          gameStarted: false,
          gameMode: null,
          onlineRoomCode: null,
          onlineRole: null,
        }),
    }),
    {
      name: 'ajedrez:settings',
      version: 1,
      migrate: (persistedState, version) => {
        if (version < 1) {
          return { ...(persistedState as Record<string, unknown>), renderMode: '2d' }
        }
        return persistedState as Record<string, unknown>
      },
      partialize: (state) => ({
        playerName: state.playerName,
        humanSide: state.humanSide,
        aiDifficulty: state.aiDifficulty,
        clockSettings: state.clockSettings,
        renderMode: state.renderMode,
        boardTheme: state.boardTheme,
        pieceStyle: state.pieceStyle,
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume,
      }),
    },
  ),
)
