import 'dotenv/config';
import { ringTelegramUser } from '../../src/helpers/telegram/caller';

(async () => {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: pnpm run ring <telegram_username_or_id>');
    process.exit(1);
  }

  try {
    await ringTelegramUser(username);
    console.log('✅  Call initiated successfully (will auto-disconnect after ~20 s)');
  } catch (err) {
    console.error('❌  Failed to place call:', err);
    process.exit(1);
  }
})(); 