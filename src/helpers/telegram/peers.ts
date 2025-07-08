import { Api } from 'telegram';

/**
 * Serialises an InputPeer into a compact string for persistence.
 * Format:
 *   user:<userId>:<accessHash>
 *   channel:<channelId>:<accessHash>
 *   chat:<chatId>
 */
export function serialiseInputPeer(peer: Api.TypeInputPeer): string {
  if (peer instanceof Api.InputPeerUser) {
    return `user:${peer.userId.toString()}:${peer.accessHash.toString()}`;
  }
  if (peer instanceof Api.InputPeerChannel) {
    return `channel:${peer.channelId.toString()}:${peer.accessHash.toString()}`;
  }
  if (peer instanceof Api.InputPeerChat) {
    return `chat:${peer.chatId.toString()}`;
  }
  throw new Error('Unsupported InputPeer type');
}

/**
 * Restores an InputPeer from its string representation.
 * Falls back to returning the original string (legacy chatId) when the format
 * doesn't match the serialised pattern so old rows still work.
 */
export function parsePeerKey(key: string): Api.TypeInputPeer | string {
  // Legacy pure numeric or -100xxx IDs – let GramJS resolve them directly.
  if (/^-?\d+$/.test(key)) return key;

  const parts = key.split(':');
  const kind = parts[0];
  if (kind === 'user' && parts.length === 3) {
    const [_, userId, accessHash] = parts;
    return new Api.InputPeerUser({
      userId: BigInt(userId),
      accessHash: BigInt(accessHash),
    });
  }
  if (kind === 'channel' && parts.length === 3) {
    const [_, channelId, accessHash] = parts;
    return new Api.InputPeerChannel({
      channelId: BigInt(channelId),
      accessHash: BigInt(accessHash),
    });
  }
  if (kind === 'chat' && parts.length === 2) {
    const [_, chatId] = parts;
    return new Api.InputPeerChat({ chatId: BigInt(chatId) });
  }
  // Unknown format – better to fall back to raw key.
  return key;
} 