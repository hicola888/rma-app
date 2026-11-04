import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'api' })
  service!: string;

  @ApiProperty({ example: '2026-11-04T09:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ enum: ['configured', 'missing'], example: 'configured' })
  database!: 'configured' | 'missing';
}
