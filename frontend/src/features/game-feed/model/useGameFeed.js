import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '@shared/api/socket';

const SPLASH_BY_STATUS = {
  placing: 'Расстановка',
  playing: 'К бою!',
};

const NOTIFICATION_TONE = {
  hit: 'hit',
  sunk: 'hit',
  miss: 'miss',
  damaged: 'danger',
  sunk_self: 'danger',
  dodge: 'safe',
  turn: 'turn',
  timeout: 'warn',
  win: 'safe',
  lose: 'danger',
};

const NOTIFICATION_LIFETIME_MS = 3200;

function mapServerNotification(notification) {
  if (!notification || notification.type === 'wait' || notification.type === 'turn') return null;

  return {
    tone: NOTIFICATION_TONE[notification.type] || 'info',
    title: notification.title,
    text: notification.text,
  };
}

function collectNotifications(gameState) {
  if (!gameState) return [];

  if (Array.isArray(gameState.notifications) && gameState.notifications.length > 0) {
    return gameState.notifications;
  }

  if (gameState.notification) {
    return [gameState.notification];
  }

  return [];
}

export default function useGameFeed(gameState, myId) {
  const prevStatusRef = useRef(null);
  const seenNotificationIdsRef = useRef(new Set());
  const lastNotificationBatchRef = useRef('');
  const lastEventSeqRef = useRef(0);
  const [splashMessage, setSplashMessage] = useState('');
  const [splashActive, setSplashActive] = useState(false);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((payload) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, ...payload }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, NOTIFICATION_LIFETIME_MS);
  }, []);

  const enqueueServerNotifications = useCallback((notifications) => {
    if (!notifications.length) return;

    notifications.forEach((notification, index) => {
      if (notification.id && seenNotificationIdsRef.current.has(notification.id)) {
        return;
      }

      if (notification.id) {
        seenNotificationIdsRef.current.add(notification.id);
      }

      window.setTimeout(() => {
        const mapped = mapServerNotification(notification);
        if (mapped) pushToast(mapped);
      }, index * 160);
    });
  }, [pushToast]);

  useEffect(() => {
    const onNotification = (notification) => {
      enqueueServerNotifications([notification]);
    };

    socket.on('player_notification', onNotification);
    return () => {
      socket.off('player_notification', onNotification);
    };
  }, [enqueueServerNotifications]);

  useEffect(() => {
    if (!gameState || !myId) return;

    const prevStatus = prevStatusRef.current;
    const nextStatus = gameState.status;

    if (prevStatus !== nextStatus && SPLASH_BY_STATUS[nextStatus]) {
      setSplashMessage(SPLASH_BY_STATUS[nextStatus]);
      setSplashActive(true);
    }

    prevStatusRef.current = nextStatus;
  }, [gameState, myId]);

  useEffect(() => {
    if (!gameState) return;

    const eventSeq = gameState.eventSeq || 0;
    const notifications = collectNotifications(gameState);

    if (eventSeq > 0 && eventSeq === lastEventSeqRef.current && !notifications.length) {
      return;
    }

    if (notifications.length > 0) {
      const batchKey = notifications
        .map((notification, index) => (
          notification.id
          || `${notification.type}:${notification.title}:${notification.text}:${index}`
        ))
        .join('|');

      if (batchKey && batchKey !== lastNotificationBatchRef.current) {
        lastNotificationBatchRef.current = batchKey;
        enqueueServerNotifications(notifications);
      }
    }

    if (eventSeq > 0) {
      lastEventSeqRef.current = eventSeq;
    }
  }, [gameState, enqueueServerNotifications]);

  return {
    splashMessage,
    splashActive,
    toasts,
  };
}
