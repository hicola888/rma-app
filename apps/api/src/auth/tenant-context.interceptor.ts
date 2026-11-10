import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestWithAuth } from './request-auth.js';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.auth) {
      return next.handle();
    }

    const auth = request.auth;
    return from(
      this.prisma.runWithMembership(auth, async (db) => {
        request.db = db;
        return lastValueFrom(next.handle());
      }),
    );
  }
}
