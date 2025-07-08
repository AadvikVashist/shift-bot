import { Router } from 'express';
import { supabaseService } from '../helpers/supabase/client';
import { authMiddleware } from '../middleware/auth';
import { Logger } from '../helpers/logger';
import { getWebSocketServer } from '../websocket/ws-server';
import { toPortableTicket } from '../helpers/ticketItem';

const router = Router();
const logger = Logger.create('TicketsRouter');

// Protect all routes with auth middleware
router.use(authMiddleware);

const ALLOWED_STATUS = [
  'open',
  'auto_answered',
  'awaiting_feedback',
  'escalation_pending',
  'escalated',
  'closed',
] as const;

type TicketStatus = (typeof ALLOWED_STATUS)[number];

/**
 * POST /tickets/:id/status
 * Body: { status: TicketStatus }
 * Updates the ticket status (e.g. to "closed").
 */
router.post('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: TicketStatus };
  if (!ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const { error } = await (supabaseService as any)
    .from('tickets')
    .update({ status, last_activity_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logger.error('Failed to update ticket status', error);
    return res.status(500).json({ error: 'DB update failed' });
  }

  // Fetch updated row to broadcast via WebSocket
  try {
    const { data: row, error: fetchErr } = await (supabaseService as any)
      .from('tickets')
      .select('id, status, platform, thread_id, last_activity_at, received_at')
      .eq('id', id)
      .maybeSingle();
    if (!fetchErr && row) {
      const ws = getWebSocketServer();
      ws.broadcastTickets(toPortableTicket(row));
    }
  } catch (err) {
    logger.warn('WebSocket broadcast skipped', err as any);
  }

  return res.json({ success: true });
});

export default router; 