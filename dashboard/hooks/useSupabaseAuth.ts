import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useSupabaseAuth() {
  const [token, setToken] = useState<string | undefined | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const access = data?.session?.access_token;
      setToken(access ?? undefined);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? undefined);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { supabase, token };
} 