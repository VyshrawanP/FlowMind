import express from 'express';
import prisma from '../db.js';

const router = express.Router();

// GET all boards
router.get('/', async (req, res) => {
  try {
    const boards = await prisma.board.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(boards);
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single board with its columns and cards, sorted by position
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        columns: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              orderBy: { position: 'asc' },
              include: {
                comments: {
                  orderBy: { createdAt: 'desc' },
                  include: {
                    user: { select: { id: true, name: true } },
                  },
                },
                labels: {
                  include: {
                    label: true,
                  },
                },
              },
            },
          },
        },
        labels: true,
        activityLogs: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.json(board);
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create board
router.post('/', async (req, res) => {
  const { name, description, ownerId } = req.body;
  if (!name || !ownerId) {
    return res.status(400).json({ error: 'Name and ownerId are required' });
  }

  try {
    // Verify owner exists
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
    });
    if (!owner) {
      return res.status(404).json({ error: 'Owner user not found' });
    }

    const board = await prisma.board.create({
      data: {
        name,
        description,
        ownerId,
        columns: {
          create: [
            { name: 'To Do', position: 1000.0 },
            { name: 'In Progress', position: 2000.0 },
            { name: 'Done', position: 3000.0 },
          ],
        },
      },
      include: {
        columns: true,
      },
    });

    // Create action in activity log
    await prisma.activityLog.create({
      data: {
        boardId: board.id,
        userId: ownerId,
        action: 'CREATE_BOARD',
        details: `Board "${name}" was created.`,
      },
    });

    res.status(201).json(board);
  } catch (error) {
    console.error('Error creating board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update board
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, userId } = req.body;

  try {
    const updatedBoard = await prisma.board.update({
      where: { id },
      data: {
        name,
        description,
      },
    });

    if (userId) {
      await prisma.activityLog.create({
        data: {
          boardId: id,
          userId,
          action: 'UPDATE_BOARD',
          details: `Board details updated. Name: "${name}".`,
        },
      });
    }

    res.json(updatedBoard);
  } catch (error) {
    console.error('Error updating board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE board
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.board.delete({
      where: { id },
    });
    res.json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error('Error deleting board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
