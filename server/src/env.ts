import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  SEED_ADMIN_PASSWORD: z.string().default('admin123'),
  SEED_COUNTER_PASSWORD: z.string().default('counter123'),
  // ─── Bill scan / LLM extraction (OpenAI-compatible) ───
  // Optional so the server still boots without a key; the /extract route
  // returns 503 until OPENAI_API_KEY is set.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.4'),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
