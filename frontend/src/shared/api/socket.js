import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});
