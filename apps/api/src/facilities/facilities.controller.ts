import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Db } from '../auth/current-db.decorator.js';
import { requireFacilityAdmin, requireFacilityReader } from '../auth/roles.js';
import type { RequestWithAuth } from '../auth/request-auth.js';

const locationTypes = [
  'receiving',
  'inspection',
  'quarantine',
  'storage',
  'floor_stock',
  'parts',
] as const;

type LocationTypeName = (typeof locationTypes)[number];

type WarehouseBody = {
  name?: string;
  code?: string;
  address?: string | null;
  active?: boolean;
};

type LocationBody = {
  warehouseId?: string;
  code?: string;
  type?: string;
  active?: boolean;
};

type RoleBody = {
  role?: string;
};

type FacilityDb = {
  warehouse: {
    findMany(args: {
      orderBy: { code: 'asc' };
      include: { locations: { orderBy: { code: 'asc' } } };
    }): Promise<unknown[]>;
    findUnique(args: { where: { id: string } }): Promise<WarehouseRow | null>;
    create(args: {
      data: { tenantId: string; name: string; code: string; address: string | null };
    }): Promise<WarehouseRow>;
    update(args: {
      where: { id: string };
      data: { name?: string; code?: string; address?: string | null; active?: boolean };
    }): Promise<WarehouseRow>;
    updateMany(args: {
      where: { id: string };
      data: { name?: string; code?: string; address?: string | null; active?: boolean };
    }): Promise<{ count: number }>;
  };
  location: {
    findMany(args: {
      where?: { warehouseId?: string };
      orderBy: { code: 'asc' };
    }): Promise<unknown[]>;
    findUnique(args: { where: { id: string } }): Promise<LocationRow | null>;
    create(args: {
      data: { tenantId: string; warehouseId: string; code: string; type: LocationTypeName };
    }): Promise<LocationRow>;
    update(args: {
      where: { id: string };
      data: { code?: string; type?: LocationTypeName; active?: boolean };
    }): Promise<LocationRow>;
    updateMany(args: {
      where: { id: string };
      data: { code?: string; type?: LocationTypeName; active?: boolean };
    }): Promise<{ count: number }>;
  };
  membership: {
    findMany(args: {
      orderBy: { createdAt: 'asc' };
      include: { user: { select: { id: true; name: true; email: true; clerkUserId: true } } };
    }): Promise<StaffRow[]>;
    findUnique(args: { where: { id: string } }): Promise<StaffRow | null>;
    count(args: { where: { role: 'tenant_admin' } }): Promise<number>;
    update(args: {
      where: { id: string };
      data: { role: 'tenant_admin' | 'tenant_staff' };
    }): Promise<StaffRow>;
  };
};

type WarehouseRow = { id: string; code: string };
type LocationRow = { id: string; code: string };
type StaffRow = { id: string; role: string; tenantId: string };

function isLocationType(value: string): value is LocationTypeName {
  return locationTypes.includes(value as LocationTypeName);
}

@ApiTags('warehouses')
@Controller('warehouses')
export class WarehousesController {
  @Get()
  @ApiOperation({ summary: '列出当前租户的仓库和库位' })
  @ApiOkResponse({ description: '仓库列表。货主账号不能访问。' })
  list(@Db() db: FacilityDb, @Req() request: RequestWithAuth) {
    requireFacilityReader(request);
    return db.warehouse.findMany({
      orderBy: { code: 'asc' },
      include: { locations: { orderBy: { code: 'asc' } } },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '查看一个仓库' })
  async getOne(@Db() db: FacilityDb, @Req() request: RequestWithAuth, @Param('id') id: string) {
    requireFacilityReader(request);
    const warehouse = await db.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException('找不到这个仓库');
    }
    return warehouse;
  }

