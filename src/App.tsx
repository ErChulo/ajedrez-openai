// Main application shell — routes between lobby and game screens.

import { Routes, Route, Navigate } from 'react-router-dom'
import { LobbyPage } from '@/pages/LobbyPage'
import { GamePage } from '@/pages/GamePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LobbyPage />} />
      <Route path="/game" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
