import React from 'react';
import { Trophy, Frown } from 'lucide-react';

export default function GameResultModal({ isVictory, opponentName, onLobby }) {
  return (
    <div className="modal-overlay game-result-overlay">
      <div className="glass-panel game-result-modal">
        <div className={`game-result-modal__icon ${isVictory ? 'game-result-modal__icon--win' : 'game-result-modal__icon--lose'}`}>
          {isVictory ? <Trophy size={34} /> : <Frown size={34} />}
        </div>

        <h2 className="game-result-modal__title">
          {isVictory ? 'Победа!' : 'Поражение'}
        </h2>

        <p className="game-result-modal__text">
          {isVictory
            ? `Ты потопил флот ${opponentName || 'соперника'}.`
            : `Флот потоплен. ${opponentName || 'Соперник'} одержал победу.`}
        </p>

        <button className="btn-primary lobby-create-btn game-result-modal__btn" onClick={onLobby} type="button">
          В лобби
        </button>
      </div>
    </div>
  );
}
