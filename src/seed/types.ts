/**
 * Shared TypeScript definitions for ingestion seed lists.
 * --------------------------------------------------------------------
 * We keep seed data in `.ts` while developing so that:
 *   • arrays are strongly-typed and validated at compile-time,
 *   • IDE autocomplete helps when editing handles/URLs,
 *   • tests can import the same objects without I/O.
 *
 * When a proper admin UI or DB table replaces code-side seeds,
 * this file will still serve as the canonical shape for unit tests.
 */

// ---------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------

/**
 * All ingestion platforms supported or planned.
 * Add new entries here once an ingestor exists (remember to update tests!).
 */
// prettier-ignore
export type Platform =
  | 'telegram'
  | 'x'          // Twitter / X
  | 'rss'
  | 'web'        // Generic URL scraper
  | 'discord'
  | 'youtube';

// ---------------------------------------------------------------------
// Generic seed shape
// ---------------------------------------------------------------------

/**
 * Common properties every seed row possesses.
 * Platform-specific seed types extend this.
 */
export interface BaseSeed<P extends Platform = Platform> {
  /**
   * The platform this feed belongs to. Drives which ingestor picks it up.
   */
  platform: P;

  /**
   * Primary identifier understood by that platform:
   *   • Telegram → channel username (without @)
   *   • X         → user handle (without @)
   *   • RSS       → full URL to feed
   *   • Web       → canonical URL
   */
  handle: string;

  /**
   * Human-friendly title shown in UI (optional – falls back to handle).
   */
  title?: string;

  /**
   * Whether this feed should currently be ingested.
   * Seed sync logic turns `false` feeds into `is_active = false` in DB.
   */
  active?: boolean; // default true

  /**
   * Free-form notes for maintainers (e.g., why it was disabled).
   */
  note?: string;
}

// ---------------------------------------------------------------------
// Platform-specific specialisations (add fields as needed)
// ---------------------------------------------------------------------

export interface TelegramSeed extends BaseSeed<'telegram'> {
  /** Numeric chat ID if known (speeds up joins) */
  chatId?: string;
}

export interface XSeed extends BaseSeed<'x'> {}
export interface RssSeed extends BaseSeed<'rss'> {}
export interface WebSeed extends BaseSeed<'web'> {}
export interface DiscordSeed extends BaseSeed<'discord'> {
  guildId?: string;
  channelId?: string;
}
export interface YouTubeSeed extends BaseSeed<'youtube'> {
  channelId?: string; // UC-…
}

// ---------------------------------------------------------------------
// Discriminated union helpers
// ---------------------------------------------------------------------

export type Seed =
  | TelegramSeed
  | XSeed
  | RssSeed
  | WebSeed
  | DiscordSeed
  | YouTubeSeed;

export type SeedByPlatform<P extends Platform> = Extract<Seed, { platform: P }>; 