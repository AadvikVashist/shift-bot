import { useEffect, useRef, useState, useCallback } from 'react';
import { Ticket } from '@/components/ui/TicketTable';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface WSMessage {
  type: 'baseline' | 'new_item' | 'ping' | string;
  data: any;
}

function severityLabel(num?: number | null): Ticket['severity'] {
  if (num == null) return 'low';
  if (num >= 0.9) return 'critical';
  if (num >= 0.6) return 'high';
  if (num >= 0.3) return 'medium';
  return 'low';
}

export function useTicketsWS(authToken?: string) {
  const { token: fallbackToken } = useSupabaseAuth();
  const token = authToken ?? fallbackToken ?? undefined;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Determine REST API base URL (same logic as useEngineers)
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

  useEffect(() => {
    // Only establish a websocket connection once we have a valid token.
    if (!token) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';
    const ws = new WebSocket(`${wsUrl}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', data: { token } }));
    };

    ws.onmessage = (ev) => {
      const msg: WSMessage = JSON.parse(ev.data);
      switch (msg.type) {
        case 'baseline':
          if (Array.isArray(msg.data)) setTickets(mapRows(msg.data));
          break;
        case 'new_item':
          setTickets((prev) => {
            const mapped = mapRow(msg.data);
            return [mapped, ...prev.filter((t) => t.id !== mapped.id)].slice(0, 100);
          });
          break;
      }
    };

    return () => {
      ws.close();
    };
  }, [token]);

  // Mutation: close a ticket
  const closeTicket = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/tickets/${id}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token,
          },
          body: JSON.stringify({ status: 'closed' }),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        // Optimistically update local state
        setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'closed' } : t)));
      } catch (err) {
        console.error('Failed to close ticket', err);
      }
    },
    [token, API_BASE],
  );

  return {
    tickets,
    closeTicket,
  };
}

function mapRows(rows: any[]): Ticket[] {
  return rows.map(mapRow);
}

function mapRow(row: any): Ticket {
  return {
    id: row.id,
    status: row.status || 'open',
    platform: row.platform,
    threadId: row.thread_id,
    severity: severityLabel(row.severity),
    lastActivity: row.last_activity_at,
    receivedAt: row.received_at,
  };
} 