// Lobby page — game configuration and settings.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOnlineRoom, joinOnlineRoom } from '@/features/session/rooms'
import { hasSupabaseEnv } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { THEMES } from '@/features/themes'
import { PIECE_STYLE_IDS } from '@/types'
import { PIECE_STYLE_META, renderPieceSvg } from '@/renderers/board2d/piece-styles'
import type { AIDifficulty } from '@/types'
import styles from '@/App.module.css'

export function LobbyPage() {
  const navigate = useNavigate()
  const {
    playerName, setPlayerName,
    setGameMode,
    setGameStatus,
    setGameResult,
    humanSide, setHumanSide,
    aiDifficulty, setAiDifficulty,
    clockSettings, setClockSettings,
    boardTheme, setBoardTheme,
    soundEnabled, setSoundEnabled,
    soundVolume, setSoundVolume,
    setGameStarted,
    pieceStyle, setPieceStyle,
    setOnlineRoomCode,
    setOnlineRole,
  } = useAppStore()

  const [showOptions, setShowOptions] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [onlineError, setOnlineError] = useState<string | null>(null)
  const [onlineBusy, setOnlineBusy] = useState(false)

  const handleStartGame = () => {
    setOnlineRoomCode(null)
    setOnlineRole(null)
    setGameMode('ai')
    setGameStarted(true)
    setGameStatus('playing')
    setGameResult(null)
    navigate('/game')
  }

  const handleCreateRoom = async () => {
    if (!hasSupabaseEnv) {
      setOnlineError('Add Supabase env vars to enable online rooms')
      return
    }
    setOnlineBusy(true)
    setOnlineError(null)
    try {
      const room = await createOnlineRoom({
        hostName: playerName.trim() || 'Guest',
        hostSide: humanSide,
        boardTheme,
        pieceStyle,
        clockSettings,
      })
      setOnlineRoomCode(room.code)
      setOnlineRole(room.hostSide)
      setGameMode('online')
      setGameStarted(true)
      setGameStatus('playing')
      setGameResult(null)
      navigate('/game')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not create room')
    } finally {
      setOnlineBusy(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!hasSupabaseEnv) {
      setOnlineError('Add Supabase env vars to enable online rooms')
      return
    }
    if (!roomCode.trim()) {
      setOnlineError('Enter a room code')
      return
    }
    setOnlineBusy(true)
    setOnlineError(null)
    try {
      const room = await joinOnlineRoom(roomCode.trim().toUpperCase(), playerName.trim() || 'Guest')
      setOnlineRoomCode(room.code)
      setOnlineRole(room.hostSide === 'white' ? 'black' : 'white')
      setHumanSide(room.hostSide === 'white' ? 'black' : 'white')
      setBoardTheme(room.theme)
      setPieceStyle(room.pieceStyle)
      setClockSettings({ initialSeconds: room.clockInitialSeconds, incrementSeconds: room.clockIncrementSeconds })
      setGameMode('online')
      setGameStarted(true)
      setGameStatus('playing')
      setGameResult(null)
      navigate('/game')
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : 'Could not join room')
    } finally {
      setOnlineBusy(false)
    }
  }

  return (
    <div className={styles.app} data-testid="app-shell">
      <div className={styles.landing} data-testid="lobby-page">
        <div className={styles.landingContent}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>♚</span>
            <h1>Chess</h1>
            <p className={styles.subtitle}>2D & 3D • AI Opponent • Tournament Rules</p>
          </div>

          <div className={styles.menuCard}>
            <div className={styles.formGroup}>
              <label>Play as</label>
              <div className={styles.radioGroup}>
                {(['white', 'black', 'random'] as const).map((side) => (
                  <button
                    key={side}
                    className={`${styles.radioBtn} ${humanSide === side ? styles.radioBtnActive : ''}`}
                    onClick={() => {
                      if (side === 'random') {
                        setHumanSide(Math.random() > 0.5 ? 'white' : 'black')
                      } else {
                        setHumanSide(side)
                      }
                    }}
                  >
                    {side === 'white' ? '♔ White' : side === 'black' ? '♚ Black' : '🎲 Random'}
                  </button>
                ))}
              </div>
            </div>

            <button className={styles.startBtn} data-testid="start-game-button" onClick={handleStartGame}>
              Start Game
            </button>

            <div className={styles.optionsSection} style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
              <div className={styles.formGroup}>
                <label>Online multiplayer</label>
                <div className={styles.settingRow}>
                  <button className={styles.ctrlBtn} onClick={handleCreateRoom} disabled={onlineBusy}>
                    {onlineBusy ? 'Working…' : 'Create Room'}
                  </button>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="Room code"
                    style={{ flex: 1 }}
                  />
                  <button className={styles.ctrlBtn} onClick={handleJoinRoom} disabled={onlineBusy}>
                    Join
                  </button>
                </div>
                {!hasSupabaseEnv && (
                  <p className={styles.subtitle} style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                    Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY after deploying.
                  </p>
                )}
                {onlineError && (
                  <p style={{ color: '#ff8a8a', fontSize: '0.85rem', marginTop: '8px' }}>{onlineError}</p>
                )}
              </div>
            </div>

            <button
              className={styles.optionsToggle}
              data-testid="lobby-options-toggle"
              onClick={() => setShowOptions(!showOptions)}
            >
              {showOptions ? '▾ Options' : '▸ Options'}
            </button>

            {showOptions && (
              <div className={styles.optionsSection}>
                <div className={styles.formGroup}>
                  <label>Your Name</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={24}
                    placeholder="Enter your name"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>AI Difficulty</label>
                  <div className={styles.radioGroup}>
                    {(['beginner', 'easy', 'intermediate', 'advanced', 'expert'] as AIDifficulty[]).map((d) => (
                      <button
                        key={d}
                        className={`${styles.radioBtn} ${aiDifficulty === d ? styles.radioBtnActive : ''}`}
                        onClick={() => setAiDifficulty(d)}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Time Control</label>
                  <div className={styles.radioGroup}>
                    {([
                      { label: '1+0', initial: 60, incr: 0 },
                      { label: '3+2', initial: 180, incr: 2 },
                      { label: '5+0', initial: 300, incr: 0 },
                      { label: '10+0', initial: 600, incr: 0 },
                      { label: '15+10', initial: 900, incr: 10 },
                      { label: 'No clock', initial: 0, incr: 0 },
                    ] as const).map((tc) => (
                      <button
                        key={tc.label}
                        className={`${styles.radioBtn} ${clockSettings.initialSeconds === tc.initial && clockSettings.incrementSeconds === tc.incr ? styles.radioBtnActive : ''}`}
                        onClick={() => setClockSettings({ initialSeconds: tc.initial, incrementSeconds: tc.incr })}
                      >
                        {tc.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Board Theme</label>
                  <div className={styles.radioGroup}>
                    {Object.values(THEMES).map((t) => (
                      <button
                        key={t.name}
                        className={`${styles.radioBtn} ${styles.themeBtn} ${boardTheme === t.name ? styles.radioBtnActive : ''}`}
                        onClick={() => setBoardTheme(t.name)}
                      >
                        <span
                          className={styles.themeSwatch}
                          style={{ background: `linear-gradient(135deg, ${t.boardLight} 50%, ${t.boardDark} 50%)` }}
                        />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Piece Style</label>
                  <div className={styles.radioGroup}>
                    {PIECE_STYLE_IDS.map((id) => (
                      <button
                        key={id}
                        className={`${styles.radioBtn} ${pieceStyle === id ? styles.radioBtnActive : ''}`}
                        onClick={() => setPieceStyle(id)}
                      >
                        {PIECE_STYLE_META[id].name}
                      </button>
                    ))}
                  </div>
                  <div className={styles.piecePreview}>
                    {(['K', 'Q', 'R', 'B', 'N', 'P'] as const).map((sym) => (
                      <span
                        key={sym}
                        className={styles.piecePreviewItem}
                        dangerouslySetInnerHTML={{ __html: renderPieceSvg(sym, pieceStyle) }}
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Sound</label>
                  <div className={styles.settingRow}>
                    <button
                      className={`${styles.toggleBtn} ${soundEnabled ? styles.toggleBtnActive : ''}`}
                      onClick={() => setSoundEnabled(!soundEnabled)}
                    >
                      {soundEnabled ? '🔊' : '🔇'}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={soundVolume}
                      onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                      disabled={!soundEnabled}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
