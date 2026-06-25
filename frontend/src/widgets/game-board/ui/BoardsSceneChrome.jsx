import React from 'react';

export function BoardPlayerCard({ side, title, name, hint }) {
  return (
    <div className={`board-player-card board-player-card--${side}`}>
      <span className="board-player-card__eyebrow">{title}</span>
      <div className="board-player-card__main">
        <span className="board-player-card__name">{name}</span>
      </div>
      {hint && <p className="board-player-card__hint">{hint}</p>}
    </div>
  );
}

export function BoardsSceneChrome({ selfCard, opponentCard, children, overlay }) {
  return (
    <div className="boards-3d-panel">
      <div className="boards-top">
        {selfCard}
        {opponentCard}
      </div>

      <div className="game-boards-3d-host">
        <div className="boards-center-divider" aria-hidden />
        {children}
        {overlay}
      </div>
    </div>
  );
}
