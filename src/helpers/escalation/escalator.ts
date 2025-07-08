import { supabaseService } from '../supabase/client';
import { Logger } from '../logger';
import { ringTelegramUser } from '../telegram/caller';

const logger = Logger.create('Escalator');

export type EscalationMethod = 'telegram_voice' | 'phone_call';

interface Engineer {
  id: string;
  name: string;
  telegram_id: string | null;
  phone_number: string | null;
}

async function getCurrentOnCallEngineer(): Promise<Engineer | null> {
  const { data, error } = await (supabaseService as any)
    .from('engineers')
    .select('id,name,telegram_id,phone_number')
    .eq('is_on_call', true)
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error('Failed to fetch on-call engineer', error);
    return null;
  }
  return data ?? null;
}

async function placeEscalationCall(
  engineer: Engineer,
  method: EscalationMethod,
): Promise<boolean> {
  try {
    if (method === 'telegram_voice' && engineer.telegram_id) {
      await ringTelegramUser(engineer.telegram_id);
      logger.info('Telegram escalation call placed', { ticketEscalatedTo: engineer.telegram_id });
      return true;
    }

    // TODO: integrate real phone call provider (e.g. Twilio)
    if (method === 'phone_call' && engineer.phone_number) {
      logger.warn('Phone call escalation not yet implemented', { phone: engineer.phone_number });
      return false;
    }

    logger.error('Unsupported escalation method or missing contact info', {
      method,
      engineerId: engineer.id,
    });
    return false;
  } catch (err) {
    logger.error('Escalation call failed', err);
    return false;
  }
}

export async function escalateTicket(ticketId: string): Promise<void> {
  const engineer = await getCurrentOnCallEngineer();
  if (!engineer) {
    logger.warn('No on-call engineer found – cannot escalate', { ticketId });
    return;
  }

  // Decide method: prefer Telegram if engineer has telegram_id, otherwise phone
  const method: EscalationMethod = engineer.telegram_id ? 'telegram_voice' : 'phone_call';

  const success = await placeEscalationCall(engineer, method);

  // Record escalation attempt regardless of success
  const { error: insertErr } = await (supabaseService as any)
    .from('ticket_actions')
    .insert({
      ticket_id: ticketId,
      action_type: 'escalation_call',
      actor_engineer_id: engineer.id,
      escalation_method: method,
      content: success ? 'Escalation call placed' : 'Escalation call failed',
    });
  if (insertErr) logger.error('Failed to insert escalation_call action', insertErr);

  // Update ticket status if success
  if (success) {
    const { error: updErr } = await (supabaseService as any)
      .from('tickets')
      .update({ status: 'escalated', last_activity_at: new Date().toISOString() })
      .eq('id', ticketId);
    if (updErr) logger.error('Failed to update ticket to escalated', updErr);
  }
} 