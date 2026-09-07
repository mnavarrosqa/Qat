import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const dir = '.qat-cache';
export const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

export async function cached(key, producer) {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${hash(key)}.txt`);
  try { return await fs.readFile(file, 'utf8'); } catch {}
  const value = await producer();
  await fs.writeFile(file, value, 'utf8');
  return value;
}
