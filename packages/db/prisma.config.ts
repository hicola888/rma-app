import { parse } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

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

const localDatabaseUrl = 'postgresql://rma:rma@localhost:5432/rma?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prisma 7 reads this URL for CLI commands such as migrate.
    // DIRECT_URL is the direct connection; DATABASE_URL may be a pooler.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? localDatabaseUrl,
  },
});
