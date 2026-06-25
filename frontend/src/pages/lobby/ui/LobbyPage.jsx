import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '@shared/api/socket';
import { Swords, Plus, User, Shield, Target, Grid3x3, X } from 'lucide-react';
import { GAME_MODES, getGameMode, getShipConfigForMode } from '@shared/config/gameModes';
import './LobbyPage.css';

export default function LobbyPage() {
  const [sessions, setSessions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const [gameMode, setGameMode] = useState('classic');
  const navigate = useNavigate();
  const playerName = localStorage.getItem('battleshipUserName');
  const selectedMode = getGameMode(gameMode);

  useEffect(() => {
    if (!playerName) {
      navigate('/');
      return;
    }

    socket.emit('get_lobby');

    const onLobbyUpdate = (activeSessions) => {
      setSessions(activeSessions);
    };

    const onSessionCreated = (session) => {
      navigate(`/game/${session.id}`);
    };

    socket.on('lobby_update', onLobbyUpdate);
    socket.on('session_created', onSessionCreated);

    return () => {
      socket.off('lobby_update', onLobbyUpdate);
      socket.off('session_created', onSessionCreated);
    };
  }, [navigate, playerName]);

  const handleCreateGame = (e) => {
    e.preventDefault();
    socket.emit('create_session', {
      gridSize: parseInt(gridSize, 10),
      gameMode,
      shipConfig: getShipConfigForMode(gameMode),
    });
  };

  return (
    <main className="lobby-stage">
      <div className="lobby-container">
        <header className="lobby-header glass-panel">
          <div className="lobby-brand">
            <img src="/grid-tactics-logo.svg" alt="" className="lobby-logo" width={56} height={56} />
            <div>
              <span className="lobby-eyebrow">Grid Tactics</span>
              <h1 className="lobby-title">Лобби</h1>
              <p className="lobby-player">
                <User size={16} />
                {playerName}
              </p>
            </div>
          </div>

          <button onClick={() => setShowCreateModal(true)} className="btn-primary lobby-create-btn">
            <Plus size={20} />
            Новый бой
          </button>
        </header>

        <section className="lobby-board glass-panel">
          <div className="lobby-board-header">
            <h2 className="section-title">
              <Target size={22} color="#0ea5e9" />
              Открытые бои
            </h2>
            <span className="lobby-count">{sessions.length}</span>
          </div>

          {sessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Grid3x3 size={36} />
              </div>
              <h3 className="empty-state-title">Пока тихо</h3>
              <p className="muted-text empty-state-text">
                Создай первый бой и дождись соперника на поле.
              </p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary lobby-create-btn lobby-create-btn--inline">
                <Plus size={18} />
                Создать бой
              </button>
            </div>
          ) : (
            <div className="sessions-grid">
              {sessions.map((s) => {
                const mode = getGameMode(s.gameMode);
                return (
                  <article key={s.id} className="session-card">
                    <div className="session-header">
                      <div>
                        <div className="host-label">Создатель</div>
                        <div className="session-host">
                          <Shield size={18} />
                          {s.hostName}
                        </div>
                      </div>
                      <div className="session-badges">
                        <div className="session-badge">{s.gridSize}×{s.gridSize}</div>
                        <div className="session-badge session-badge--mode">{mode.label}</div>
                      </div>
                    </div>

                    <div className="session-grid-preview" aria-hidden="true" />

                    <button onClick={() => navigate(`/game/${s.id}`)} className="btn-secondary session-join-btn">
                      <Swords size={18} />
                      Играть
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {showCreateModal && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
            <div className="glass-panel modal-content lobby-modal">
              <div className="modal-header">
                <div>
                  <span className="lobby-eyebrow">Новая партия</span>
                  <h2 className="modal-title">Создать бой</h2>
                </div>
                <button className="close-btn" onClick={() => setShowCreateModal(false)} aria-label="Закрыть">
                  <X size={22} />
                </button>
              </div>

              <div className="modal-body">
                <form onSubmit={handleCreateGame}>
                  <label className="accent-label lobby-modal-label">Режим</label>
                  <div className="mode-selector">
                    {Object.values(GAME_MODES).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setGameMode(mode.id)}
                        className={`mode-option ${gameMode === mode.id ? 'active' : ''}`}
                      >
                        <div className="mode-option-title">{mode.label}</div>
                        <div className="mode-option-subtitle">{mode.description}</div>
                      </button>
                    ))}
                  </div>

                  <label className="accent-label lobby-modal-label">Размер поля</label>
                  <div className="size-selector">
                    {[10, 15, 20].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setGridSize(size)}
                        className={`size-option ${gridSize === size ? 'active' : ''}`}
                      >
                        <div className="size-option-value">{size}×{size}</div>
                        <div className="size-option-subtitle">
                          {size === 10 ? 'Стандартное' : size === 15 ? 'Большое' : 'Огромное'}
                        </div>
                      </button>
                    ))}
                  </div>

                  <p className="lobby-modal-hint">{selectedMode.description}</p>

                  <button type="submit" className="btn-primary lobby-create-btn lobby-create-btn--full">
                    Создать бой
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
