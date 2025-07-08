import { Logger } from '../logger';
import { getTelegramClient } from './client';
import { parsePeerKey } from './peers';

/**
 * Telegram reply helper
 * ---------------------
 * Sends a plain-text reply into a Telegram chat using the shared MTProto client.
 *   • `chatId` is the numeric channel / group id as a string.
 *   • `replyToMsgId` refers to the root/support message to keep threading.
 *   • No retry logic here; caller decides if/when to retry.
 */

const logger = Logger.create('TgSender');

export async function sendTelegramReply(
  peerKey: string,
  replyToMsgId: number | null,
  text: string,
): Promise<void> {
  try {
    const tg = await getTelegramClient();
    const peer = parsePeerKey(peerKey);

    // Ensure the entity is cached – this prevents "Could not find the input entity" errors
    try {
      await tg.getEntity(peer as any);
    } catch {
      /* entity may not be resolvable but we still attempt sending – sendMessage will then throw and be logged below */
    }
    await tg.sendMessage(peer as any, {
      message: text,
      replyTo: replyToMsgId ?? undefined,
    } as any);
    logger.info('Sent Telegram reply', { peerKey, replyToMsgId });
  } catch (err) {
    logger.error('Failed to send Telegram reply', err);
  }
} 