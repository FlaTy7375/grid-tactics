import { useEffect, useState } from 'react';

export function formatCountdown(seconds) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function usePlacementCountdown(placementDeadline, active) {
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!active || !placementDeadline) {
      setSecondsLeft(null);
      return undefined;
    }

    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((placementDeadline - Date.now()) / 1000)));
    };

    tick();
    const intervalId = setInterval(tick, 250);
    return () => clearInterval(intervalId);
  }, [active, placementDeadline]);

  return secondsLeft;
}
