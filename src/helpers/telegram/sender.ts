import { Logger } from '../logger';
import { getTelegramClient } from './client';

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