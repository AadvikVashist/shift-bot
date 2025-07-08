import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { env } from '../config/env';
import { Logger } from '../logger';

const logger = Logger.create('TgClient');
const { apiId, apiHash, session } = env.telegram;

let client: TelegramClient | null = null;
let connecting: Promise<TelegramClient> | null = null;

export async function getTelegramClient(): Promise<TelegramClient> {
  if (client) return client;

  if (!apiId || !apiHash || !session) {
    throw new Error('Missing Telegram API credentials');
  }

  if (!connecting) {
    connecting = (async () => {
      const c = new TelegramClient(new StringSession(session), apiId, apiHash, {
        connectionRetries: 5,
      });
      await c.connect();
      logger.info('Telegram client connected');
      client = c;
      return c;
    })();
  }

  return connecting;
} 