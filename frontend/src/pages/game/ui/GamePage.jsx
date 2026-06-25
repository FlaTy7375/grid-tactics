import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { socket } from '@shared/api/socket';
import { createAvailableShips } from '@shared/config/defaultShipConfig';
import { useShipPlacement } from '@features/ship-placement/model/useShipPlacement';
import usePlacementCountdown, { formatCountdown } from '@features/game-session/model/usePlacementCountdown';
import useGameFeed from '@features/game-feed/model/useGameFeed';
import useGameAudio from '@features/game-audio/model/useGameAudio';
import GameBoards3D from '@widgets/game-board/ui/GameBoards3D';
import { BoardPlayerCard, BoardsSceneChrome } from '@widgets/game-board/ui/BoardsSceneChrome';
import ShipPlacementStage from '@widgets/ship-placement/ui/ShipPlacementStage';
import GameSplash from '@features/game-session/ui/GameSplash';
import GameNotifications from '@features/game-feed/ui/GameNotifications';
import BoardWaitingOverlay from '@features/game-session/ui/BoardWaitingOverlay';
import GameResultModal from '@features/game-session/ui/GameResultModal';
import { getShipCoords } from '@shared/lib/shipPlacementMath';
import './GamePage.css';

function mergeShipLists(...lists) {
  const shipMap = new Map();
  lists.flat().forEach((ship) => {
    if (ship?.id) shipMap.set(ship.id, ship);
  });
  return [...shipMap.values()];
}

const OPPONENT_SHOT_NOTIFICATIONS = new Set(['damaged', 'dodge', 'sunk_self']);

