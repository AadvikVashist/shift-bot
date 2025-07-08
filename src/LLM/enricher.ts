import { Logger } from '../helpers/logger';
import { supabaseService } from '../helpers/supabase/client';
import { escalateTicket } from '../helpers/escalation/escalator';
import { sendTelegramReply } from '../helpers/telegram/sender';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import pLimit from 'p-limit';
import { env } from '../helpers/config/env';
import { getTicketTriagePrompt } from './prompts/ticketTriagePrompt';

/**
 * Inline LLM ticket triage + auto-reply helper
 * --------------------------------------------
 * ‣ `enqueueEnrichment({ticketId, text, platform})` runs a concurrency-limited queue.
 * ‣ Inserts an `llm_answer` row into `ticket_actions` and updates ticket status.
 * ‣ Never throws to caller – all errors logged internally.
 */

// ---------------------------------------------------------------------------
// Config / setup
// ---------------------------------------------------------------------------
const logger = Logger.create('LLMEnricher');

const {
  apiKey: GEMINI_API_KEY,
  model: GEMINI_MODEL,
  enabled: GEMINI_ENABLED,
  concurrency: LLM_CONCURRENCY_NUM,
} = env.gemini;

const ENABLED = GEMINI_ENABLED;
if (!ENABLED) logger.warn('Inline LLM enrichment disabled via env flags');

// Initialise Gemini only if enabled so local dev works offline
const gemini = ENABLED ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// ---------------------------------------------------------------------------
// Schema & types
// ---------------------------------------------------------------------------
const triageSchema = z.object({
  answer: z.string().max(500),
  severity: z.number().min(0).max(1),
  escalation: z.boolean(),
});
export type TicketTriage = z.infer<typeof triageSchema>;

export interface EnqueueArgs {
  ticketId: string;
  text: string;       // latest user message text
  platform: 'slack' | 'telegram';
}

// ---------------------------------------------------------------------------
// Public API – enqueue
// ---------------------------------------------------------------------------
const limit = pLimit(LLM_CONCURRENCY_NUM);

export function enqueueEnrichment(args: EnqueueArgs): Promise<void> {
  if (!ENABLED) return Promise.resolve();
  return limit(() => enrich(args)).catch((err) => {
    logger.error('enqueueEnrichment failed', err);
    return Promise.resolve();
  });
}

// ---------------------------------------------------------------------------
// Core enrichment logic
// ---------------------------------------------------------------------------
async function enrich({ ticketId, text, platform }: EnqueueArgs): Promise<void> {
  try {
    // 1️⃣  Invoke Gemini
    const SYSTEM_PROMPT = getTicketTriagePrompt();

    const response: any = await (gemini as any).models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { role: 'user', parts: [{ text }] },
      ],
      config: {
        thinkingConfig: {
          thinkingBudget: 4000,
          includeThoughts: true,
        },
        temperature: 0.3,
        topP: 1,
        responseMimeType: 'application/json',
        systemInstruction: [{ text: SYSTEM_PROMPT }],
      },
    });

    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    const answerPart = parts.find((p: any) => p && p.text && !p.thought) ?? {};
    const rawJson = answerPart.text ?? '';

    const thinkingTexts = parts
      .filter((p: any) => p?.thought && p.text)
      .map((p: any) => (p.text as string).trim());
    const thinking = thinkingTexts.length ? thinkingTexts.join('\n\n') : null;

    const parsed: TicketTriage = triageSchema.parse(JSON.parse(rawJson));

    // 2️⃣  Persist to DB
    await persistResults({ ticketId, triage: parsed, thinking });

    logger.info('Enriched ticket', { ticketId, severity: parsed.severity });
  } catch (err) {
    logger.error('enrich failed', { ticketId, err });
  }
}

async function persistResults({
  ticketId,
  triage,
  thinking,
}: {
  ticketId: string;
  triage: TicketTriage;
  thinking: string | null;
}): Promise<void> {
  // Insert ticket_actions row
  const { error: insertErr } = await (supabaseService as any)
    .from('ticket_actions')
    .insert({
      ticket_id: ticketId,
      action_type: 'llm_answer',
      escalation_needed: triage.escalation,
      severity: triage.severity,
      content: triage.answer,
      thinking_data: thinking ? { t: thinking } : null,
    });
  if (insertErr) {
    logger.error('Failed to insert llm_answer action', insertErr);
  }

  // Update ticket status based on escalation flag
  const newStatus = triage.escalation ? 'escalation_pending' : 'auto_answered';
  const { error: updErr } = await (supabaseService as any)
    .from('tickets')
    .update({ status: newStatus, last_activity_at: new Date().toISOString() })
    .eq('id', ticketId);
  if (updErr) {
    logger.error('Failed to update ticket status', updErr);
  }

  // Send auto-reply when no escalation and platform is telegram
  if (!triage.escalation) {
    const { data: ticketRow, error: fetchErr } = await (supabaseService as any)
      .from('tickets')
      .select('platform, thread_id')
      .eq('id', ticketId)
      .maybeSingle();

    if (fetchErr) {
      logger.error('Failed to fetch ticket for auto-reply', fetchErr);
    } else if (ticketRow?.platform === 'telegram' && ticketRow.thread_id) {
      const thread = ticketRow.thread_id as string;
      // The new format stores peerKey:rootMsgId where peerKey itself may contain ':'
      const lastColon = thread.lastIndexOf(':');
      if (lastColon === -1) return;

      const peerKey = thread.slice(0, lastColon);
      const rootMsgIdStr = thread.slice(lastColon + 1);

      const rootMsgId = rootMsgIdStr ? Number(rootMsgIdStr) : null;
      void sendTelegramReply(peerKey, rootMsgId, triage.answer);
    }
  }

  if (triage.escalation) {
    // Fire escalation flow (non-blocking)
    void escalateTicket(ticketId);
  }
}
