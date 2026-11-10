import { ForbiddenException } from '@nestjs/common';
import type { ResolvedMembership } from '@rma/db';
import type { RequestWithAuth } from './request-auth.js';

export function requireFacilityReader(request: RequestWithAuth): ResolvedMembership {
  if (!request.auth || request.auth.role === 'merchant_user') {
    throw new ForbiddenException('货主账号不能查看仓库和员工资料');
  }
  return request.auth;
}

export function requireFacilityAdmin(request: RequestWithAuth): ResolvedMembership {
  const auth = requireFacilityReader(request);
  if (auth.role !== 'tenant_admin') {
    throw new ForbiddenException('只有租户管理员可以修改仓库、库位和员工角色');
  }
  return auth;
}
