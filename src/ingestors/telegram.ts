import { Api, TelegramClient } from 'telegram';
// client provided via helper
import { NewMessage } from 'telegram/events';
import { Logger } from '../helpers/logger';
import fs from 'fs';
import path from 'path';
import { ingestUserMessage } from './ingest';
import bigInt from 'big-integer';
import { serialiseInputPeer } from '../helpers/telegram/peers';
import { getTelegramClient } from '../helpers/telegram/client';

const logger = Logger.create('TelegramIngestor');

let client: TelegramClient; // will be initialised in startTelegramIngestor

// load unified sources config
const sourcesPath = path.join(__dirname, '../config/sources.json');
interface SourceCfg { platform: string; handle?: string; chatid?: string; name?: string; active?: boolean }
let telegramChannels: Array<SourceCfg & { handle?: string; chatid?: string }> = [];
try {
  const raw = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8')) as SourceCfg[];
  telegramChannels = raw.filter(
    (s): s is SourceCfg & { handle?: string; chatid?: string } =>
      s.platform === 'telegram' && !!(s.handle || s.chatid) && (s.active ?? true),
  );
  logger.info(`Loaded ${telegramChannels.length} active Telegram channels from config`);
} catch (err) {
  logger.warn('Failed to load sources.json', err);
  telegramChannels = [];
}

// We will populate these after helper functions are defined to avoid forward reference errors
const allowedHandles = new Set<string>();
const allowedChatIds = new Set<string>();
const allowedTitles = new Set<string>();

// (to be executed after helper fn declarations)


// Cache chatId → username lookups to avoid hitting Telegram API repeatedly
const chatIdUsernameCache = new Map<string, string>();

async function resolveUsername(client: TelegramClient, chatId: string): Promise<string | null> {
  if (chatIdUsernameCache.has(chatId)) return chatIdUsernameCache.get(chatId)!;

  const tryResolve = async (peer: any): Promise<string | null> => {
    try {
      const ent: any = await client.getEntity(peer);
      if (ent?.username) return ent.username as string;
    } catch {
      /* ignore */
    }
    return null;
  };

  let username: string | null = null;
  if (/^-100\d+/.test(chatId)) {
    username = await tryResolve(new Api.PeerChannel({ channelId: bigInt(chatId.slice(4)) }));
  } else if (/^-\d+/.test(chatId)) {
    username = await tryResolve(new Api.PeerChat({ chatId: bigInt(chatId.slice(1)) }));
  } else {
    username = await tryResolve(new Api.PeerUser({ userId: bigInt(chatId) }));
  }

  if (username) {
    chatIdUsernameCache.set(chatId, username);
    return username;
  }

  // No luck – silently ignore to avoid noisy logs.
  return null;
}

// Extract Telegram numeric ID – preserve prefixes ("-100" for channels, "-" for basic groups)
const getRawChatId = (msg: any): string | null => {
  if (msg?.chatId !== undefined) return msg.chatId.toString();
  const peer = msg?.peerId;
  if (!peer) return null;
  if ('channelId' in peer && peer.channelId !== undefined) return `-100${peer.channelId.toString()}`;
  if ('chatId' in peer && peer.chatId !== undefined) return `-${peer.chatId.toString()}`;
  if ('userId' in peer && peer.userId !== undefined) return peer.userId.toString();
  return null;
};
// Normalise chat IDs (strip sign/prefix) for config matching only
const normalizeChatId = (id: string): string => {
  return id.replace(/^-100|^-/, '');
};

// Robustly resolve an InputPeer for a given numeric chatId, trying channel → chat → user.
async function safeGetInputPeer(client: TelegramClient, chatId: string) {
  if (/^-100\d+/.test(chatId)) {
    return client.getInputEntity(new Api.PeerChannel({ channelId: bigInt(chatId.slice(4)) }));
  }
  if (/^-\d+/.test(chatId)) {
    return client.getInputEntity(new Api.PeerChat({ chatId: bigInt(chatId.slice(1)) }));
  }
  // Positive → user DM
  return client.getInputEntity(new Api.PeerUser({ userId: bigInt(chatId) }));
}

