import 'dotenv/config';
import { z } from 'zod';

const defaultSecret = 'rowready-jwt-secret-key-development-2026';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(?:\+srv)?:\/\//)
    .optional(),
  TRUST_PROXY: z.enum(['0', '1']).default('0'),
  JWT_SECRET: z.preprocess(
    (val) => (typeof val === 'string' && val.trim().length >= 8 ? val.trim() : defaultSecret),
    z.string().default(defaultSecret),
  ),
});
const result = schema.safeParse(process.env);
if (!result.success) {
  const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
  throw new Error(`Invalid environment settings: ${details}. Check .env.example.`);
}
export const config = {
  port: result.data.PORT,
  mongoUri: result.data.MONGODB_URI,
  production: result.data.NODE_ENV === 'production',
  trustProxy: Number(result.data.TRUST_PROXY),
  jwtSecret: result.data.JWT_SECRET,
};
