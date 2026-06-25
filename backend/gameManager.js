const { v4: uuidv4 } = require('uuid');
const { autoPlaceShips, getSurroundingCells, DEFAULT_SHIP_CONFIG } = require('./shipPlacement');

const PLACEMENT_DURATION_MS = 90_000;
const connectedUsers = new Map();
const nameCounts = new Map();
const sessions = new Map();
const playerStats = new Map();

function getPlayerSocketId(session, playerId) {
  if (playerId === session.hostId) return session.hostSocketId;
  if (playerId === session.guestId) return session.guestSocketId;
  return null;
}

function pushPlayerNotification(io, session, playerId, notification) {
  if (!playerId) return null;
  if (!session.notifications) session.notifications = {};
  if (!session.notificationSeq) session.notificationSeq = 0;
  if (!session.notifications[playerId]) session.notifications[playerId] = [];

  session.notificationSeq += 1;
  const payload = {
    ...notification,
    id: `${session.id}-${session.notificationSeq}`,
  };

  session.notifications[playerId].push(payload);

  const socketId = getPlayerSocketId(session, playerId);
  if (socketId) {
    io.to(socketId).emit('player_notification', payload);
  }

  return payload;
}

function markShipCellsAsHit(board, ship, gridSize) {
  if (!ship) return;
  for (let i = 0; i < ship.size; i += 1) {
    const idx = ship.isVertical ? ship.index + (i * gridSize) : ship.index + i;
    board[idx] = 'hit';
  }
}

function clearPlacementTimer(session) {
  if (session.placementTimer) {
    clearTimeout(session.placementTimer);
    session.placementTimer = null;
  }
}

function applyPlayerShips(session, userId, ships) {
  const isHost = session.hostId === userId;

  if (isHost) {
    session.hostShips = ships;
    session.hostReady = true;
    session.hostBoard = {};
    session.hostShipHealth = {};
    ships.forEach((ship) => {
      session.hostShipHealth[ship.id] = ship.size;
      for (let i = 0; i < ship.size; i += 1) {
        const idx = ship.isVertical ? ship.index + (i * session.gridSize) : ship.index + i;
        session.hostBoard[idx] = `ship_${ship.id}`;
      }
    });
    return;
  }

  if (session.guestId === userId) {
    session.guestShips = ships;
    session.guestReady = true;
    session.guestBoard = {};
    session.guestShipHealth = {};
    ships.forEach((ship) => {
      session.guestShipHealth[ship.id] = ship.size;
      for (let i = 0; i < ship.size; i += 1) {
        const idx = ship.isVertical ? ship.index + (i * session.gridSize) : ship.index + i;
        session.guestBoard[idx] = `ship_${ship.id}`;
      }
    });
  }
}

function tryStartBattle(session, io) {
  if (!session.hostReady || !session.guestReady) return false;

  clearPlacementTimer(session);
  session.placementDeadline = null;
  session.status = 'playing';
  session.currentTurn = session.hostId;

  return true;
}

function startPlacementPhase(session, io) {
  session.status = 'placing';
  session.hostReady = false;
  session.guestReady = false;
  session.hostShips = [];
  session.guestShips = [];
  session.hostBoard = {};
  session.guestBoard = {};
  session.hostShipHealth = {};
  session.guestShipHealth = {};
  session.placementDeadline = Date.now() + PLACEMENT_DURATION_MS;

  clearPlacementTimer(session);
  session.placementTimer = setTimeout(() => {
    finalizePlacementTimeout(io, session);
  }, PLACEMENT_DURATION_MS);
}

function finalizePlacementTimeout(io, session) {
  if (!session || session.status !== 'placing') return;

  if (!session.hostReady) {
    const ships = autoPlaceShips(session.gridSize, session.shipConfig);
    applyPlayerShips(session, session.hostId, ships);
    pushPlayerNotification(io, session, session.hostId, {
      type: 'timeout',
      title: 'Время вышло',
      text: 'Корабли расставлены автоматически',
    });
  }

  if (!session.guestReady) {
    const ships = autoPlaceShips(session.gridSize, session.shipConfig);
    applyPlayerShips(session, session.guestId, ships);
    pushPlayerNotification(io, session, session.guestId, {
      type: 'timeout',
      title: 'Время вышло',
      text: 'Корабли расставлены автоматически',
    });
  }

  tryStartBattle(session, io);
  broadcastGameStateToSession(io, session);
}

