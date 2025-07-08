import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import { Logger } from '../helpers/logger';
import { env } from '../helpers/config/env';
import { ingestRawNews } from './ingest';
import { supabaseService } from '../helpers/supabase/client';

const logger = Logger.create('SlackIngestor');

// Initialise Slack clients
const slackWeb = new WebClient(env.slack.botToken);
const slackSocket = new SocketModeClient({
  appToken: env.slack.appToken,
  webClient: slackWeb,
});

// Cache to avoid repeated DB upserts per channel
const syncedChannels = new Set<string>();

async function upsertNewsSource(channelId: string) {
  if (syncedChannels.has(channelId)) return;
  try {
    const res = await slackWeb.conversations.info({ channel: channelId });
    const channel: any = (res as any).channel ?? {};
    const name: string = channel.name ?? channelId;

    await supabaseService.from('news_sources').upsert(
      {
        platform: 'slack',
        source_uid: channelId,
        handle: name,
        source_name: `#${name}`,
        title: name,
        is_active: true,
        visibility: 'system',
      },
      { onConflict: 'platform,source_uid' },
    );

    syncedChannels.add(channelId);
  } catch (err) {
    logger.warn('Failed to upsert Slack source', { channelId, err });
  }
}

slackSocket.on('events_api', async ({ envelope_id, payload }) => {
  // Always acknowledge first per Slack docs
  await slackSocket.ack(envelope_id);

  try {
    const event: any = payload.event;

    if (event?.type !== 'message' || !!event.subtype) return; // ignore bot edits, etc.

    const channelId: string = event.channel;
    const text: string = (event.text || '').trim();
    if (!text) return;

    // Convert Slack ts (e.g., "1709453961.305609") → epoch ms
    const tsMs = event.ts ? Math.floor(Number(event.ts) * 1000) : Date.now();

    // Ensure the channel exists in our DB, then ingest
    await upsertNewsSource(channelId);

    await ingestRawNews({
      platform: 'slack',
      sourceUid: channelId,
      sourceTitle: `#${channelId}`,
      text,
      ts: tsMs,
    });
  } catch (err) {
    logger.error('Slack handler error', err);
  }
});

export async function startSlackIngestor() {
  await slackSocket.start();
  logger.info('Slack ingestor running (Socket Mode)');
} 