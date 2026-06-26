import prisma from '../db.js';

export async function getUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
}

export async function createOrGetUser(req, res, next) {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
        },
      });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
}
