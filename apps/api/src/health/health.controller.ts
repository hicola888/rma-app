import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ServiceHealth } from '@rma/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthResponseDto } from './health-response.dto.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '服务健康检查' })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): ServiceHealth {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
      database: this.prisma.isConfigured() ? 'configured' : 'missing',
    };
  }
}