function initGameManager(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register', ({ name, userId }) => {
      const originalName = name.trim();
      let assignedName = originalName;
      let finalUserId = userId;

      if (!finalUserId) {
        finalUserId = uuidv4();
        playerStats.set(finalUserId, { wins: 0, losses: 0, matches: 0 });
      }

      let isNameInUse = false;
      for (const [, user] of connectedUsers) {
        if (user.originalName === originalName) {
          isNameInUse = true;
          break;
        }
      }

      if (isNameInUse) {
        const count = (nameCounts.get(originalName) || 1) + 1;
        nameCounts.set(originalName, count);
        assignedName = `${originalName} ${count}`;
      } else {
        nameCounts.set(originalName, 1);
      }

      connectedUsers.set(socket.id, {
        socketId: socket.id,
        id: finalUserId,
        name: assignedName,
        originalName,
      });

      socket.emit('registered', {
        id: finalUserId,
        name: assignedName,
        stats: playerStats.get(finalUserId) || { wins: 0, losses: 0, matches: 0 },
      });

      broadcastLobbyUpdate(io);
    });

    socket.on('get_lobby', () => {
      const activeSessions = Array.from(sessions.values())
        .filter((s) => s.status === 'waiting')
        .map((s) => ({
          id: s.id,
          hostName: s.hostName,
          gridSize: s.gridSize,
          gameMode: s.gameMode || 'classic',
        }));
      socket.emit('lobby_update', activeSessions);
    });

    socket.on('create_session', (config) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const sessionId = uuidv4();
      const session = {
        id: sessionId,
        hostId: user.id,
        hostName: user.name,
        hostSocketId: socket.id,
        guestId: null,
        guestName: null,
        guestSocketId: null,
        gridSize: config.gridSize || 10,
        gameMode: config.gameMode || 'classic',
        shipConfig: config.shipConfig || DEFAULT_SHIP_CONFIG,
        status: 'waiting',
      };

      sessions.set(sessionId, session);
      socket.join(sessionId);

      socket.emit('session_created', session);
      broadcastLobbyUpdate(io);
    });

    socket.on('join_session', (sessionId) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const session = sessions.get(sessionId);
      if (!session) {
        socket.emit('error', 'Session not found');
        return;
      }

      socket.join(sessionId);

      if (user.id === session.hostId) {
        session.hostSocketId = socket.id;
      } else if (user.id === session.guestId) {
        session.guestSocketId = socket.id;
      }

      if (session.hostId !== user.id && !session.guestId && session.status === 'waiting') {
        session.guestId = user.id;
        session.guestName = user.name;
        session.guestSocketId = socket.id;
        startPlacementPhase(session, io);
        broadcastLobbyUpdate(io);
      }

      broadcastGameStateToSession(io, session);
    });

    socket.on('player_ready', ({ sessionId, ships }) => {
      const user = connectedUsers.get(socket.id);
      const session = sessions.get(sessionId);
      if (!user || !session || session.status !== 'placing') return;
      if (session.placementDeadline && Date.now() > session.placementDeadline) return;

      const isHost = session.hostId === user.id;
      const isGuest = session.guestId === user.id;
      if (!isHost && !isGuest) return;
      if ((isHost && session.hostReady) || (isGuest && session.guestReady)) return;

      applyPlayerShips(session, user.id, ships);
      tryStartBattle(session, io);
      broadcastGameStateToSession(io, session);
    });

    socket.on('fire', ({ sessionId, index }) => {
      const user = connectedUsers.get(socket.id);
      const session = sessions.get(sessionId);
      if (!user || !session || session.status !== 'playing' || session.currentTurn !== user.id) return;

      const isHost = session.hostId === user.id;
      const targetBoard = isHost ? session.guestBoard : session.hostBoard;
      const targetShipHealth = isHost ? session.guestShipHealth : session.hostShipHealth;
      const targetShips = isHost ? session.guestShips : session.hostShips;
      const opponentId = isHost ? session.guestId : session.hostId;

      if (targetBoard[index] === 'hit' || targetBoard[index] === 'miss') return;

      let hit = false;
      const cellVal = targetBoard[index];

      if (cellVal && cellVal.startsWith('ship_')) {
        const shipId = cellVal.replace('ship_', '');
        targetBoard[index] = 'hit';
        hit = true;
        targetShipHealth[shipId] -= 1;

        const sunk = targetShipHealth[shipId] === 0;
        if (sunk) {
          const shipObj = targetShips.find((s) => s.id === shipId);
          if (shipObj) {
            markShipCellsAsHit(targetBoard, shipObj, session.gridSize);
            const surrounding = getSurroundingCells(
              shipObj.index,
              shipObj.size,
              shipObj.isVertical,
              session.gridSize,
            );
            for (const surrIdx of surrounding) {
              if (!targetBoard[surrIdx] || targetBoard[surrIdx].startsWith('ship_')) {
                targetBoard[surrIdx] = 'miss';
              }
            }
          }

          pushPlayerNotification(io, session, user.id, {
            type: 'sunk',
            title: 'Потоплено!',
            text: 'Корабль соперника уничтожен',
          });
          pushPlayerNotification(io, session, opponentId, {
            type: 'sunk_self',
            title: 'Корабль потоплен',
            text: 'Враг уничтожил один из кораблей',
          });
        } else {
          pushPlayerNotification(io, session, user.id, {
            type: 'hit',
            title: 'Попадание!',
            text: 'Продолжай огонь по цели',
          });
          pushPlayerNotification(io, session, opponentId, {
            type: 'damaged',
            title: 'По нам попали!',
            text: 'Враг повредил корабль',
          });
        }
      } else {
        targetBoard[index] = 'miss';
        pushPlayerNotification(io, session, user.id, {
          type: 'miss',
          title: 'Мимо',
          text: 'Залп ушёл в воду',
        });
        pushPlayerNotification(io, session, opponentId, {
          type: 'dodge',
          title: 'Промах врага',
          text: 'Соперник не попал',
        });
      }

      const checkWin = (healthMap) => {
        for (const key in healthMap) {
          if (healthMap[key] > 0) return false;
        }
        return true;
      };

      if (checkWin(targetShipHealth)) {
        session.status = 'finished';
        session.winner = user.id;

        pushPlayerNotification(io, session, user.id, {
          type: 'win',
          title: 'Победа!',
          text: 'Весь флот соперника потоплен',
        });

        const loserId = isHost ? session.guestId : session.hostId;
        pushPlayerNotification(io, session, loserId, {
          type: 'lose',
          title: 'Поражение',
          text: 'Твой флот уничтожен',
        });

        const winnerStats = playerStats.get(user.id);
        if (winnerStats) {
          winnerStats.wins += 1;
          winnerStats.matches += 1;
        }

        const loserStats = playerStats.get(loserId);
        if (loserStats) {
          loserStats.losses += 1;
          loserStats.matches += 1;
        }
      } else if (!hit) {
        session.currentTurn = opponentId;
      }

      broadcastGameStateToSession(io, session);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      connectedUsers.delete(socket.id);

      for (const [sessionId, session] of sessions) {
        if (session.hostSocketId === socket.id || session.guestSocketId === socket.id) {
          clearPlacementTimer(session);
          io.to(sessionId).emit('opponent_disconnected');
          sessions.delete(sessionId);
        }
      }
      broadcastLobbyUpdate(io);
    });
  });
}

