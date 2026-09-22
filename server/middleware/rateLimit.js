export const createRateLimit = ({ windowMs, maxAttempts, key = (req) => req.ip } = {}) => {
  const attempts = new Map();
  const middleware = (req, res, next) => {
    const now = Date.now();
    const identifier = key(req) || 'unknown';
    const recent = (attempts.get(identifier) || []).filter((timestamp) => now - timestamp < windowMs);
    if (recent.length >= maxAttempts) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - recent[0])) / 1000)));
      return res.status(429).json({ success: false, error: 'Too many attempts. Please wait before trying again.' });
    }
    recent.push(now);
    attempts.set(identifier, recent);
    return next();
  };
  middleware.reset = (req) => attempts.delete(key(req) || 'unknown');
  return middleware;
};
