import { TelegramSeed } from './types';

/**
 * Approved Telegram channels to ingest during development/testing.
 * Chat IDs are optional; username-only works for public channels.
 */
export const telegramSeeds: TelegramSeed[] = [
  // Macro & geopolitics
  { platform: 'telegram', handle: 'ReutersWorldChannel', title: 'Reuters World' },
  { platform: 'telegram', handle: 'forexnews', title: 'ForexNews' },
  { platform: 'telegram', handle: 'FinancialJuice', title: 'FinancialJuice' },
  { platform: 'telegram', handle: 'tradingecon', title: 'Trading Economics' },

  // Crypto – on-chain & security
  { platform: 'telegram', handle: 'whale_alert_io', title: 'Whale Alert' },
  { platform: 'telegram', handle: 'peckshield', title: 'PeckShield Alerts' },
  { platform: 'telegram', handle: 'web3_security_alerts', title: 'Web3 Security Alerts' },
  { platform: 'telegram', handle: 'TreeNewsFeed', title: 'Tree News' },
  { platform: 'telegram', handle: 'binance_announcements', title: 'Binance Announcements' },

  // General crypto news / sentiment
  { platform: 'telegram', handle: 'cointelegraph', title: 'Cointelegraph' },
  { platform: 'telegram', handle: 'onecryptofeed', title: 'One Crypto Feed' },
  { platform: 'telegram', handle: 'iansintel', title: 'Ian\'s Intel' },
  { platform: 'telegram', handle: 'infinityhedge', title: 'Infinity Hedge' },
  { platform: 'telegram', handle: '@klyratest', title: 'Klyra', active: false },
  { platform: 'telegram', handle: 'BWEnews', title: 'BWEnews' },
  { platform: 'telegram', handle: 'CoinDeskGlobal', title: 'CoinDesk News Feed' },
];

export default telegramSeeds; 