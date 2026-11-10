import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AllowWithoutMembership } from '../auth/allow-without-membership.decorator.js';

type MeRequest = {
  clerk?: { clerkUserId: string; clerkOrgId: string };
  auth?: { tenantId: string; role: string; merchantId: string | null };
  db?: {
    tenant: {
      findUnique(args: { where: { id: string } }): Promise<{ id: string; name: string } | null>;
    };
  };
};

class MeTenantDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Epping 仓库' })
  name!: string;
}

class MeResponseDto {
  @ApiProperty({ example: 'user_xxx' })
  clerkUserId!: string;

  @ApiProperty({ example: 'org_xxx' })
  clerkOrgId!: string;

  @ApiProperty({ type: MeTenantDto, nullable: true })
  tenant!: MeTenantDto | null;

  @ApiProperty({ example: 'tenant_admin', nullable: true })
  role!: string | null;

  @ApiProperty({ nullable: true })
  merchantId!: string | null;
}

@ApiTags('me')
@Controller('me')
export class MeController {
  @Get()
  @AllowWithoutMembership()
  @ApiOperation({ summary: '当前登录用户在数据库里的租户和角色' })
  @ApiOkResponse({ type: MeResponseDto })
  async getMe(@Req() request: MeRequest): Promise<MeResponseDto> {
    const clerkUserId = request.clerk?.clerkUserId ?? '';
    const clerkOrgId = request.clerk?.clerkOrgId ?? '';
    if (!request.auth || !request.db) {
      return {
        clerkUserId,
        clerkOrgId,
        tenant: null,
        role: null,
        merchantId: null,
      };
    }

    const tenant = await request.db.tenant.findUnique({
      where: { id: request.auth.tenantId },
    });

    return {
      clerkUserId,
      clerkOrgId,
      tenant: tenant ? { id: tenant.id, name: tenant.name } : null,
      role: request.auth.role,
      merchantId: request.auth.merchantId,
    };
  }
}
