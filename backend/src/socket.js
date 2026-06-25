import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for dev
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      console.log('Connecting to Redis for Socket.io adapter...');
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
      });
      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => {
        console.error('Redis pubClient error:', err.message);
      });
      subClient.on('error', (err) => {
        console.error('Redis subClient error:', err.message);
      });

      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.io Redis adapter initialized successfully.');
    } catch (error) {
      console.error('Failed to configure Socket.io Redis adapter, falling back to local adapter:', error);
    }
  } else {
    console.log('No REDIS_URL provided. Using default in-memory Socket.io adapter.');
  }

  io.on('connection', (socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    // Clients join room "board:{boardId}" on connect or explicit join
    socket.on('join-board', ({ boardId }) => {
      if (!boardId) return;
      const room = `board:${boardId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('leave-board', ({ boardId }) => {
      if (!boardId) return;
      const room = `board:${boardId}`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
}

export function emitToBoard(boardId, event, data) {
  if (!io) return;
  const room = `board:${boardId}`;
  console.log(`Emitting event "${event}" to room "${room}"`);
  io.to(room).emit(event, data);
}
