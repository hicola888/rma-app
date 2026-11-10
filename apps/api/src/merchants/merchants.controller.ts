import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Db } from '../auth/current-db.decorator.js';
import type { RequestWithAuth } from '../auth/request-auth.js';

type CreateMerchantBody = {
  name?: string;
  code?: string;
};

type MerchantDb = {
  merchant: {
    findMany(args: { orderBy: { code: 'asc' } }): Promise<MerchantRow[]>;
    create(args: { data: { tenantId: string; name: string; code: string } }): Promise<MerchantRow>;
  };
};

type MerchantRow = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
};

@ApiTags('merchants')
@Controller('merchants')
export class MerchantsController {
  @Get()
  @ApiOperation({ summary: '列出当前租户可见的货主' })
  @ApiOkResponse({ description: '货主列表。货主账号只能看到自己的货主。' })
  list(@Db() db: MerchantDb) {
    return db.merchant.findMany({ orderBy: { code: 'asc' } });
  }

  @Post()
  @ApiOperation({ summary: '在当前租户下创建货主' })
  create(@Db() db: MerchantDb, @Req() request: RequestWithAuth, @Body() body: CreateMerchantBody) {
    const name = body.name?.trim();
    const code = body.code?.trim();
    if (!name || !code || !request.auth) {
      throw new BadRequestException('请填写货主名称和代码');
    }

    return db.merchant.create({
      data: {
        tenantId: request.auth.tenantId,
        name,
        code,
      },
    });
  }
}
