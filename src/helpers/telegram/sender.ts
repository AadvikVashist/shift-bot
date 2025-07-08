import { Logger } from '../logger';
import { getTelegramClient } from './client';

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
  chatId: string,
  replyToMsgId: number | null,
  text: string,
): Promise<void> {
  try {
    const tg = await getTelegramClient();
    await tg.sendMessage(chatId, {
      message: text,
      replyTo: replyToMsgId ?? undefined,
    } as any);
    logger.info('Sent Telegram reply', { chatId, replyToMsgId });
  } catch (err) {
    logger.error('Failed to send Telegram reply', err);
  }
} 