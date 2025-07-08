import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useSupabaseAuth() {
  const [token, setToken] = useState<string | undefined | null>(null);
  const [pending, setPending] = useState<boolean>(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const access = data?.session?.access_token;
      if (data?.session?.user) {
        checkAndLinkEngineer(data.session.user, supabase).then(setPending);
      }
      setToken(access ?? undefined);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        checkAndLinkEngineer(session.user, supabase).then(setPending);
      }
      setToken(session?.access_token ?? undefined);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { supabase, token, pending };
}

async function checkAndLinkEngineer(
  user: { id: string; email?: string | null },
  supabase: any,
): Promise<boolean> {
  if (!user.email) {
    console.log('No email on user, skipping engineer link');
    return true;
  }

  // Does a row already link to this auth uid?
  const { data: existing } = await supabase
    .from('engineers')
    .select('id,email')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (existing) {
    console.log('Engineer already linked for user', user.email, existing);
    return false;
  }

  // Try to claim by email
  console.log('Attempting to link engineer by email', user.email);
  const { data, error } = await supabase
    .from('engineers')
    .update({ auth_user_id: user.id })
    .eq('email', user.email)
    .is('auth_user_id', null)
    .select('id,email')
    .maybeSingle();

  if (error) {
    console.log('Link engineer error', error);
  }
  if (data) {
    console.log('Successfully linked engineer', data.id);
  } else {
    console.log('No matching engineer row found for email', user.email);
  }
  return !data; // pending if update failed
} 