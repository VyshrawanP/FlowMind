import prisma from '../db.js';

export async function getMetrics(req, res, next) {
  try {
    const totalUsers = await prisma.user.count();
    const totalBoards = await prisma.board.count();
    const totalCards = await prisma.card.count();
    const totalColumns = await prisma.column.count();
    const totalComments = await prisma.comment.count();

    const recentLogs = await prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    return res.json({
      success: true,
      metrics: {
        totalUsers,
        totalBoards,
        totalCards,
        totalColumns,
        totalComments
      },
      recentLogs
    });
  } catch (error) {
    next(error);
  }
}

export async function getUsersList(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(users);
  } catch (error) {
    next(error);
  }
}

export async function updateUserRole(req, res, next) {
  const { id } = req.params;
  const { role } = req.body;

  if (role !== 'USER' && role !== 'ADMIN') {
    return res.status(400).json({ error: 'ValidationError', message: 'Role must be USER or ADMIN.' });
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'UserNotFound', message: 'Target user not found.' });
    }

    // Prevent removing admin role from oneself (optional safeguard)
    if (targetUser.id === req.user.id && role !== 'ADMIN') {
      return res.status(400).json({ error: 'ActionBlocked', message: 'You cannot revoke your own administrator privileges.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true }
    });

    return res.json({
      success: true,
      message: `User role updated to ${role} successfully.`,
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  const { id } = req.params;

  try {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'UserNotFound', message: 'Target user not found.' });
    }

    // Prevent deleting oneself
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'ActionBlocked', message: 'You cannot delete your own administrator account.' });
    }

    await prisma.user.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'User account and all associated boards/cards deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}
