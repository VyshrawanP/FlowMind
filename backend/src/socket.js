import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import prisma from './db.js';

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

    socket.on('card:move', async ({ cardId, columnId, position, version, userId }) => {
      if (!cardId || !columnId || position === undefined || version === undefined || !userId) {
        console.error('WS Error: invalid card:move payload received', { cardId, columnId, position, version, userId });
        return;
      }
      try {
        const existingCard = await prisma.card.findUnique({
          where: { id: cardId },
          include: { labels: { include: { label: true } } }
        });

        if (!existingCard) {
          socket.emit('card:move:failed', { cardId, error: 'Card not found' });
          return;
        }

        // Conflict check
        if (existingCard.version > version) {
          console.log(`Socket Conflict: card ${cardId}. Client version: ${version}, DB version: ${existingCard.version}`);
          socket.emit('card:move:failed', {
            cardId,
            error: 'Conflict detected. Latest version kept.',
            card: existingCard
          });
          return;
        }

        const isMoved = existingCard.columnId !== columnId || existingCard.position !== parseFloat(position);

        // Atomic update checking version to prevent race conditions
        const updateResult = await prisma.card.updateMany({
          where: {
            id: cardId,
            version: version
          },
          data: {
            columnId,
            position: parseFloat(position),
            version: { increment: 1 }
          }
        });

        if (updateResult.count === 0) {
          // If no rows matched, it means another client raced and updated it first!
          const freshCard = await prisma.card.findUnique({
            where: { id: cardId },
            include: { labels: { include: { label: true } } }
          });
          console.log(`Socket Race Conflict: card ${cardId}. Client version: ${version}, DB version: ${freshCard?.version}`);
          socket.emit('card:move:failed', {
            cardId,
            error: 'Conflict detected. Latest version kept.',
            card: freshCard
          });
          return;
        }

        // Fetch the updated card with relations for broadcast
        const updatedCard = await prisma.card.findUnique({
          where: { id: cardId },
          include: {
            labels: {
              include: { label: true }
            }
          }
        });

        // Write activity log
        let details = `Card "${updatedCard.title}" was moved.`;
        if (isMoved) {
          const fromColumn = await prisma.column.findUnique({ where: { id: existingCard.columnId } });
          const toColumn = await prisma.column.findUnique({ where: { id: updatedCard.columnId } });
          details = `Card "${updatedCard.title}" moved from column "${fromColumn?.name || 'Unknown'}" to "${toColumn?.name || 'Unknown'}".`;
        }

        await prisma.activityLog.create({
          data: {
            boardId: updatedCard.boardId,
            cardId: updatedCard.id,
            userId,
            action: 'MOVE_CARD',
            details
          }
        });

        // Broadcast card:moved to ALL clients in the board room
        const room = `board:${updatedCard.boardId}`;
        console.log(`Broadcasting card:moved for card ${cardId} to room ${room}`);
        io.to(room).emit('card:moved', updatedCard);

      } catch (error) {
        console.error('Error handling card:move via websocket:', error);
        socket.emit('card:move:failed', { cardId, error: 'Internal database error' });
      }
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
