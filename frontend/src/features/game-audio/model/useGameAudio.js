import { useCallback, useEffect, useRef, useState } from 'react';

const MUSIC_STORAGE_KEY = 'gameMusicEnabled';
const SHOT_START_SEC = 4.8;
const SHOT_END_SEC = 6;

export default function useGameAudio(active = false) {
  const musicRef = useRef(null);
  const shotRef = useRef(null);
  const shotStopTimerRef = useRef(null);
  const [musicEnabled, setMusicEnabled] = useState(
    () => localStorage.getItem(MUSIC_STORAGE_KEY) !== 'false',
  );

  useEffect(() => {
    const music = new Audio('/music.mp3');
    music.loop = true;
    music.volume = 0.38;
    music.preload = 'auto';

    const shot = new Audio('/shot.mp3');
    shot.preload = 'auto';

    musicRef.current = music;
    shotRef.current = shot;

    return () => {
      if (shotStopTimerRef.current) {
        clearTimeout(shotStopTimerRef.current);
      }
      music.pause();
      musicRef.current = null;
      shotRef.current = null;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(MUSIC_STORAGE_KEY, musicEnabled ? 'true' : 'false');

    const music = musicRef.current;
    if (!music || !active) {
      music?.pause();
      return;
    }

    if (musicEnabled) {
      music.play().catch(() => {});
      return;
    }

    music.pause();
  }, [musicEnabled, active]);

  const playShot = useCallback(() => {
    const shot = shotRef.current;
    if (!shot) return;

    if (shotStopTimerRef.current) {
      clearTimeout(shotStopTimerRef.current);
    }

    shot.pause();
    shot.currentTime = SHOT_START_SEC;

    const playPromise = shot.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }

    const stopPlayback = () => {
      if (shot.currentTime >= SHOT_END_SEC || shot.currentTime < SHOT_START_SEC) {
        shot.pause();
      }
    };

    shot.addEventListener('timeupdate', stopPlayback);
    shotStopTimerRef.current = setTimeout(() => {
      shot.pause();
      shot.removeEventListener('timeupdate', stopPlayback);
      shotStopTimerRef.current = null;
    }, (SHOT_END_SEC - SHOT_START_SEC) * 1000 + 80);
  }, []);

  const toggleMusic = useCallback(() => {
    setMusicEnabled((value) => !value);
  }, []);

  return {
    musicEnabled,
    toggleMusic,
    playShot,
  };
}
