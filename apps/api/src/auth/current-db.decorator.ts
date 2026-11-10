import {
  ExecutionContext,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';
import type { TenantTransaction } from '@rma/db';
import { RequestWithAuth } from './request-auth.js';

export const Db = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantTransaction => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.db) {
      throw new InternalServerErrorException('租户数据库会话还没准备好');
    }

    return request.db;
  },
);
