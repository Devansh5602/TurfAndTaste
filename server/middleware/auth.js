import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export function authenticateAdminToken(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(503).json({ success: false, error: 'Management authentication is not configured.' });
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access denied. No authentication token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token.' });
  }
}

// Attach a verified management identity when a token is present without making
// public customer routes require a login. Routes can use this to safely offer
// staff-only variants of an otherwise public action (for example counter
// walk-in reservations).
export function attachOptionalAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return next();
  if (!JWT_SECRET) {
    return res.status(503).json({ success: false, error: 'Management authentication is not configured.' });
  }

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ success: false, error: 'Invalid or expired token.' });
  }
}
