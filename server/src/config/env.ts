import { z } from 'zod';
import 'dotenv/config'; // Loads .env file automatically

const envSchema = z.object({
  // Server Variables
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database Neon.tech's Postgres
  DATABASE_URL: z.string().url().describe('Postgres Connection String'),

  // Redis
  REDIS_URL: z.string().min(1).describe('Redis Connection String (redis://...)'),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_BUCKET_NAME: z.string().min(1),

  // Gemini API
  GEMINI_API_KEY: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32).describe('Secret for signing JWTs'),
});

// Validate process.env
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;