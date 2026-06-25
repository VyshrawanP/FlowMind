import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Socket connected to backend:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected from backend');
    });
  }
  return socket;
};

export const joinBoardRoom = (boardId: string) => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  s.emit('join-board', { boardId });
  console.log(`Requested to join board room: board:${boardId}`);
};

export const leaveBoardRoom = (boardId: string) => {
  const s = getSocket();
  if (s.connected) {
    s.emit('leave-board', { boardId });
    console.log(`Requested to leave board room: board:${boardId}`);
  }
};
