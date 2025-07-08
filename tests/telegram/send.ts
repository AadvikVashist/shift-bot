import 'dotenv/config';
import { sendTelegramReply } from '../../src/helpers/telegram/sender';

(async () => {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: pnpm run send <chat_id> <message>');
    process.exit(1);
  }

  const [chatId, ...messageParts] = args;
  const message = messageParts.join(' ');

  try {
    await sendTelegramReply(chatId, null, message);
    console.log('✅  Message sent');
  } catch (err) {
    console.error('❌  Failed to send message:', err);
    process.exit(1);
  }
})(); 