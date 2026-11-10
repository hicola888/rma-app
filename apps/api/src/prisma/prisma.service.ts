import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  createPrismaClient,
  withTenantSession,
  type PrismaClient,
  type ResolvedMembership,
  type TenantTransaction,
} from '@rma/db';

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

  runWithMembership<T>(
    membership: ResolvedMembership,
    run: (db: TenantTransaction) => Promise<T>,
  ): Promise<T> {
    return withTenantSession(
      this.getClient(),
      {
        tenantId: membership.tenantId,
        merchantId: membership.role === 'merchant_user' ? membership.merchantId : null,
        userId: membership.userId,
      },
      run,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.$disconnect();
    this.client = undefined;
  }
}
