import rateLimit from 'express-rate-limit';

// Global Rate Limiter: Max 100 requests per 15 minutes from an IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, 
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'TooManyRequests',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Authentication Limiter: Max 5 signup/login attempts per 15 minutes from an IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TooManyAuthAttempts',
    message: 'Too many login or registration attempts. Please try again after 15 minutes.'
  }
});
