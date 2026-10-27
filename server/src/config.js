import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(?:\+srv)?:\/\//)
    .optional(),
  TRUST_PROXY: z.enum(['0', '1']).default('0'),
  JWT_SECRET: z.string().min(16).default('rowready-jwt-secret-key-development-2026'),
});
const result = schema.safeParse(process.env);
if (!result.success)
  throw new Error(
    `Invalid environment settings: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}. Check .env.example.`,
  );
export const config = {
  port: result.data.PORT,
  mongoUri: result.data.MONGODB_URI,
  production: result.data.NODE_ENV === 'production',
  trustProxy: Number(result.data.TRUST_PROXY),
  jwtSecret: result.data.JWT_SECRET,
};
