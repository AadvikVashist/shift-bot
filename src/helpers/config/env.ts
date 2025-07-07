import 'dotenv/config';
import { z } from 'zod';

/**
 * Centralised, type-safe access to all required environment variables.
 * ------------------------------------------------------------------
 * ‣ Uses Zod to validate and coerce values at start-up.
 * ‣ Groups vars by concern to make imports intuitive: env.telegram, env.supabase …
 * ‣ Provides sensible defaults where safe (port, Gemini model, …).
 */

const RawEnvSchema = z.object({
  // Generic
  PORT: z.string().optional(),

  // Telegram
  TG_API_ID: z.string(),
  TG_API_HASH: z.string(),
  SERVICE_SESSION: z.string(),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Redis
  // REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),

  // Gemini / LLM
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional().default('gemini-2.5-flash'),
  LLM_ENRICH_ENABLED: z.string().optional().default('1'),
  LLM_CONCURRENCY: z.string().optional().default('3'),

  // Auth
  AUTH_INTROSPECT_URL: z.string().url(),
});

type RawEnv = z.infer<typeof RawEnvSchema>;

const parsed = RawEnvSchema.parse(process.env) as RawEnv;

export const env = {
  port: Number(parsed.PORT ?? 3001),

  telegram: {
    apiId: Number(parsed.TG_API_ID),
    apiHash: parsed.TG_API_HASH,
    session: parsed.SERVICE_SESSION,
  },

  supabase: {
    url: parsed.SUPABASE_URL,
    anonKey: parsed.SUPABASE_ANON_KEY,
    serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
  },

  gemini: {
    apiKey: parsed.GEMINI_API_KEY,
    model: parsed.GEMINI_MODEL,
    enabled:
      parsed.GEMINI_API_KEY &&
      parsed.LLM_ENRICH_ENABLED !== '0' &&
      parsed.LLM_ENRICH_ENABLED.toLowerCase() !== 'false',
    concurrency: Number(parsed.LLM_CONCURRENCY),
  },

  auth: {
    introspectUrl: parsed.AUTH_INTROSPECT_URL,
  },
} as const;
