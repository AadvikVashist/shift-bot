import { useEffect, useRef, useState } from 'react';
import { Ticket } from '@/components/ui/TicketTable';

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

export function useTicketsWS(token: string) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
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

  return tickets;
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
  };
} 