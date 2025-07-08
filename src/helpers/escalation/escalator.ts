import { supabaseService } from '../supabase/client';
import { Logger } from '../logger';
import { ringTelegramUser } from '../telegram/caller';

const logger = Logger.create('Escalator');

/**
 * Escalator helper
 * ----------------
 * Handles automatic paging of engineers when a ticket enters `escalation_pending`.
 * Workflow:
 *   1. Build a priority-ordered engineer list: first `active==true`, then `is_on_call==true`.
 *   2. For each engineer we attempt up to `MAX_RETRIES_PER_ENGINEER` calls.
 *   3. Each attempt is logged in `ticket_actions` with `retry_count` and success/failure.
 *   4. Between retries we wait `RETRY_DELAY_MS` to give the callee time to respond.
 *   5. Before every attempt we re-check the ticket status; we abort the whole loop if it
 *      moved away from `escalation_pending` (e.g. another engineer picked it up).
 *   6. On the first successful call we mark the ticket `escalated` and set
 *      `current_engineer_id`.
 *
 * The helper is fire-and-forget: all errors are caught & logged; it never throws to caller.
 */
export type EscalationMethod = 'telegram_voice' | 'phone_call';

interface Engineer {
  id: string;
  name: string;
  telegram_id: string | null;
  phone_number: string | null;
  active?: boolean;
  is_on_call?: boolean;
}

// How many times to ring the same engineer before moving on.
const MAX_RETRIES_PER_ENGINEER = 2;

// Wait time between retries for the same engineer (in milliseconds).
const RETRY_DELAY_MS = 30_000; // 30 seconds

async function fetchEngineers(): Promise<Engineer[]> {
  const { data, error } = await (supabaseService as any)
    .from('engineers')
    .select('id,name,telegram_id,phone_number,active,is_on_call')
    .order('active', { ascending: false }) // active first
    .order('is_on_call', { ascending: false });
  if (error) {
    logger.error('Failed to fetch engineers', error);
    return [];
  }
  if (!data) return [];

  const active = data.filter((e: Engineer) => e.active);
  const onCall = data.filter((e: Engineer) => !e.active && e.is_on_call);
  return [...active, ...onCall];
}

async function getTicketStatus(ticketId: string): Promise<string | null> {
  const { data, error } = await (supabaseService as any)
    .from('tickets')
    .select('status')
    .eq('id', ticketId)
    .maybeSingle();
  if (error) {
    logger.error('Failed to fetch ticket status', error);
    return null;
  }
  return data?.status ?? null;
}

async function placeEscalationCall(
  engineer: Engineer,
  method: EscalationMethod,
): Promise<boolean> {
  try {
    if (method === 'telegram_voice' && engineer.telegram_id) {
      await ringTelegramUser(engineer.telegram_id);
      logger.info('Telegram escalation call placed', {
        engineer: engineer.telegram_id,
      });
      return true;
    }

    if (method === 'phone_call' && engineer.phone_number) {
      logger.warn('Phone call escalation not yet implemented', {
        phone: engineer.phone_number,
      });
      return false;
    }

    logger.warn('Missing contact info for escalation', {
      engineerId: engineer.id,
    });
    return false;
  } catch (err) {
    logger.error('Escalation call failed', err);
    return false;
  }
}

async function recordAttempt(
  ticketId: string,
  engineerId: string,
  method: EscalationMethod,
  success: boolean,
  retryCount: number,
): Promise<void> {
  const { error } = await (supabaseService as any)
    .from('ticket_actions')
    .insert({
      ticket_id: ticketId,
      action_type: 'escalation_call',
      actor_engineer_id: engineerId,
      escalation_method: method,
      retry_count: retryCount,
      content: success ? 'Escalation call placed' : 'Escalation call failed',
    });
  if (error) logger.error('Failed to insert escalation_call action', error);
}

export async function escalateTicket(ticketId: string): Promise<void> {
  const engineers = await fetchEngineers();
  if (!engineers.length) {
    logger.warn('No engineers (active or on-call) found, escalation aborted', {
      ticketId,
    });
    return;
  }

  for (const engineer of engineers) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_ENGINEER; attempt++) {
      // Check ticket status before each attempt
      const status = await getTicketStatus(ticketId);
      if (status !== 'escalation_pending') {
        logger.info('Ticket status changed, aborting escalation', {
          ticketId,
          status,
        });
        return;
      }

      const method: EscalationMethod = engineer.telegram_id
        ? 'telegram_voice'
        : 'phone_call';

      const success = await placeEscalationCall(engineer, method);
      await recordAttempt(ticketId, engineer.id, method, success, attempt);

      if (success) {
        // Mark ticket escalated
        const { error } = await (supabaseService as any)
          .from('tickets')
          .update({
            status: 'escalated',
            current_engineer_id: engineer.id,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', ticketId);
        if (error) logger.error('Failed to update ticket to escalated', error);
        return;
      }

      // Wait before retrying if not last attempt
      if (attempt < MAX_RETRIES_PER_ENGINEER - 1) {
        await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      }
    }
  }

  logger.warn('Escalation attempts exhausted for ticket', { ticketId });
} 