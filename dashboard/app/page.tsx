'use client';
import TicketTable from '@/components/ui/TicketTable';
import { useTicketsWS } from '@/hooks/useTicketsWS';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { token, pending } = useSupabaseAuth();
  const router = useRouter();

  // Keep hook order stable: always call useTicketsWS regardless of auth state.
  const tickets = useTicketsWS(token ?? undefined);

  // If not authenticated yet, show loading; if unauthenticated redirect to login
  if (token === null) {
    // We don't yet know, show skeleton
    return <p className="p-10">Loading…</p>;
  }
  if (token === undefined) {
    // explicitly unauthenticated
    router.replace('/auth/login');
    return null;
  }
  if (pending) {
    return <p className="p-10">Your account is awaiting approval…</p>;
  }

  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">ShiftBot Tickets</h1>
      <TicketTable tickets={tickets} />
    </main>
  );
}
