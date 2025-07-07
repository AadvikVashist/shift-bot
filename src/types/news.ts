// Shared news-related domain types used across the ingestion pipeline and
// WebSocket delivery. Centralising them helps us avoid the pervasive `any`.
// ---------------------------------------------------------------------------------
import { Tables } from '../helpers/supabase/database.types';

// Row shapes generated from the Supabase schema ------------------------------
export type NewsItemRow = Tables<'news_items'>;
export type NewsSourceRow = Tables<'news_sources'>;

// NOTE: queries in the code only select a subset of columns from news_sources
// (id, platform, title, source_uid, handle, source_name). To keep the type
// sound we model that minimal projection instead of the full Row.
export type NewsSourceMinimal = Pick<
  NewsSourceRow,
  'id' | 'platform' | 'title' | 'source_uid' | 'handle' | 'source_name'
>;

export type NewsItemWithSource = NewsItemRow & {
  news_sources: NewsSourceMinimal;
};

// Flattened version that the frontend consumes over WebSocket ----------------
export interface PortableNewsItem extends NewsItemRow {
  /** telegram | twitter | etc. */
  platform: string | null;
  /** Human-friendly channel / account name */
  source_title: string | null;
  /** `handle` when present, else raw `source_uid` */
  source_uid: string | null;
}

// Convenience type for event-bus payloads ------------------------------------
export type NewsItemPayload = PortableNewsItem;
