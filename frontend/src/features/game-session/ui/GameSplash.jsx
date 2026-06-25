import React, { useEffect, useState } from 'react';

export default function GameSplash({ message, active }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active || !message) {
      setVisible(false);
      return undefined;
    }

    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), 1400);

    return () => clearTimeout(hideTimer);
  }, [active, message]);

  if (!visible || !message) return null;

  return (
    <div className="game-splash" aria-live="polite">
      <p className="game-splash__text">{message}</p>
    </div>
  );
}
