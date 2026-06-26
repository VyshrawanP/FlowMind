import prisma from '../db.js';

export async function getColumns(req, res, next) {
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
    next(error);
  }
}

export async function createColumn(req, res, next) {
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
    next(error);
  }
}

export async function updateColumn(req, res, next) {
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
    next(error);
  }
}

export async function deleteColumn(req, res, next) {
  const { id } = req.params;
  const { userId } = req.query;

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
    next(error);
  }
}
