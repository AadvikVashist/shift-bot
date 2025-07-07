import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input';
import 'dotenv/config';

(async () => {
  const { TG_API_ID, TG_API_HASH, TG_PHONE_NUMBER } = process.env;
  if (!TG_API_ID || !TG_API_HASH || !TG_PHONE_NUMBER) {
    console.error('❌  TG_API_ID, TG_API_HASH, and PHONE environment variables are required.');
    process.exit(1);
  }

  const client = new TelegramClient(
    new StringSession(''),
    Number(TG_API_ID),
    TG_API_HASH,
    { connectionRetries: 5 },
  );

  await client.start({
    phoneNumber: () => Promise.resolve(TG_PHONE_NUMBER),
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