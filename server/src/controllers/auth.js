import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errors.js';
import { signToken } from '../middleware/auth.js';
import { parseRequest } from '../services/dataset.js';

const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
    email: z.string().trim().email('Invalid email address').toLowerCase().max(120),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters')
      .max(72, 'Password cannot exceed 72 characters'),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email('Invalid email address').toLowerCase().max(120),
    password: z
      .string()
      .min(1, 'Password is required')
      .max(72, 'Password cannot exceed 72 characters'),
  })
  .strict();

export const authControllers = {
  signup: async (req, res) => {
    try {
      const body = parseRequest(signupSchema, req.body);
      if (mongoose.connection.readyState !== 1) {
        throw new AppError(
          503,
          'DATABASE_UNAVAILABLE',
          'Database connection is unavailable. Please try again shortly.',
        );
      }
      const existing = await User.findOne({ email: body.email }).select('+password');
      if (existing) {
        if (!existing.password || typeof existing.password !== 'string') {
          const hashedPassword = await bcrypt.hash(body.password, 10);
          existing.name = body.name;
          existing.password = hashedPassword;
          await existing.save();
          const token = signToken(existing);
          return res.status(201).json({
            token,
            user: {
              id: String(existing._id),
              name: existing.name,
              email: existing.email,
            },
          });
        }
        throw new AppError(
          409,
          'EMAIL_EXISTS',
          'An account with this email already exists. Please log in.',
        );
      }
      const hashedPassword = await bcrypt.hash(body.password, 10);
      const user = await User.create({
        name: body.name,
        email: body.email,
        password: hashedPassword,
      });
      const token = signToken(user);
      return res.status(201).json({
        token,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
        },
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err.code === 11000) {
        throw new AppError(
          409,
          'EMAIL_EXISTS',
          'An account with this email already exists. Please log in.',
        );
      }
      if (err.name === 'ValidationError') {
        const msg = Object.values(err.errors || {})[0]?.message || 'Invalid user details.';
        throw new AppError(400, 'VALIDATION_ERROR', msg);
      }
      if (mongoose.connection.readyState !== 1) {
        throw new AppError(
          503,
          'DATABASE_UNAVAILABLE',
          'Database connection is unavailable. Please try again shortly.',
        );
      }
      throw err;
    }
  },

  login: async (req, res) => {
    try {
      const body = parseRequest(loginSchema, req.body);
      if (mongoose.connection.readyState !== 1) {
        throw new AppError(
          503,
          'DATABASE_UNAVAILABLE',
          'Database connection is unavailable. Please try again shortly.',
        );
      }
      const user = await User.findOne({ email: body.email }).select('+password');
      if (!user) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      }

      let matches = false;
      if (typeof user.password === 'string' && user.password.length > 0) {
        try {
          matches = await bcrypt.compare(body.password, user.password);
        } catch {
          matches = false;
        }
        if (!matches && user.password === body.password) {
          matches = true;
          try {
            user.password = await bcrypt.hash(body.password, 10);
            await user.save();
          } catch {
            // Non-critical hash upgrade failure
          }
        }
      }

      if (!matches) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      }
      const token = signToken(user);
      return res.status(200).json({
        token,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
        },
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (mongoose.connection.readyState !== 1) {
        throw new AppError(
          503,
          'DATABASE_UNAVAILABLE',
          'Database connection is unavailable. Please try again shortly.',
        );
      }
      throw err;
    }
  },

  me: async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        throw new AppError(
          503,
          'DATABASE_UNAVAILABLE',
          'Database connection is unavailable. Please try again shortly.',
        );
      }
      const user = await User.findById(req.user.id);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found.');
      }
      return res.status(200).json({
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
        },
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (mongoose.connection.readyState !== 1) {
        throw new AppError(
          503,
          'DATABASE_UNAVAILABLE',
          'Database connection is unavailable. Please try again shortly.',
        );
      }
      throw err;
    }
  },
};
