import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import { Logger } from '../helpers/logger';
import { env } from '../helpers/config/env';
import { ingestUserMessage } from './ingest';
import fs from 'fs';
import path from 'path';

const logger = Logger.create('SlackIngestor');

// Initialise Slack clients
const slackWeb = new WebClient(env.slack.botToken);
const slackSocket = new SocketModeClient({
  appToken: env.slack.appToken,
  webClient: slackWeb,
} as any);

// Load unified sources config
const sourcesPath = path.join(__dirname, '../config/sources.json');
interface SourceCfg { platform: string; id?: string; handle?: string; name?: string; active?: boolean }
let slackSources: SourceCfg[] = [];
try {
  const raw = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8')) as SourceCfg[];
  slackSources = raw.filter((s) => s.platform === 'slack' && (s.active ?? true));
  logger.info(`Loaded ${slackSources.length} active Slack sources from config`);
} catch (err) {
  logger.error('Failed to load sources.json', err);
}

const allowedChannels = slackSources.map((s) => s.id!);

slackSocket.on('events_api', async ({ envelope_id, payload }) => {
  // Always acknowledge first per Slack docs
  await (slackSocket as any).ack(envelope_id);

  try {
    const event: any = payload.event;

    if (event?.type !== 'message' || !!event.subtype) return; // ignore bot edits, etc.

    const channelId: string = event.channel;
    if (allowedChannels.length && !allowedChannels.includes(channelId)) {
      return; // ignore messages from channels not in config
    }

    const text: string = (event.text || '').trim();
    if (!text) return;

    // Convert Slack ts (e.g., "1709453961.305609") → epoch ms
    const tsMs = event.ts ? Math.floor(Number(event.ts) * 1000) : Date.now();

    await ingestUserMessage({
      platform: 'slack',
      userExternalId: event.user,
      threadId: `${channelId}:${event.thread_ts ? event.thread_ts : event.ts}`,
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