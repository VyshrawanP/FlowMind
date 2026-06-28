import express from 'express';
import { signup, verifyOtp, login, resendOtp } from '../controllers/auth-controller.js';
import { authLimiter } from '../middlewares/rate-limiter.js';

const router = express.Router();

// Apply auth rate limiting to these sensitive routes
router.post('/signup', authLimiter, signup);
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/login', authLimiter, login);
router.post('/resend-otp', authLimiter, resendOtp);

export default router;
