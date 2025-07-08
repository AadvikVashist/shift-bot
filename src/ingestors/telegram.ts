import { TelegramClient } from 'telegram';
// client provided via helper
import { NewMessage } from 'telegram/events';
import { Logger } from '../helpers/logger';
import fs from 'fs';
import path from 'path';
import { Api } from 'telegram';
import { ingestUserMessage } from './ingest';
import { getTelegramClient } from '../helpers/telegram/client';

const logger = Logger.create('TelegramIngestor');

let client: TelegramClient; // will be initialised in startTelegramIngestor

// load unified sources config
const sourcesPath = path.join(__dirname, '../config/sources.json');
interface SourceCfg { platform: string; handle?: string; name?: string; active?: boolean }
let telegramChannels: Array<SourceCfg & { handle: string }> = [];
try {
  const raw = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8')) as SourceCfg[];
  telegramChannels = raw.filter(
    (s): s is SourceCfg & { handle: string } => s.platform === 'telegram' && !!s.handle && (s.active ?? true),
  );
  logger.info(`Loaded ${telegramChannels.length} active Telegram channels from config`);
} catch (err) {
  logger.warn('Failed to load sources.json', err);
  telegramChannels = [];
}

async function syncSeedChannels(client: TelegramClient) {
  logger.info(`Syncing ${telegramChannels.length} Telegram channels`);
  for (const seed of telegramChannels) {
    const { handle, name } = seed;
    let active = seed.active !== false; // default true unless explicitly false

    // First resolve the handle – this tells us whether it is a Channel / Super-group, Group or User
    let entity: any = null;
    try {
      entity = await client.getEntity(handle);
    } catch (err) {
      logger.warn('[seed] failed to resolve entity for', handle, err);
    }

    const isJoinableChannel = entity && 'channelId' in entity; // Channels & super-groups expose channelId

    if (isJoinableChannel) {
      // Attempt to join only if we are dealing with a channel / super-group
      try {
        await client.invoke(new Api.channels.JoinChannel({ channel: handle }));
        logger.info('[seed] joined', handle);
      } catch (err: any) {
        const msg = err?.message ?? '';
        if (!msg.includes('USER_ALREADY_PARTICIPANT')) {
          // Any other error means the channel isn’t available for this account → deactivate
          logger.warn('[seed] failed to join', handle, msg);
          active = false;
        }
      }
    } else {
      // Not a public channel – nothing to join, but we still treat it as active so we can ingest messages
      logger.debug('[seed] handle not joinable (likely user or basic group), skipping join', handle);
    }

    // Ensure we have a numeric chatId & title for reference
    try {
      if (!entity) {
        entity = await client.getEntity(handle);
      }
      const chatId = entity?.id ? entity.id.toString() : undefined;
      const title = entity?.title ?? handle;
      if (!chatId) {
        logger.warn('[seed] missing chatId for', handle);
      }
      // Note: no DB source upsert needed for support schema (handled elsewhere)
    } catch (err) {
      logger.debug('[seed] failed to resolve entity for', handle, err);
    }
  }
}

// Cache chatId → username lookups to avoid hitting Telegram API repeatedly
const chatIdUsernameCache = new Map<string, string>();

async function resolveUsername(client: TelegramClient, chatId: string): Promise<string | null> {
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

function attachMessageHandler(client: TelegramClient) {
  client.addEventHandler(async (ev: any) => {
    try {
      console.log('Telegram message received', ev);
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
        handle = await resolveUsername(client, chatId);
      }

      const title = raw.chat?.title ?? handle ?? chatId;

      ingestUserMessage({
        platform: 'telegram',
        userExternalId: raw.fromId?.userId?.toString() ?? 'unknown',
        threadId: `${chatId}:${raw.replyTo?.replyToMsgId ?? raw.id}`,
        text,
        ts,
      });
    } catch (err) {
      logger.error('Telegram handler error', err);
    }
  }, new NewMessage({}));
}

export async function startTelegramIngestor() {
  client = await getTelegramClient();
  await syncSeedChannels(client);
  attachMessageHandler(client);
  logger.info('Telegram ingestor running');
} 