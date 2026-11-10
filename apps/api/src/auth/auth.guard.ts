import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { findMembershipByClerk } from '@rma/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { CLERK_TOKEN_VERIFIER, type ClerkTokenVerifier } from './clerk-token-verifier.js';
import { ALLOW_NO_MEMBERSHIP_KEY } from './allow-without-membership.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { RequestWithAuth } from './request-auth.js';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CLERK_TOKEN_VERIFIER) private readonly verifier: ClerkTokenVerifier,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录或登录已失效');
    }

    const token = header.slice('Bearer '.length).trim();
    let identity;
    try {
      identity = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('未登录或登录已失效');
    }

    request.clerk = identity;
    const membership = await findMembershipByClerk(
      this.prisma.getClient(),
      identity.clerkUserId,
      identity.clerkOrgId,
    );
    const allowWithoutMembership = this.reflector.getAllAndOverride<boolean>(
      ALLOW_NO_MEMBERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!membership) {
      if (allowWithoutMembership) {
        return true;
      }
      throw new ForbiddenException(
        '当前账号还没有加入这个租户。请打开网页 /me，复制 Clerk User ID 和 Organization ID，然后在仓库根目录运行 pnpm db:bootstrap。',
      );
    }
    if (membership.role === 'merchant_user' && !membership.merchantId) {
      throw new ForbiddenException('货主账号必须绑定一个货主');
    }

    request.auth = membership;
    return true;
  }
}
