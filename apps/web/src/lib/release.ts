import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC = join(process.cwd(), 'public');

export function kilobytes(file: string) {
  try {
    return `${Math.round(statSync(join(PUBLIC, file)).size / 1024)} KB`;
  } catch {
    return null;
  }
}

export function version() {
  try {
    return readFileSync(join(PUBLIC, 'gengar.user.js'), 'utf8').match(/@version\s+(\S+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}
