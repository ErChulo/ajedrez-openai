// Game page — active chess game with board, clocks, and controls.

import { useEffect, useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '@/hooks/useGame'
import { Board2D } from '@/renderers/board2d/Board2D'
import { Board3D } from '@/renderers/board3d/Board3D'
import { ClockDisplay } from '@/components/Clock'
import { MoveList } from '@/components/MoveList'
import { PromotionPicker } from '@/components/PromotionPicker'
import { THEMES } from '@/features/themes'
import { sounds } from '@/features/audio/sounds'
import { useAppStore } from '@/lib/store'
import styles from '@/App.module.css'

export function GamePage() {
  const navigate = useNavigate()
  const {
    playerName,
    setGameMode,
    setGameStatus,
    gameResult, setGameResult,
    gameMode,
    humanSide,
    aiDifficulty,
    boardTheme,
    soundEnabled, setSoundEnabled,
    soundVolume,
    isAiThinking,
    gameStarted, setGameStarted,
    renderMode, setRenderMode,
    pieceStyle,
    onlineRoomCode,
  } = useAppStore()

  const game = useGame()
  const [confirmResign, setConfirmResign] = useState(false)
  const confirmResignTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boardContainerRef = useRef<HTMLDivElement>(null)

  // Redirect to lobby if game not started
  useEffect(() => {
    if (!gameStarted) {
      navigate('/')
    }
  }, [gameStarted, navigate])

  // Sound volume sync
  useEffect(() => {
    sounds.setMuted(!soundEnabled)
    sounds.setVolume(soundVolume)
  }, [soundEnabled, soundVolume])

  // Apply theme CSS vars to :root
  useEffect(() => {
    const root = document.documentElement
    const vars = THEMES[boardTheme].cssVars
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v)
    }
  }, [boardTheme])

  // Start game on mount
  useEffect(() => {
    if (gameStarted) {
      requestAnimationFrame(() => {
        game.startGame()
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackToLobby = useCallback(() => {
    game.resetGame()
    setGameStarted(false)
    setGameMode(null)
    setGameStatus('playing')
    setGameResult(null)
    navigate('/')
  }, [game, navigate, setGameStarted, setGameMode, setGameStatus, setGameResult])

  const handleNewGame = useCallback(() => {
    game.startGame()
    setGameResult(null)
  }, [game, setGameResult])

  const toggleRenderMode = useCallback(() => {
    setRenderMode(renderMode === '2d' ? '3d' : '2d')
  }, [renderMode, setRenderMode])

  const handleResign = useCallback(() => {
    if (confirmResign) {
      if (confirmResignTimeoutRef.current) clearTimeout(confirmResignTimeoutRef.current)
      setConfirmResign(false)
      game.resign()
    } else {
      setConfirmResign(true)
      confirmResignTimeoutRef.current = setTimeout(() => setConfirmResign(false), 3000)
    }
  }, [game, confirmResign])

  // Game over modal
  const gameOver = game.snapshot?.status !== 'playing' && game.snapshot?.status !== undefined
  const topPlayerName = gameMode === 'online'
    ? (humanSide === 'black' ? playerName : 'Opponent')
    : (humanSide === 'black' ? playerName : 'AI')
  const bottomPlayerName = gameMode === 'online'
    ? (humanSide === 'white' ? playerName : 'Opponent')
    : (humanSide === 'white' ? playerName : 'AI')
  const undoDisabled = gameMode === 'online' || game.snapshot?.status !== 'playing' || isAiThinking

  if (!gameStarted) return null

  return (
    <div className={styles.app} data-testid="app-shell">
      <div className={`${styles.gameLayout} ${renderMode === '3d' ? styles.gameLayout3d : ''}`} data-testid="game-page">
        {/* Top bar */}
        <div className={`${styles.topBar} ${renderMode === '3d' ? styles.topBarFloating : ''}`}>
          <button className={styles.backBtn} data-testid="back-to-lobby-button" onClick={handleBackToLobby}>
            ← Lobby
          </button>
          <div className={styles.topBarInfo}>
            <span className={styles.modeBadge}>{gameMode === 'online' ? `Online • ${onlineRoomCode ?? '—'}` : `vs AI • ${aiDifficulty}`}</span>
            <span className={styles.themeBadge}>{THEMES[boardTheme].label}</span>
          </div>
          <div className={styles.topBarControls}>
            <button className={styles.iconBtnSm} data-testid="render-mode-toggle" onClick={toggleRenderMode} title={`Switch to ${renderMode === '2d' ? '3D' : '2D'} board`}>
              {renderMode === '2d' ? '3D' : '2D'}
            </button>
          </div>
        </div>

        {/* Main game area */}
        <div className={`${styles.gameMain} ${renderMode === '3d' ? styles.mode3d : ''}`}>
          {/* Board column */}
          <div className={styles.boardColumn}>
            {renderMode === '2d' && (
              <ClockDisplay
                whiteMs={game.clock.whiteMs}
                blackMs={game.clock.blackMs}
                active={game.clock.active}
                playerSide="top"
                playerName={topPlayerName}
              />
            )}

            <div className={`${styles.boardContainer} ${renderMode === '3d' ? styles.boardFullscreen : ''}`} ref={boardContainerRef}>
              {renderMode === '2d' ? (
                <Board2D
                  board={game.boardMap}
                  theme={boardTheme}
                  pieceStyle={pieceStyle}
                  flipped={humanSide === 'black'}
                  selectable={game.snapshot?.status === 'playing' ? humanSide : null}
                  lastMove={game.lastMove}
                  checkSquare={game.checkSquare}
                  onMoveAttempt={game.handleMoveAttempt}
                  onSelect={game.handleSelect}
                  boardBridgeRef={game.boardBridgeRef}
                />
              ) : (
                <Board3D
                  board={game.boardMap}
                  theme={boardTheme}
                  pieceStyle={pieceStyle}
                  flipped={humanSide === 'black'}
                  selectable={game.snapshot?.status === 'playing' ? humanSide : null}
                  lastMove={game.lastMove}
                  checkSquare={game.checkSquare}
                  onMoveAttempt={game.handleMoveAttempt}
                  onSelect={game.handleSelect}
                  boardBridgeRef={game.boardBridgeRef}
                />
              )}

              {/* Floating clocks for 3D mode */}
              {renderMode === '3d' && (
                <>
                  <div className={`${styles.floatingClock} ${styles.floatingClockTop}`}>
                    <ClockDisplay
                      whiteMs={game.clock.whiteMs}
                      blackMs={game.clock.blackMs}
                      active={game.clock.active}
                      playerSide="top"
                      playerName={topPlayerName}
                    />
                  </div>
                  <div className={`${styles.floatingClock} ${styles.floatingClockBottom}`}>
                    <ClockDisplay
                      whiteMs={game.clock.whiteMs}
                      blackMs={game.clock.blackMs}
                      active={game.clock.active}
                      playerSide="bottom"
                      playerName={bottomPlayerName}
                    />
                  </div>
                </>
              )}

              {/* Floating controls for 3D mode */}
              {renderMode === '3d' && (
                <div className={styles.floatingControls}>
                  <button className={styles.floatingBtn} onClick={handleBackToLobby}>
                    ← Lobby
                  </button>
                  <button className={styles.floatingBtn} onClick={toggleRenderMode}>
                    2D
                  </button>
                  <button
                    className={`${styles.floatingBtn} ${confirmResign ? styles.floatingBtnDanger : ''}`}
                    onClick={handleResign}
                    disabled={game.snapshot?.status !== 'playing'}
                  >
                    {confirmResign ? 'Confirm?' : 'Resign'}
                  </button>
                  <button
                    className={styles.floatingBtn}
                    onClick={game.undoMove}
                    disabled={undoDisabled}
                  >
                    Undo
                  </button>
                  <button
                    className={styles.floatingBtn}
                    onClick={() => setSoundEnabled(!soundEnabled)}
                  >
                    {soundEnabled ? '🔊' : '🔇'}
                  </button>
                </div>
              )}

              {/* AI thinking indicator */}
              {gameMode !== 'online' && isAiThinking && (
                <div className={styles.aiThinking}>
                  <span className={styles.thinkingDots}>
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                  AI is thinking
                </div>
              )}

              {/* Move error toast */}
              {game.moveError && (
                <div className={styles.moveErrorToast}>
                  {game.moveError}
                </div>
              )}

              {/* Promotion picker */}
              {game.showPromotion && (
                <div className={styles.promotionOverlay}>
            <PromotionPicker
              side={humanSide}
              onSelect={game.handlePromotionChoice}
            />
                </div>
              )}
            </div>

            {renderMode === '2d' && (
              <ClockDisplay
                whiteMs={game.clock.whiteMs}
                blackMs={game.clock.blackMs}
                active={game.clock.active}
                playerSide="bottom"
                playerName={bottomPlayerName}
              />
            )}
          </div>

          {/* Info panel — hidden in 3D mode */}
          {renderMode === '2d' && (
            <div className={styles.infoPanel}>
              <div className={styles.panelSection}>
                <h3>Moves</h3>
                <MoveList history={game.snapshot?.history ?? []} />
              </div>

              <div className={styles.panelSection}>
                <h3>Controls</h3>
                <div className={styles.controlsGrid}>
                  <button
                    className={`${styles.ctrlBtn} ${confirmResign ? styles.ctrlBtnDanger : ''}`}
                    onClick={handleResign}
                    disabled={game.snapshot?.status !== 'playing'}
                  >
                    {confirmResign ? 'Confirm?' : '🏳️ Resign'}
                  </button>
                  <button
                    className={styles.ctrlBtn}
                    onClick={game.undoMove}
                    disabled={undoDisabled}
                  >
                    ↩️ Undo
                  </button>
                  <button
                    className={styles.ctrlBtn}
                    onClick={() => setSoundEnabled(!soundEnabled)}
                  >
                    {soundEnabled ? '🔊' : '🔇'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Game over modal */}
      {gameOver && gameResult && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}>
              {gameResult.winner === humanSide ? '🏆' : gameResult.winner ? '😤' : '🤝'}
            </div>
            <h2>
              {gameResult.winner === humanSide
                ? 'You Win!'
                : gameResult.winner
                  ? 'You Lose'
                  : 'Draw'}
            </h2>
            <p className={styles.modalReason}>{gameResult.reason}</p>
            <div className={styles.modalActions}>
              <button className={styles.startBtn} onClick={handleNewGame}>
                New Game
              </button>
              <button className={styles.ctrlBtn} onClick={handleBackToLobby}>
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
