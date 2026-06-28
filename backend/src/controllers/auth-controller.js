import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../db.js';
import { sendOtpEmail } from '../services/email-service.js';

// Helper to generate 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function signup(req, res, next) {
  const { email, password, name } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'ValidationError', message: 'Email and password are required.' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'UserExists', message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const otpCode = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    // Create user in DB (unverified by default)
    const newUser = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        passwordHash,
        isVerified: false,
        otpCode,
        otpExpires,
      }
    });

    // Send verification OTP via email service
    await sendOtpEmail(newUser.email, otpCode, otpExpires);

    return res.status(201).json({
      message: 'Account created. Verification OTP code sent to your email.',
      email: newUser.email,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyOtp(req, res, next) {
  const { email, otpCode } = req.body;

  if (!email || !otpCode) {
    return res.status(400).json({ error: 'ValidationError', message: 'Email and OTP code are required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'UserNotFound', message: 'User account not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'AlreadyVerified', message: 'Account is already verified.' });
    }

    if (user.otpCode !== otpCode) {
      return res.status(400).json({ error: 'InvalidOtp', message: 'Incorrect OTP code.' });
    }

    if (user.otpExpires && new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ error: 'ExpiredOtp', message: 'OTP code has expired. Please request a new one.' });
    }

    // Mark as verified & clear OTP values
    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpires: null
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: verifiedUser.id, email: verifiedUser.email, role: verifiedUser.role },
      config.jwtSecret,
      { expiresIn: '2h' }
    );

    return res.json({
      message: 'OTP verification successful. Account is active.',
      token,
      user: {
        id: verifiedUser.id,
        email: verifiedUser.email,
        name: verifiedUser.name,
        role: verifiedUser.role
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'ValidationError', message: 'Email and password are required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'AuthFailed', message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'AuthFailed', message: 'Invalid email or password.' });
    }

    // Verify OTP first if account is not verified
    if (!user.isVerified) {
      return res.status(403).json({
        error: 'UnverifiedAccount',
        message: 'Account not verified. Please complete OTP verification.',
        email: user.email
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '2h' }
    );

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function resendOtp(req, res, next) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'ValidationError', message: 'Email is required.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'UserNotFound', message: 'User account not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'AlreadyVerified', message: 'Account is already verified.' });
    }

    const otpCode = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode,
        otpExpires
      }
    });

    // Send new verification OTP via email service
    await sendOtpEmail(user.email, otpCode, otpExpires);

    return res.json({
      message: 'A new verification code has been sent to your email address.',
      email: user.email
    });
  } catch (error) {
    next(error);
  }
}
