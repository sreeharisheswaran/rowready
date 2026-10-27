import bcrypt from 'bcryptjs';
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
    const body = parseRequest(signupSchema, req.body);
    const existing = await User.findOne({ email: body.email });
    if (existing) {
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
    res.status(201).json({
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
      },
    });
  },

  login: async (req, res) => {
    const body = parseRequest(loginSchema, req.body);
    const user = await User.findOne({ email: body.email }).select('+password');
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    const matches = await bcrypt.compare(body.password, user.password);
    if (!matches) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    const token = signToken(user);
    res.status(200).json({
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
      },
    });
  },

  me: async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found.');
    }
    res.status(200).json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
      },
    });
  },
};
