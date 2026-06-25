import express from 'express';
import prisma from '../db.js';
import { emitToBoard } from '../socket.js';

const router = express.Router();

// GET all cards for a column (optional, usually fetched via board endpoint)
router.get('/', async (req, res) => {
  const { columnId } = req.query;
  if (!columnId) {
    return res.status(400).json({ error: 'columnId query parameter is required' });
  }
  try {
    const cards = await prisma.card.findMany({
      where: { columnId },
      orderBy: { position: 'asc' },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
      },
    });
    res.json(cards);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create card
router.post('/', async (req, res) => {
  const { title, description, position, columnId, boardId, userId, labelIds } = req.body;
  if (!title || position === undefined || !columnId || !boardId || !userId) {
    return res.status(400).json({ error: 'title, position, columnId, boardId, and userId are required' });
  }

  try {
    const card = await prisma.card.create({
      data: {
        title,
        description,
        position: parseFloat(position),
        columnId,
        boardId,
        version: 0,
        labels: labelIds && labelIds.length > 0 ? {
          create: labelIds.map(labelId => ({
            label: { connect: { id: labelId } }
          }))
        } : undefined,
      },
      include: {
        labels: {
          include: { label: true }
        }
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        boardId,
        cardId: card.id,
        userId,
        action: 'CREATE_CARD',
        details: `Card "${title}" was created in column.`,
      },
    });

    // Broadcast to board room
    emitToBoard(boardId, 'card:created', card);

    res.status(201).json(card);
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update card (handles title, description, position, columnId, version conflict)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, position, columnId, version, userId, labelIds } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    // Fetch current card to compare versions and determine event types
    const existingCard = await prisma.card.findUnique({
      where: { id },
      include: {
        labels: true
      }
    });

    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Phase 2 Conflict Handling: last-write-wins using version
    // If version is provided, check if the client version is older than the DB version
    if (version !== undefined && existingCard.version > version) {
      console.log(`Conflict detected for card ${id}. Client version: ${version}, DB version: ${existingCard.version}`);
      return res.status(409).json({
        error: 'Conflict detected',
        message: 'Conflict detected. Latest version kept.',
        card: existingCard,
      });
    }

    const isMoved = (columnId !== undefined && columnId !== existingCard.columnId) || 
                    (position !== undefined && parseFloat(position) !== existingCard.position);

    // Prepare update data
    const updateData = {
      version: { increment: 1 },
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (position !== undefined) updateData.position = parseFloat(position);
    if (columnId !== undefined) updateData.columnId = columnId;

    // Handle label update if labelIds are provided
    if (labelIds !== undefined) {
      // Delete old connections
      await prisma.cardLabel.deleteMany({
        where: { cardId: id }
      });
      // Create new connections
      if (labelIds.length > 0) {
        updateData.labels = {
          create: labelIds.map(labelId => ({
            label: { connect: { id: labelId } }
          }))
        };
      }
    }

    const updatedCard = await prisma.card.update({
      where: { id },
      data: updateData,
      include: {
        labels: {
          include: { label: true }
        }
      }
    });

    // Create activity log
    let details = `Card "${updatedCard.title}" was updated.`;
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
        action: isMoved ? 'MOVE_CARD' : 'UPDATE_CARD',
        details,
      },
    });

    // Broadcast WebSocket events
    const eventName = isMoved ? 'card:moved' : 'card:updated';
    emitToBoard(updatedCard.boardId, eventName, updatedCard);

    res.json(updatedCard);
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE card
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required for tracking' });
  }

  try {
    const card = await prisma.card.findUnique({
      where: { id },
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    await prisma.card.delete({
      where: { id },
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        boardId: card.boardId,
        userId: String(userId),
        action: 'DELETE_CARD',
        details: `Card "${card.title}" was deleted.`,
      },
    });

    // Broadcast to board room
    emitToBoard(card.boardId, 'card:deleted', {
      cardId: id,
      boardId: card.boardId,
      columnId: card.columnId,
    });

    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
