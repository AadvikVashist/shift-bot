import { Api } from 'telegram';
import bigInt from 'big-integer';
import {
  generateRandomBigInt,
  readBigIntFromBuffer,
  readBufferFromBigInt,
  sha256,
} from 'telegram/Helpers';
import { getTelegramClient } from './client';
import { Logger } from '../logger';

const logger = Logger.create('TgCaller');

/**
 * Initiates a one-way Telegram voice call that simply rings the recipient and
 * then hangs up after 20 seconds so it shows as a missed call. No audio is
 * exchanged (we never complete the DH handshake).
 *
 * The function resolves once the requestCall RPC succeeds. Any subsequent
 * errors (e.g. discarding the call) are only logged.
 *
 * @param userIdentifier  username ("@alice") or numeric id that
 *                        `TelegramClient.getInputEntity` understands.
 */
export async function ringTelegramUser(userIdentifier: string): Promise<void> {
  const client = await getTelegramClient();

  // 1️⃣  Resolve the callee into an InputUser
  const inputUser = await client.getInputEntity(userIdentifier);

  // 2️⃣  Fetch current DH params (p, g)
  const dh = await client.invoke(
    new Api.messages.GetDhConfig({ version: 0, randomLength: 256 }),
  );
  if (dh instanceof Api.messages.DhConfigNotModified) {
    throw new Error('Failed to obtain DH config');
  }

  // 3️⃣  Generate our ephemeral secret a and its hash gAHash
  const p = readBigIntFromBuffer(dh.p, false, false);
  const g = bigInt(dh.g);
  let a = bigInt.zero;
  while (!(bigInt.one.lesser(a) && a.lesser(p.minus(1)))) {
    a = generateRandomBigInt(); // random 2048-bit int
  }
  const gA = g.modPow(a, p);
  const gAHash = await sha256(readBufferFromBigInt(gA, 256, false, false));

  // 4️⃣  Protocol description copied from Telegram Desktop (layer 93)
  const protocol = new Api.PhoneCallProtocol({
    minLayer: 93,
    maxLayer: 93,
    udpP2p: true,
    udpReflector: true,
    libraryVersions: ['4.0.0', '3.0.0', '2.7.7', '2.4.4'],
  });

  // 5️⃣  Place the call (ring tone on the other side)
  logger.info(`Placing Telegram voice call to ${userIdentifier}`);
  const call: any = await client.invoke(
    new Api.phone.RequestCall({
      userId: inputUser,
      randomId: Math.floor(Math.random() * 0x7ffffffa),
      gAHash,
      protocol,
      video: false,
    })
  );

  // 6️⃣  Auto-discard after 20 s so it registers as missed
  setTimeout(async () => {
    try {
      await client.invoke(
        new Api.phone.DiscardCall({
          peer: new Api.InputPhoneCall({
            id: call.phoneCall.id,
            accessHash: call.phoneCall.accessHash,
          }),
          reason: new Api.PhoneCallDiscardReasonMissed(),
          duration: 0,
        })
      );
      logger.info(`Call discarded (marked as missed) to ${userIdentifier}`);
    } catch (err) {
      logger.error('Failed to discard call', err);
    }
  }, 20_000);
} 