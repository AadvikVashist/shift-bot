import { NewsItemWithSource, PortableNewsItem } from '../types/news';

/**
 * Flatten / decorate a raw `news_items` row (joined with `news_sources`) so the
 * frontend gets a simple, self-contained object that is safe to send over the
 * wire.
 */
export function enrichNewsRow(row: NewsItemWithSource): PortableNewsItem {
  const src = row.news_sources;

  // Exclude the joined `news_sources` field before returning because the
  // consumer only needs the flattened view.
  const { news_sources: _unused, ...newsItemFields } = row;

  return {
    ...newsItemFields,
    platform: src.platform, // telegram | twitter | …
    source_title: src.title ?? src.source_name ?? src.handle ?? null,
    source_uid: src.handle ?? src.source_uid ?? null,
  } as PortableNewsItem;
} 