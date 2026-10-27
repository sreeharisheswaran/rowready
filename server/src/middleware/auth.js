import jwt from 'jsonwebtoken';
import { AppError } from './errors.js';

const JWT_SECRET = process.env.JWT_SECRET || 'rowready-jwt-secret-key-development-2026';

export function signToken(user) {
  return jwt.sign(
    {
      id: String(user._id || user.id),
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Session expired or invalid token. Please log in again.');
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = header.slice(7).trim();
  try {
    req.user = verifyToken(token);
  } catch {
    req.user = null;
  }
  next();
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required. Please log in.'));
  }
  const token = header.slice(7).trim();
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
