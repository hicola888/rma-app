import { parse } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  return parse(readFileSync(path));
}

const merged = {
  ...readEnvFile(resolve(process.cwd(), '../../.env')),
  ...readEnvFile(resolve(process.cwd(), '.env')),
};

for (const [key, value] of Object.entries(merged)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
