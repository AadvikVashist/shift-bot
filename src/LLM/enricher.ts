import { Logger } from '../helpers/logger';
import { supabaseService } from '../helpers/supabase/client';
import { WebSocketServer } from '../websocket/ws-server';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import pLimit from 'p-limit';
import { env } from '../helpers/config/env';
import { getTelegramDigestPrompt } from './prompts/telegramDigestPrompt';

/**
 * Lightweight, in-process LLM enrichment helper.
 * -------------------------------------------------
 *  • Exposes `enqueueEnrichment(rowId, text, platform)` – returns immediately.
 *  • Runs a concurrency-limited background queue so ingest speed isn't blocked.
 *  • Uses the service-role Supabase client; failures are logged, never thrown.
 */

const logger = Logger.create('LLMEnricherInline');

const {
  apiKey: GEMINI_API_KEY,
  model: GEMINI_MODEL,
  enabled: GEMINI_ENABLED,
  concurrency: LLM_CONCURRENCY_NUM,
} = env.gemini;

const ENABLED = GEMINI_ENABLED;

if (!ENABLED) logger.warn('Inline LLM enrichment disabled via env flags');

// Initialise Gemini only if enabled
const gemini = ENABLED ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Zod validation schema (trimmed for brevity – identical to worker)
const llmDigestItemSchema = z.object({
  title: z.string().max(150),
  body: z.string().max(800),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']),
  coins: z.array(z.string()),
  analysis: z.string().max(1200),
  strength: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  topics: z.array(z.string()),
});
const llmDigestSchema = z.object({ digest: z.array(llmDigestItemSchema) });

type LlmDigest = z.infer<typeof llmDigestSchema>;

interface SummaryResult {
  digest: LlmDigest;
  thinking: string | null;
  rawResponse: any; // full Gemini API payload (plain JSON-serialisable)
}

// Concurrency limiter
const limit = pLimit(LLM_CONCURRENCY_NUM);

// Previously we validated against a static list of crypto tickers.
// For the current bug-tracking context this is unnecessary, so we omit the list.

async function generateSummary(
  text: string,
  platform: string,
): Promise<SummaryResult> {
  if (!gemini) throw new Error('Gemini disabled');

  // ✨ future: choose prompt per platform
  const SYSTEM_PROMPT = getTelegramDigestPrompt('');

  const response: any = await (gemini as any).models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      thinkingConfig: {
        thinkingBudget: 8000,
        includeThoughts: true, // capture summarised chain-of-thought
      },
      temperature: 0.25,
      topP: 1,
      responseMimeType: 'application/json',
      systemInstruction: [{ text: SYSTEM_PROMPT }],
    },
  });

  const parts = response?.candidates?.[0]?.content?.parts ?? [];

  // Extract JSON answer part (the one not flagged as thought)
  const answerPart = parts.find((p: any) => p && p.text && !p.thought) ?? {};
  const rawJson = answerPart.text ?? '';

  // Extract thought summaries
  const thinkingTexts = parts
    .filter((p: any) => p?.thought && p.text)
    .map((p: any) => (p.text as string).trim());
  const thinking = thinkingTexts.length ? thinkingTexts.join('\n\n') : null;

  const digest = llmDigestSchema.parse(JSON.parse(rawJson));

  // Deep-clone plain JSON to ensure serialisable (strip functions, bigint, etc.)
  const rawResponse = JSON.parse(JSON.stringify(response));

  return { digest, thinking, rawResponse };
}

export interface EnqueueArgs {
  rowId: string;
  text: string;
  platform: string;
}

export function enqueueEnrichment(args: EnqueueArgs): Promise<void> {
  if (!ENABLED) return Promise.resolve();
  if (args.platform !== 'telegram') return Promise.resolve();
  return limit(() => enrich(args)).catch((err: unknown) => {
    logger.error('Enqueue fail', err);
    return Promise.resolve();
  });
}

async function enrich({ rowId, text, platform }: EnqueueArgs): Promise<void> {
  console.log('Enriching', rowId);
  try {
    const { digest, thinking, rawResponse } = await generateSummary(
      text,
      platform,
    );
    const d = digest.digest[0];

    // Keep uppercase deduplicated list (no external validation)
    const validCoins = Array.from(new Set(d.coins.map((c) => c.toUpperCase())));

    const { data: updatedItem, error } = await supabaseService
      .from('news_items')
      .update({
        llm_enriched: true,
        title: d.title,
        body: d.body,
        sentiment:
          d.sentiment === 'bullish' ? 1 : d.sentiment === 'bearish' ? 0 : 0.5,
        relevance: d.relevance,
        strength: d.strength,
        coins: validCoins,
        topics: d.topics,
        analysis: d.analysis,
        llm_thinking: thinking,
        llm_response: rawResponse,
      })
      .eq('id', rowId)
      .select(
        '*, news_sources!inner(id, platform, title, source_uid, handle, source_name)',
      )
      .single();

    if (error) throw error;

    if (updatedItem) {
      const source = updatedItem.news_sources;
      const portableItem = {
        ...updatedItem,
        platform: source.platform,
        source_title: source.title,
        source_uid: source.handle || source.source_uid,
      };
      console.log('Broadcasting enriched item', portableItem);
      WebSocketServer.getInstance()?.broadcastNews(portableItem);
    }
    logger.info('Enriched row', rowId);
  } catch (err) {
    logger.error('Enrichment failed', rowId, err);
  }
}
