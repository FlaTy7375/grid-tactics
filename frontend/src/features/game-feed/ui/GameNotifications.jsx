import React from 'react';

export default function GameNotifications({ items }) {
  if (!items.length) return null;

  return (
    <div className="game-notifications" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`game-toast game-toast--${item.tone}`}>
          {item.title && <span className="game-toast__title">{item.title}</span>}
          {item.text && <span className="game-toast__text">{item.text}</span>}
        </div>
      ))}
    </div>
  );
}
