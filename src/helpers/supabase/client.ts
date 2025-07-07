import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { Database } from './database.types';

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } = env.supabase;

/**
 * Client for public/anon access (RLS-restricted, safe for browser use).
 */
export const supabasePublic: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
    },
  },
);

/**
 * Service-role client (bypasses RLS). Only initialise if key is present.
 * Falls back to `supabasePublic` when not available so caller code is safe.
 */
export const supabaseService: SupabaseClient<Database> = SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : (supabasePublic as SupabaseClient<Database>);

export default supabaseService; 