function broadcastLobbyUpdate(io) {
  const activeSessions = Array.from(sessions.values())
    .filter((s) => s.status === 'waiting')
    .map((s) => ({
      id: s.id,
      hostName: s.hostName,
      gridSize: s.gridSize,
    }));

  io.emit('lobby_update', activeSessions);
}

function getRevealedOpponentShips(session, forHost) {
  const opponentShips = forHost ? session.guestShips : session.hostShips;
  const opponentHealth = forHost ? session.guestShipHealth : session.hostShipHealth;

  if (!opponentShips?.length) return [];
  if (session.status !== 'playing' && session.status !== 'finished') return [];

  return opponentShips.filter((ship) => opponentHealth?.[ship.id] === 0);
}

function getSunkMyShips(session, forHost) {
  const myShips = forHost ? session.hostShips : session.guestShips;
  const myHealth = forHost ? session.hostShipHealth : session.guestShipHealth;

  if (!myShips?.length) return [];
  if (session.status !== 'playing' && session.status !== 'finished') return [];

  return myShips.filter((ship) => myHealth?.[ship.id] === 0);
}

function broadcastGameStateToSession(io, session) {
  session.eventSeq = (session.eventSeq || 0) + 1;

  const buildState = (forHost) => {
    const playerId = forHost ? session.hostId : session.guestId;

    const state = {
      id: session.id,
      gridSize: session.gridSize,
      gameMode: session.gameMode || 'classic',
      shipConfig: session.shipConfig,
      status: session.status,
      hostId: session.hostId,
      guestId: session.guestId,
      hostName: session.hostName,
      guestName: session.guestName,
      currentTurn: session.currentTurn,
      winner: session.winner,
      placementDeadline: session.status === 'placing' ? session.placementDeadline : null,
      notifications: session.notifications?.[playerId] || [],
      eventSeq: session.eventSeq || 0,
    };

    const myBoardRaw = forHost ? session.hostBoard : session.guestBoard;
    const oppBoardRaw = forHost ? session.guestBoard : session.hostBoard;

    state.myBoard = {};
    if (myBoardRaw) {
      for (const [idx, val] of Object.entries(myBoardRaw)) {
        if (val.startsWith('ship_')) state.myBoard[idx] = 'ship';
        else state.myBoard[idx] = val;
      }
    }

    state.opponentBoard = {};
    if (oppBoardRaw) {
      for (const [idx, val] of Object.entries(oppBoardRaw)) {
        if (val === 'hit' || val === 'miss') {
          state.opponentBoard[idx] = val;
        }
      }
    }

    state.myShips = [];
    state.revealedOpponentShips = [];
    state.sunkMyShips = [];
    if (session.status === 'playing' || session.status === 'finished') {
      state.myShips = forHost ? (session.hostShips || []) : (session.guestShips || []);
      state.revealedOpponentShips = getRevealedOpponentShips(session, forHost);
      state.sunkMyShips = getSunkMyShips(session, forHost);
    }

    return state;
  };

  if (session.hostSocketId) {
    io.to(session.hostSocketId).emit('game_state', buildState(true));
  }
  if (session.guestSocketId) {
    io.to(session.guestSocketId).emit('game_state', buildState(false));
  }

  session.notifications = {};
}

module.exports = { initGameManager };
