import { supabasePublic, supabaseService } from '../supabase/client';
import { Logger } from '../logger';

export interface VerifyTokenResult {
  userId: string | null;
}

const logger = Logger.create('AuthVerifier');

/**
 * Verifies a JWT by asking Supabase Auth.
 * Returns `{userId: string}` when valid; `{userId: null}` otherwise.
 */
export async function verifyToken(accessToken: string): Promise<VerifyTokenResult> {
  try {
    // Prefer service-role client if available (faster, no RLS); otherwise fall back.
    const supabase = supabaseService ?? supabasePublic;
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error) {
      logger.warn('Token verification failed', { error: error.message });
      return { userId: null };
    }
    return { userId: data.user?.id ?? null };
  } catch (err) {
    logger.error('Token verification threw', err as any);
    return { userId: null };
  }
}
