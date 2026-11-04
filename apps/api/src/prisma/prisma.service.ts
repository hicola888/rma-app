import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@rma/db';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private client: PrismaClient | undefined;

  isConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL);
  }

  getClient(): PrismaClient {
    this.client ??= createPrismaClient();
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.$disconnect();
    this.client = undefined;
  }
}
