import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export { PrismaClient };

export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env in the repository root.');
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
