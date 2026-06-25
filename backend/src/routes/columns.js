import express from 'express';
import prisma from '../db.js';

const router = express.Router();

// GET all columns for a board
router.get('/', async (req, res) => {
  const { boardId } = req.query;
  if (!boardId) {
    return res.status(400).json({ error: 'boardId is required' });
  }
  try {
    const columns = await prisma.column.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
    });
    res.json(columns);
  } catch (error) {
    console.error('Error fetching columns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create column
router.post('/', async (req, res) => {
  const { name, boardId, position, userId } = req.body;
  if (!name || !boardId || position === undefined) {
    return res.status(400).json({ error: 'name, boardId, and position are required' });
  }

  try {
    const column = await prisma.column.create({
      data: {
        name,
        boardId,
        position: parseFloat(position),
      },
    });

    if (userId) {
      await prisma.activityLog.create({
        data: {
          boardId,
          userId,
          action: 'CREATE_COLUMN',
          details: `Column "${name}" was created.`,
        },
      });
    }

    res.status(201).json(column);
  } catch (error) {
    console.error('Error creating column:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update column (name or position)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, position, userId } = req.body;

  try {
    const updatedColumn = await prisma.column.update({
      where: { id },
      data: {
        name,
        position: position !== undefined ? parseFloat(position) : undefined,
      },
    });

    if (userId) {
      await prisma.activityLog.create({
        data: {
          boardId: updatedColumn.boardId,
          userId,
          action: 'UPDATE_COLUMN',
          details: name ? `Column renamed to "${name}".` : `Column repositioned.`,
        },
      });
    }

    res.json(updatedColumn);
  } catch (error) {
    console.error('Error updating column:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE column
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query; // pass userId query param for activity logs if wanted

  try {
    const column = await prisma.column.delete({
      where: { id },
    });

    if (userId) {
      await prisma.activityLog.create({
        data: {
          boardId: column.boardId,
          userId: String(userId),
          action: 'DELETE_COLUMN',
          details: `Column "${column.name}" was deleted.`,
        },
      });
    }

    res.json({ message: 'Column deleted successfully' });
  } catch (error) {
    console.error('Error deleting column:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