export default function GamePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [myId, setMyId] = useState(null);
  const [initialPlacementShips, setInitialPlacementShips] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const lastShotEventSeqRef = useRef(0);

  const gridSize = gameState?.gridSize || 10;
  const isPlacing = gameState?.status === 'placing';
  const isFinished = gameState?.status === 'finished';
  const isAudioActive = isPlacing || gameState?.status === 'playing' || isFinished;
  const placementSecondsLeft = usePlacementCountdown(gameState?.placementDeadline, isPlacing);
  const { musicEnabled, toggleMusic, playShot } = useGameAudio(isAudioActive);
  const {
    splashMessage,
    splashActive,
    toasts,
  } = useGameFeed(gameState, myId);

  const placement = useShipPlacement({
    gridSize,
    locked: isReady,
    initialShips: initialPlacementShips,
  });
  const timeoutSubmittedRef = useRef(false);

  useEffect(() => {
    if (!isPlacing) {
      timeoutSubmittedRef.current = false;
    }
  }, [isPlacing]);

  useEffect(() => {
    if (!isPlacing || placementSecondsLeft !== 0 || isReady || timeoutSubmittedRef.current) return;

    const ships = placement.autoPlace();
    if (!ships.length) return;

    timeoutSubmittedRef.current = true;
    setIsReady(true);
    socket.emit('player_ready', { sessionId, ships });
  }, [isPlacing, placementSecondsLeft, isReady, sessionId, placement]);

  useEffect(() => {
    const userId = localStorage.getItem('battleshipUserId');
    if (!userId) {
      navigate('/');
      return;
    }
    setMyId(userId);

    const onGameState = (state) => {
      setGameState(state);

      if (state.status === 'placing' && state.shipConfig) {
        setInitialPlacementShips((prev) => (
          prev.length > 0 ? prev : createAvailableShips(state.shipConfig)
        ));
      }

      if (state.status === 'playing' || state.status === 'finished') {
        setIsReady(true);
      }
    };

    const onOpponentDisconnected = () => {
      alert('Соперник отключился!');
      navigate('/lobby');
    };

    socket.emit('join_session', sessionId);
    socket.on('game_state', onGameState);
    socket.on('opponent_disconnected', onOpponentDisconnected);

    return () => {
      socket.off('game_state', onGameState);
      socket.off('opponent_disconnected', onOpponentDisconnected);
    };
  }, [sessionId, navigate]);

  useEffect(() => {
    if (!gameState?.eventSeq || gameState.eventSeq === lastShotEventSeqRef.current) return;

    const notifications = gameState.notifications || [];
    if (notifications.some((item) => OPPONENT_SHOT_NOTIFICATIONS.has(item.type))) {
      playShot();
    }

    lastShotEventSeqRef.current = gameState.eventSeq;
  }, [gameState, playShot]);

  const playingOpponentShips = React.useMemo(() => {
    if (!gameState || isPlacing) return [];
    return gameState.revealedOpponentShips || [];
  }, [gameState, isPlacing]);

  const playingRevealedOpponentCells = React.useMemo(() => {
    const cells = new Set();
    playingOpponentShips.forEach((ship) => {
      const coords = getShipCoords(ship.index, ship.size, ship.isVertical, gridSize);
      coords?.forEach((idx) => cells.add(idx));
    });
    return cells;
  }, [playingOpponentShips, gridSize]);

  const getOpponentShotState = (index) => {
    const board = gameState.opponentBoard;
    if (!board) return null;
    return board[index] ?? board[String(index)] ?? null;
  };

  const getPlayingCellState = (index, type) => {
    if (type === 'opponent') {
      const shot = getOpponentShotState(index);
      if (shot === 'hit' || shot === 'miss') return shot;
      if (playingRevealedOpponentCells.has(index)) return 'placed';

      const isMyTurn = gameState.currentTurn === myId;
      if (gameState.status !== 'playing' || !isMyTurn) return 'disabled';
      return 'default';
    }

    if (gameState.myBoard && gameState.myBoard[index]) {
      const cell = gameState.myBoard[index];
      if (cell === 'ship') return 'placed';
      if (cell === 'hit') return 'hit';
      if (cell === 'miss') return 'miss';
    }
    return 'default';
  };

  const playingSelfShips = React.useMemo(() => {
    if (!gameState || isPlacing) return [];
    const base = gameState.myShips?.length ? gameState.myShips : (placement.myShips || []);
    return mergeShipLists(base, gameState.sunkMyShips || []);
  }, [gameState, isPlacing, placement.myShips]);

  const playingSelfStates = React.useMemo(() => {
    if (!gameState || isPlacing) return [];
    return Array.from({ length: gridSize * gridSize }, (_, index) => getPlayingCellState(index, 'self'));
  }, [gameState, gridSize, isPlacing, myId]);

  const playingOpponentStates = React.useMemo(() => {
    if (!gameState || isPlacing) return [];
    return Array.from({ length: gridSize * gridSize }, (_, index) => getPlayingCellState(index, 'opponent'));
  }, [gameState, gridSize, isPlacing, myId, playingRevealedOpponentCells]);

  const handleOpponentCellClick = (index) => {
    if (gameState.status !== 'playing' || gameState.currentTurn !== myId) return;
    const shot = getOpponentShotState(index);
    if (shot === 'hit' || shot === 'miss') return;
    playShot();
    socket.emit('fire', { sessionId, index });
  };

  const handleReady = () => {
    setIsReady(true);
    socket.emit('player_ready', { sessionId, ships: placement.myShips });
  };

  if (!gameState) {
    return (
      <main className="game-stage">
        <div className="game-container game-container--loading">
          <div className="game-loading glass-panel">Загрузка поля...</div>
        </div>
      </main>
    );
  }

  const isMyTurn = gameState.status === 'playing' && gameState.currentTurn === myId;
  const isOpponentTurn = gameState.status === 'playing' && gameState.currentTurn !== myId;
  const opponentName = gameState.hostId === myId ? gameState.guestName : gameState.hostName;
  const opponentInteractive = gameState.status === 'playing' && gameState.currentTurn === myId;
  const timerUrgent = placementSecondsLeft !== null && placementSecondsLeft <= 15;
  const isVictory = isFinished && gameState.winner === myId;

  return (
    <main className="game-stage game-stage--session">
      <GameSplash message={splashMessage} active={splashActive} />
      <GameNotifications items={toasts} />

      {isFinished && (
        <GameResultModal
          isVictory={isVictory}
          opponentName={opponentName}
          onLobby={() => navigate('/lobby')}
        />
      )}

      <header className="game-header glass-panel">
        <div className="game-brand">
          <img src="/grid-tactics-logo.svg" alt="" className="game-logo" width={36} height={36} />
          <div>
            <span className="lobby-eyebrow">Grid Tactics</span>
            <h1 className="game-title">Поле боя</h1>
            <p className="game-session-id">Партия · {sessionId.slice(0, 8)}</p>
          </div>
        </div>

        <div className="game-header-center">
          {isPlacing && placementSecondsLeft !== null && (
            <div className={`game-timer ${timerUrgent ? 'game-timer--urgent' : ''}`}>
              <span className="game-timer__label">Время</span>
              <span className="game-timer__value">{formatCountdown(placementSecondsLeft)}</span>
            </div>
          )}

          <div className={`game-status ${isMyTurn ? 'your-turn' : isOpponentTurn ? 'enemy-turn' : ''}`}>
            {gameState.status === 'waiting' && 'Ждём соперника'}
            {gameState.status === 'placing' && (isReady ? 'Ждём соперника' : 'Расставь фигуры')}
            {isMyTurn && 'Твой ход'}
            {isOpponentTurn && 'Ход соперника'}
            {isFinished && (isVictory ? 'Победа!' : 'Поражение')}
          </div>
        </div>

        <div className="game-header-actions">
          <button
            className={`btn-secondary game-music-btn ${musicEnabled ? 'game-music-btn--on' : ''}`}
            onClick={toggleMusic}
            type="button"
            title={musicEnabled ? 'Выключить музыку' : 'Включить музыку'}
            aria-pressed={musicEnabled}
          >
            {musicEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span>{musicEnabled ? 'Музыка' : 'Тишина'}</span>
          </button>

          <button onClick={() => navigate('/lobby')} className="btn-secondary game-back-btn" type="button">
            В лобби
          </button>
        </div>
      </header>

      <div className="game-container">
        {isPlacing ? (
          <ShipPlacementStage
            gridSize={gridSize}
            opponentName={opponentName || '...'}
            placement={placement}
            locked={isReady}
            onReady={handleReady}
            showPlacementPanel={!isReady}
            selfReadyOverlay={isReady}
            opponentPlacing
          />
        ) : (
          <div className="boards-layout">
            <BoardsSceneChrome
              selfCard={<BoardPlayerCard side="self" title="Твоё поле" name="Ты" />}
              opponentCard={(
                <BoardPlayerCard
                  side="opponent"
                  title="Поле соперника"
                  name={opponentName || '...'}
                />
              )}
              overlay={gameState.status === 'waiting' && (
                <BoardWaitingOverlay
                  side="opponent"
                  title="Ждём соперника"
                  hint="Как только он подключится, начнётся расстановка"
                />
              )}
            >
              <GameBoards3D
                gridSize={gridSize}
                selfStates={playingSelfStates}
                opponentStates={playingOpponentStates}
                selfShips={playingSelfShips}
                opponentShips={playingOpponentShips}
                selfInteractive={false}
                opponentInteractive={opponentInteractive}
                onSelfCellClick={() => {}}
                onOpponentCellClick={handleOpponentCellClick}
                isPlacing={false}
              />
            </BoardsSceneChrome>
          </div>
        )}
      </div>
    </main>
  );
}
