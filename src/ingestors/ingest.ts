import { Logger } from '../helpers/logger';
import { findOrCreateTicket, insertUserMessage } from '../helpers/db/ingestorDb';
import { enqueueEnrichment } from '../LLM/enricher';

const logger = Logger.create('IngestHelper');

export interface IngestPayload {
  platform: 'slack' | 'telegram';
  userExternalId: string; // slack user id / telegram user id
  threadId: string; // Slack channel:rootTs  or Telegram chatId:rootMsgId
  text: string; // message body
  ts?: number; // epoch ms; optional
}

export async function ingestUserMessage(payload: IngestPayload): Promise<void> {
  try {
    if (!payload.text.trim()) return;

    const ticketId = await findOrCreateTicket({
      platform: payload.platform,
      threadId: payload.threadId,
      userExternalId: payload.userExternalId,
    });

    if (!ticketId) return;

    await insertUserMessage({
      ticketId,
      actorExternalId: payload.userExternalId,
      content: payload.text,
    });

    // Fire-and-forget LLM triage & auto-reply
    void enqueueEnrichment({
      ticketId,
      text: payload.text,
      platform: payload.platform,
    });
  } catch (err) {
    logger.error('ingestUserMessage error', err);
  }
}
