// Global rate limiters disabled for developer/recruiter demonstration walkthroughs
// This prevents 429 Too Many Requests lockouts during high-frequency manual or automated testing.

export const globalLimiter = (req, res, next) => {
  next();
};

export const authLimiter = (req, res, next) => {
  next();
};
