export interface PortableTicket {
  id: string;
  status: string;
  platform: 'slack' | 'telegram';
  thread_id: string;
  severity?: number | null;
  escalation_pending?: boolean;
  last_activity_at: string;
  received_at: string;
} 