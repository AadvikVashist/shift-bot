import { PortableTicket } from '../types/ticket';

export function toPortableTicket(dbRow: any): PortableTicket {
  return {
    id: dbRow.id,
    status: dbRow.status,
    platform: dbRow.platform,
    thread_id: dbRow.thread_id,
    severity: dbRow.severity ?? null,
    escalation_pending: dbRow.status === 'escalation_pending',
    last_activity_at: dbRow.last_activity_at,
  };
} 