import React from 'react';

export default function BoardWaitingOverlay({ side = 'self', title = 'Ждём соперника', hint = 'Расстановка сохранена' }) {
  return (
    <div className={`board-waiting board-waiting--${side}`}>
      <div className="board-waiting__card">
        <div className="board-waiting__ring" aria-hidden />
        <span className="board-waiting__eyebrow">Ожидание</span>
        <p className="board-waiting__title">{title}</p>
        <p className="board-waiting__hint">{hint}</p>
      </div>
    </div>
  );
}
