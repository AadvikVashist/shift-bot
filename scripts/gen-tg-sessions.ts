import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input';
import 'dotenv/config';

(async () => {
  const { TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE } = process.env;
  console.log(TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE);
  if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH || !TELEGRAM_PHONE) {
    console.error('❌  TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_PHONE environment variables are required.');
    process.exit(1);
  }

  const client = new TelegramClient(
    new StringSession(''),
    Number(TELEGRAM_API_ID),
    TELEGRAM_API_HASH,
    { connectionRetries: 5 },
  );

  await client.start({
    phoneNumber: () => Promise.resolve(TELEGRAM_PHONE),
    phoneCode: () => input.text('Telegram code sent by Telegram: '),
    password: () => input.text('2-FA password (if any): ', { masking: true }),
    onError: (err) => console.error(err),
  });

  const session = client.session.save();
  console.log('\nSESSION_STRING =>');
  console.log(session);
  console.log('\nCopy it to your .env as SERVICE_SESSION');
  process.exit(0);
})();