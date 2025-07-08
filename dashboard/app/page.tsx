'use client';
import TicketTable from '@/components/ui/TicketTable';
import { useTicketsWS } from '@/hooks/useTicketsWS';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useRouter } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { AccountInfo } from '@/components/account-info';
import { EngineerSidebar } from '@/components/engineer-sidebar';

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
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-72">
          <EngineerSidebar />
        </div>

        {/* Main content area */}
        <div className="flex-1 space-y-6">
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold">ShiftBot Tickets</h1>

            <div className="flex items-center gap-2 sm:gap-4">
              <AccountInfo />
              <ThemeSwitcher />
              <LogoutButton />
            </div>
          </header>

          {/* Ticket list */}
          <TicketTable tickets={tickets} />
        </div>
      </div>
    </main>
  );
}
