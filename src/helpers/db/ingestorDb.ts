import { supabaseService } from '../supabase/client';
import { Logger } from '../logger';

const logger = Logger.create('IngestDB');

/**
 * Find an existing ticket by platform & thread_id or create a new one.
 * Returns the ticket UUID.
 */
export async function findOrCreateTicket(params: {
  platform: 'slack' | 'telegram';
  threadId: string;
  userExternalId: string;
}): Promise<string | null> {
  const { platform, threadId, userExternalId } = params;

  // Try fetch first
  const { data: existing, error: fetchErr } = await (supabaseService as any)
    .from('tickets')
    .select('id')
    .eq('platform', platform)
    .eq('thread_id', threadId)
    .maybeSingle();

  if (fetchErr) {
    logger.error('findOrCreateTicket: fetch failed', { fetchErr, params });
    return null;
  }

  if (existing) {
    // Update last_activity_at
    await (supabaseService as any)
      .from('tickets')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', existing.id);
    return existing.id;
  }

  // Insert new ticket
  const { data: created, error: insertErr } = await (supabaseService as any)
    .from('tickets')
    .insert({
      platform,
      user_external_id: userExternalId,
      thread_id: threadId,
      status: 'open',
    })
    .select('id')
    .single();

  if (insertErr) {
    logger.error('findOrCreateTicket: insert failed', { insertErr, params });
    return null;
  }

  return created.id;
}

export async function insertUserMessage(params: {
  ticketId: string;
  actorExternalId: string;
  content: string;
}): Promise<void> {
  const { ticketId, actorExternalId, content } = params;

  const { error } = await (supabaseService as any).from('ticket_actions').insert({
    ticket_id: ticketId,
    action_type: 'user_message',
    actor_external_id: actorExternalId,
    content,
  });

  if (error) {
    logger.error('insertUserMessage failed', { error, params });
  }
}

export async function insertSystemEvent(params: {
  ticketId: string;
  content: string;
}): Promise<void> {
  const { ticketId, content } = params;

  const { error } = await (supabaseService as any).from('ticket_actions').insert({
    ticket_id: ticketId,
    action_type: 'system_event',
    content,
  });

  if (error) {
    logger.error('insertSystemEvent failed', { error, params });
  }
}

/**
 * Utility: returns true if at least one engineer row has active == true.
 */
export async function isAnyEngineerActive(): Promise<boolean> {
  const { data, error } = await (supabaseService as any)
    .from('engineers')
    .select('id')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error('isAnyEngineerActive: query failed', error);
    return false;
  }

  return !!data;
} 