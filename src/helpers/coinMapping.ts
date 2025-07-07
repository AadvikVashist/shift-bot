import fs from 'fs';
import path from 'path';

// Lazy-load and cache mapping JSON to avoid repeated disk I/O
let mapping: Record<string, unknown> | null = null;

function loadMapping(): Record<string, unknown> {
  if (mapping) return mapping;
  const filePath = path.join(__dirname, '../../market-data/market-mapping.json');
  mapping = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  return mapping;
}

/** Check if a coin symbol appears in the market-mapping dataset */
export function isValidCoin(symbol: string): boolean {
  const map = loadMapping();
  return Object.prototype.hasOwnProperty.call(map, symbol.toUpperCase());
}

/** Filter an array of coin symbols, keeping only ones known in the mapping */
export function filterValidCoins<T extends string>(symbols: T[]): T[] {
  return symbols.filter((s) => isValidCoin(s)) as T[];
}

/** Get an array of all coin symbols present in the mapping */
export function getAllCoins(): string[] {
  return Object.keys(loadMapping());
} 