  @Post()
  @ApiOperation({ summary: '创建仓库' })
  async create(@Db() db: FacilityDb, @Req() request: RequestWithAuth, @Body() body: WarehouseBody) {
    const auth = requireFacilityAdmin(request);
    const name = body.name?.trim();
    const code = body.code?.trim().toUpperCase();
    if (!name || !code) {
      throw new BadRequestException('请填写仓库名称和代码');
    }
    try {
      return await db.warehouse.create({
        data: {
          tenantId: auth.tenantId,
          name,
          code,
          address: body.address?.trim() || null,
        },
      });
    } catch {
      throw new BadRequestException('仓库代码已存在');
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改仓库，或停用仓库' })
  async update(
    @Db() db: FacilityDb,
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: WarehouseBody,
  ) {
    requireFacilityAdmin(request);
    const data: {
      name?: string;
      code?: string;
      address?: string | null;
      active?: boolean;
    } = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) {
        throw new BadRequestException('仓库名称不能为空');
      }
      data.name = name;
    }
    if (body.code !== undefined) {
      const code = body.code.trim().toUpperCase();
      if (!code) {
        throw new BadRequestException('仓库代码不能为空');
      }
      data.code = code;
    }
    if (body.address !== undefined) {
      data.address = body.address?.trim() || null;
    }
    if (body.active !== undefined) {
      data.active = body.active;
    }
    const updated = await db.warehouse.updateMany({ where: { id }, data });
    if (updated.count === 0) {
      throw new NotFoundException('找不到这个仓库');
    }
    return db.warehouse.findUnique({ where: { id } });
  }
}

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  @Get()
  @ApiOperation({ summary: '列出库位' })
  list(@Db() db: FacilityDb, @Req() request: RequestWithAuth) {
    requireFacilityReader(request);
    return db.location.findMany({ orderBy: { code: 'asc' } });
  }

  @Get(':id')
  @ApiOperation({ summary: '查看一个库位' })
  async getOne(@Db() db: FacilityDb, @Req() request: RequestWithAuth, @Param('id') id: string) {
    requireFacilityReader(request);
    const location = await db.location.findUnique({ where: { id } });
    if (!location) {
      throw new NotFoundException('找不到这个库位');
    }
    return location;
  }

  @Post()
  @ApiOperation({ summary: '创建库位' })
  async create(@Db() db: FacilityDb, @Req() request: RequestWithAuth, @Body() body: LocationBody) {
    const auth = requireFacilityAdmin(request);
    const code = body.code?.trim().toUpperCase();
    const warehouseId = body.warehouseId?.trim();
    if (!warehouseId || !code || !body.type || !isLocationType(body.type)) {
      throw new BadRequestException('请填写所属仓库、库位代码和类型');
    }
    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      throw new NotFoundException('找不到这个仓库');
    }
    try {
      return await db.location.create({
        data: {
          tenantId: auth.tenantId,
          warehouseId,
          code,
          type: body.type,
        },
      });
    } catch {
      throw new BadRequestException('这个仓库里已经有相同的库位代码');
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改库位，或停用库位' })
  async update(
    @Db() db: FacilityDb,
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: LocationBody,
  ) {
    requireFacilityAdmin(request);
    const data: { code?: string; type?: LocationTypeName; active?: boolean } = {};
    if (body.code !== undefined) {
      const code = body.code.trim().toUpperCase();
      if (!code) {
        throw new BadRequestException('库位代码不能为空');
      }
      data.code = code;
    }
    if (body.type !== undefined) {
      if (!isLocationType(body.type)) {
        throw new BadRequestException('库位类型不正确');
      }
      data.type = body.type;
    }
    if (body.active !== undefined) {
      data.active = body.active;
    }
    const updated = await db.location.updateMany({ where: { id }, data });
    if (updated.count === 0) {
      throw new NotFoundException('找不到这个库位');
    }
    return db.location.findUnique({ where: { id } });
  }
}

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  @Get()
  @ApiOperation({ summary: '列出当前租户的员工和角色' })
  list(@Db() db: FacilityDb, @Req() request: RequestWithAuth) {
    requireFacilityReader(request);
    return db.membership.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true, clerkUserId: true } },
      },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改员工角色（租户管理员或仓库员工）' })
  async updateRole(
    @Db() db: FacilityDb,
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() body: RoleBody,
  ) {
    const auth = requireFacilityAdmin(request);
    if (body.role !== 'tenant_admin' && body.role !== 'tenant_staff') {
      throw new BadRequestException('这里只能改成租户管理员或仓库员工');
    }
    const target = await db.membership.findUnique({ where: { id } });
    if (!target || target.tenantId !== auth.tenantId) {
      throw new NotFoundException('找不到这个员工');
    }
    if (target.role === 'merchant_user') {
      throw new BadRequestException('货主账号的角色暂不能在这里修改');
    }
    if (target.role === 'tenant_admin' && body.role === 'tenant_staff') {
      const admins = await db.membership.count({ where: { role: 'tenant_admin' } });
      if (admins <= 1) {
        throw new BadRequestException('至少要保留一名租户管理员');
      }
    }
    return db.membership.update({
      where: { id },
      data: { role: body.role },
    });
  }
}