// Now that normalisation helper exists, populate allowed sets
for (const ch of telegramChannels) {
  if (ch.handle) {
    const normalized = ch.handle.replace(/^@/, '').toLowerCase();
    allowedHandles.add(normalized);
  }
  if (ch.chatid) {
    allowedChatIds.add(normalizeChatId(ch.chatid));
  }
  if (ch.name) {
    allowedTitles.add(ch.name.toLowerCase());
  }
}

// ---------------------------------------------------------------------------
// Thread linking cache – allows consecutive messages in the same chat to be
// associated with the most recent root thread when they are not explicit
// replies. This helps capture follow-up user messages that do not use the
// Telegram "Reply" feature but are sent shortly after the LLM answer.
// ---------------------------------------------------------------------------
const THREAD_CACHE_MS = 10 * 60 * 1000; // 10 minutes
const recentThreadCache = new Map<string, { rootMsgId: number; ts: number }>();


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

      // Keep the raw chat-id (with possible - / -100 prefix) for all Telegram API calls,
      // but still derive a normalised version **only** for matching against our allow-list.
      const chatIdNormalised = normalizeChatId(rawChatId);

      // Attempt to resolve @handle – first via payload, then via cache/API
      let handle: string | null | undefined = raw.chat?.username;
      if (!handle) {
        handle = await resolveUsername(client, rawChatId);
      }
      if (handle) {
        handle = handle.replace(/^@/, '').toLowerCase();
      }

      const title = raw.chat?.title ?? handle ?? chatIdNormalised;

      // Filter: message must originate from configured source (handle, chatId, or title)
      const fromAllowedChat = allowedChatIds.has(chatIdNormalised);
      const fromAllowedHandle = handle ? allowedHandles.has(handle) : false;
      const fromAllowedTitle = title ? allowedTitles.has(title.toLowerCase()) : false;
      if (!fromAllowedChat && !fromAllowedHandle && !fromAllowedTitle) {
        logger.debug('Skipping message from unconfigured chat', { chatId: chatIdNormalised, handle, title, text });
        return;
      }

      // Build peer key from InputPeer for robust referencing
      let inputPeerKey: string | null = null;
      try {
        const inputPeer = await safeGetInputPeer(client, rawChatId);
        inputPeerKey = serialiseInputPeer(inputPeer as any);
      } catch (err) {
        // Fallback: use normalised chatId so legacy code still functions
        logger.debug('Failed to obtain InputPeer, falling back to chatId string', err);
        // Keep the raw chat-id (with prefix) so we don’t lose type information
        inputPeerKey = rawChatId;
      }

      // -------------------------------------------------------------
      // Determine the root message id for the logical "thread"
      // -------------------------------------------------------------
      let rootMsgId: number;
      if (raw.replyTo?.replyToMsgId !== undefined && raw.replyTo.replyToMsgId !== null) {
          // Explicit reply → honour Telegram threading
          rootMsgId = raw.replyTo.replyToMsgId;
      } else {
          // No explicit reply → try fall back to the most recent root in this chat
          const cached = recentThreadCache.get(chatIdNormalised);
          if (cached && ts - cached.ts < THREAD_CACHE_MS) {
              rootMsgId = cached.rootMsgId;
          } else {
              // Treat this message as starting a new logical thread
              rootMsgId = raw.id;
          }
      }

      ingestUserMessage({
        platform: 'telegram',
        userExternalId: raw.fromId?.userId?.toString() ?? 'unknown',
        threadId: `${inputPeerKey}:${rootMsgId}`,
        text,
        ts,
      });

      // Update cache so that subsequent messages without explicit "reply"
      // in the same chat within THREAD_CACHE_MS are linked to this root.
      recentThreadCache.set(chatIdNormalised, { rootMsgId, ts });
    } catch (err) {
      logger.error('Telegram handler error', err);
    }
  }, new NewMessage({}));
}

export async function startTelegramIngestor() {
  client = await getTelegramClient();
  attachMessageHandler(client);
  logger.info('Telegram ingestor running');
} 