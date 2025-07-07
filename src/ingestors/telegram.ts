import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { Logger } from '../helpers/logger';
import telegramSeeds from '../seed/telegram';
import { supabaseService } from '../helpers/supabase/client';
import { Api } from 'telegram';
import { ingestRawNews } from './ingest';
import { env } from '../helpers/config/env';

const logger = Logger.create('TelegramIngestor');

const { apiId, apiHash, session } = env.telegram;

if (!apiId || !apiHash || !session) {
  throw new Error('Missing required Telegram API credentials');
}

const client = new TelegramClient(
  new StringSession(session),
  apiId,
  apiHash,
  { connectionRetries: 5 },
);

// Upsert a Telegram news source using numeric chatId as source_uid and storing
// the public username in the new `handle` column.
async function upsertNewsSource(params: {
  chatId: string;
  handle: string | null;
  title: string | null;
  isActive: boolean;
  visibility: 'system' | 'public' | 'private';
}) {
  const { chatId, handle, title, isActive, visibility } = params;
  await supabaseService
    .from('news_sources')
    .upsert({
      platform: 'telegram',
      source_uid: chatId,
      handle, // new nullable column
      source_name: handle ? `@${handle}` : title ?? chatId,
      title: title ?? handle ?? chatId,
      is_active: isActive,
      visibility,
    }, { onConflict: 'platform,source_uid' });
}

async function syncSeedChannels() {
  logger.info(`Syncing ${telegramSeeds.length} Telegram channels`);
  for (const seed of telegramSeeds) {
    const { handle } = seed;
    let active = seed.active !== false; // default true unless explicitly false
    try {
      await client.invoke(new Api.channels.JoinChannel({ channel: handle }));
      logger.info('[seed] joined', handle);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (!msg.includes('USER_ALREADY_PARTICIPANT')) {
        logger.warn('[seed] failed to join', handle, msg);
        active = false;
      }
    }
    // Resolve entity to get numeric chat ID and title
    try {
      const entity: any = await client.getEntity(handle);
      const chatId = entity?.id ? entity.id.toString() : undefined;
      const title = entity?.title ?? handle;
      if (chatId) {
        await upsertNewsSource({
          chatId,
          handle,
          title,
          isActive: active,
          visibility: 'system',
        });
      } else {
        logger.warn('[seed] missing chatId for', handle);
      }
    } catch (err) {
      logger.debug('[seed] failed to resolve entity for', handle, err);
    }
  }
}

// Cache chatId → username lookups to avoid hitting Telegram API repeatedly
const chatIdUsernameCache = new Map<string, string>();

async function resolveUsername(chatId: string): Promise<string | null> {
  if (chatIdUsernameCache.has(chatId)) return chatIdUsernameCache.get(chatId)!;
  try {
    const entity = await client.getEntity(chatId);
    // Channels / supergroups have .username; groups/users might not.
    // entity can be Api.Channel or other variants
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const username: string | undefined = entity.username;
    if (username) {
      chatIdUsernameCache.set(chatId, username);
      return username;
    }
  } catch (err: any) {
    logger.debug(`Failed to resolve username for chatId ${chatId}`, err);
  }
  return null;
}

// Helper: extract chat ID from a variety of Telegram message shapes
const getRawChatId = (msg: any): string | null => {
  if (msg?.chatId) return msg.chatId.toString();
  const peer = msg?.peerId;
  if (!peer) return null;
  // Telegram TL objects use different property names depending on peer type
  if ('channelId' in peer && peer.channelId) return peer.channelId.toString();
  if ('chatId' in peer && peer.chatId) return peer.chatId.toString();
  if ('userId' in peer && peer.userId) return peer.userId.toString();
  return null;
};

// Normalise chat IDs so that –1001380328653 → 1380328653, etc.
const normalizeChatId = (id: string): string => {
  if (id.startsWith('-100')) return id.slice(4);
  if (id.startsWith('100')) return id.slice(3);
  if (id.startsWith('-')) return id.slice(1);
  return id;
};

function attachMessageHandler() {
  client.addEventHandler(async (ev: any) => {
    try {
      const raw = ev.message as any;
      if (!raw?.message) return; // guard: no text content

      const text = (raw.message as string)?.trim();
      if (!text) return;

      const ts = typeof raw.date === 'number' ? raw.date * 1000 : Date.now();

      const rawChatId = getRawChatId(raw);
      if (!rawChatId) {
        logger.debug('Skipping message without identifiable chatId');
        return;
      }

      const chatId = normalizeChatId(rawChatId);

      // Attempt to resolve @handle – first via payload, then via cache/API
      let handle: string | null | undefined = raw.chat?.username;
      if (!handle) {
        handle = await resolveUsername(chatId);
      }

      const title = raw.chat?.title ?? handle ?? chatId;

      ingestRawNews({
        platform: 'telegram',
        sourceUid: chatId,
        sourceTitle: title,
        text,
        ts,
      });
    } catch (err) {
      logger.error('Telegram handler error', err);
    }
  }, new NewMessage({}));
}

export async function startTelegramIngestor() {
  await client.connect();
  await syncSeedChannels();
  attachMessageHandler();
  logger.info('Telegram ingestor running');
} 