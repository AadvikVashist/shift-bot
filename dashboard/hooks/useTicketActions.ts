"use client"
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface TicketAction {
  id: string;
  actionType: string;
  content: string | null;
  createdAt: string;
  actorExternalId: string | null;
  severity: number | null;
  escalationMethod: string | null;
}

export function useTicketActions(ticketId?: string) {
  const [actions, setActions] = useState<TicketAction[]>([]);
  useEffect(() => {
    if (!ticketId) return;
    const supabase = createClient();
    const fetchActions = async () => {
      const { data } = await supabase
        .from('ticket_actions')
        .select('id, action_type, content, created_at, actor_external_id, severity, escalation_method')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      setActions((data ?? []).map(mapRow));
    };
    void fetchActions();
  }, [ticketId]);
  return actions;
}

function mapRow(row: any): TicketAction {
  return {
    id: row.id,
    actionType: row.action_type,
    content: row.content,
    createdAt: row.created_at,
    actorExternalId: row.actor_external_id,
    severity: row.severity,
    escalationMethod: row.escalation_method,
  };
} 