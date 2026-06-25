import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '@shared/api/socket';
import { ArrowRight, Grid3x3, Sparkles } from 'lucide-react';
import PaperShipScene from '@widgets/welcome-ship/ui/PaperShipScene';
import ErrorBoundary from '@shared/ui/ErrorBoundary';
import './WelcomePage.css';

export default function WelcomePage() {
  const [name, setName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();

  const handleConnect = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsConnecting(true);
    const storedId = localStorage.getItem('battleshipUserId');
    
    socket.emit('register', { name: name.trim(), userId: storedId });
    
    socket.once('registered', (data) => {
      localStorage.setItem('battleshipUserId', data.id);
      localStorage.setItem('battleshipUserName', data.name);
      navigate('/lobby');
    });
  };

  return (
    <main className="welcome-stage">
      <div className="welcome-card">
        <section className="welcome-copy">
          <div className="welcome-badge">
            <Sparkles size={16} />
            Тактика на клетках
          </div>

          <div className="welcome-brand">
            <div className="welcome-logo">
              <img src="/grid-tactics-logo.svg" alt="" width={58} height={58} />
            </div>
            <div>
              <h1>Grid Tactics</h1>
              <p>Расставь фигуры и побеждай на поле.</p>
            </div>
          </div>

          <p className="welcome-text">
            Введи имя и начни партию.
            Быстрый старт без регистрации.
          </p>

          <form onSubmit={handleConnect} className="welcome-form">
            <label className="welcome-label" htmlFor="player-name">
              Имя игрока
            </label>
            <input
              id="player-name"
              type="text"
              placeholder="Игрок"
              className="input-paper welcome-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              required
              autoFocus
            />
            <button
              type="submit"
              className="btn-primary welcome-button"
              disabled={!name.trim() || isConnecting}
            >
              {isConnecting ? 'Запускаем...' : 'В бой'}
              {!isConnecting && <ArrowRight size={20} />}
            </button>
          </form>
        </section>

        <section className="welcome-ship" aria-label="Предпросмотр корабля">
          <div className="welcome-ship-note">
            <Grid3x3 size={18} />
            Готов к игре
          </div>
          <ErrorBoundary>
            <PaperShipScene />
          </ErrorBoundary>
        </section>
      </div>
    </main>
  );
}
