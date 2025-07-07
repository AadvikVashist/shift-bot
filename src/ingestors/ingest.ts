import { supabaseService } from '../helpers/supabase/client';
import { Logger } from '../helpers/logger';
import { enqueueEnrichment } from '../LLM/enricher';
import { createHash } from 'crypto';

const logger = Logger.create('IngestHelper');

export interface IngestPayload {
  platform: string; // e.g. 'telegram', 'twitter', 'web'
  sourceUid: string; // unique identifier per platform (handle, url)
  sourceTitle?: string; // human readable name
  text: string; // full text / body
  ts?: number; // epoch ms; defaults to Date.now()
}

const sourceCache = new Map<string, string>(); // platform|uid → source_id

async function getExistingSourceId(
  platform: string,
  uid: string,
): Promise<string | null> {
  const cacheKey = `${platform}|${uid}`;
  const cached = sourceCache.get(cacheKey);
  if (cached) return cached;

  const { data: existing, error } = await supabaseService
    .from('news_sources')
    .select('id, is_active')
    .eq('platform', platform)
    .eq('source_uid', uid)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch news_source', { platform, uid, error });
    return null;
  }

  if (!existing || existing.is_active === false) {
    // Either the source is unknown or explicitly inactive – skip ingestion.
    return null;
  }

  sourceCache.set(cacheKey, existing.id);
  return existing.id;
}

export async function ingestRawNews(payload: IngestPayload): Promise<void> {
  try {
    if (!payload.text.trim()) return;
    const databaseSourceId = await getExistingSourceId(
      payload.platform,
      payload.sourceUid,
    );
    if (!databaseSourceId) {
      // Log and skip when the source is unknown or inactive
      logger.debug('Skipped ingestion - source not allowed', {
        platform: payload.platform,
        uid: payload.sourceUid,
      });
      return;
    }

    // Generate deterministic hash for deduplication (platform|source|text)
    const hash = createHash('sha256')
      .update(`${payload.platform}|${payload.sourceUid}|${payload.text}`)
      .digest('hex');

    const row = {
      source_id: databaseSourceId,
      title: payload.text,
      body: payload.text,
      created_at: new Date(payload.ts ?? Date.now()).toISOString(),
      fetched_at: new Date().toISOString(),
      sentiment: 0.5,
      llm_enriched: false,
      hash,
    } as const;

    const { data: inserted, error } = await supabaseService
      .from('news_items')
      .upsert(row, { onConflict: 'hash' })
      .select('id')
      .single();
    if (error) {
      logger.error('Insert news_item failed', error);
      return;
    }

    // Run LLM enrichment first, then publish Redis event so subscribers receive enriched data.
    enqueueEnrichment({
      rowId: inserted.id,
      text: payload.text,
      platform: payload.platform,
    });
  } catch (err) {
    logger.error('ingestRawNews error', err);
  }
}
