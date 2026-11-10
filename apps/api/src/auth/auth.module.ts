import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClerkJwtVerifier } from './clerk-jwt.verifier.js';
import { CLERK_TOKEN_VERIFIER } from './clerk-token-verifier.js';
import { ClerkAuthGuard } from './auth.guard.js';
import { TenantContextInterceptor } from './tenant-context.interceptor.js';

@Module({
  providers: [
    {
      provide: CLERK_TOKEN_VERIFIER,
      useFactory: () => {
        const secretKey = process.env.CLERK_SECRET_KEY;
        if (!secretKey) {
          throw new Error(
            '缺少 CLERK_SECRET_KEY。请把它写到 apps/api/.env（可参考 apps/api/.env.example），然后重新启动 API。',
          );
        }

        return new ClerkJwtVerifier(secretKey);
      },
    },
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AuthModule {}
