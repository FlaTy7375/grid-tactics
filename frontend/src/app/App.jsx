import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import WelcomePage from '@pages/welcome/ui/WelcomePage';
import LobbyPage from '@pages/lobby/ui/LobbyPage';
import GamePage from '@pages/game/ui/GamePage';
import { socket } from '@shared/api/socket';
import { warmupShipThumbnails } from '@shared/lib/shipThumbnails';

function App() {
  React.useEffect(() => {
    socket.connect();
    warmupShipThumbnails();
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/game/:sessionId" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
