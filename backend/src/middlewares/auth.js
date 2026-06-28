import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../db.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Access token is required.' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Fetch the latest user status from DB to ensure they are verified & active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'UserNotFound', message: 'User account no longer exists.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'UnverifiedAccount', message: 'Account must be verified via OTP first.' });
    }

    // Attach user payload to request
    req.user = user;
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return res.status(403).json({ error: 'Forbidden', message: 'Token is invalid or has expired.' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden', message: 'Administrator role is required for this action.' });
  }
  next();
}
