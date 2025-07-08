"use client"
import { 
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarTrigger,
} from "@/components/ui/sidebar"


import { AccountInfo } from "@/components/account-info";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { LogoutButton } from "@/components/logout-button";
import TicketTable from "@/components/ui/TicketTable";
import { useTicketsWS } from "@/hooks/useTicketsWS";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { EngineerSidebar } from "@/components/engineer-sidebar";


export default function Home() {
  const { token, pending } = useSupabaseAuth();
  const router = useRouter();
    
  // Keep hook order stable: always call useTicketsWS regardless of auth state.
  // Fetch tickets and action handlers via WebSocket hook
  const { tickets, closeTicket } = useTicketsWS(token ?? undefined);

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
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <EngineerSidebar />
        </SidebarContent>
      </Sidebar>

      <main className="flex-1 min-w-100vh">
        <div className="px-4 py-2">
          <SidebarTrigger className="h-4 w-4 mt-2" />
        </div>
        <div className="p-6">
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
          <TicketTable tickets={tickets} onCloseTicket={closeTicket} />
        </div>
        </div>
      </main>
    </SidebarProvider>
  )
}
