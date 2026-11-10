import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Db } from '../auth/current-db.decorator.js';
import type { RequestWithAuth } from '../auth/request-auth.js';
import { requireFacilityAdmin, requireFacilityReader } from '../auth/roles.js';
import {
  commitImport,
  previewImport,
  renderExport,
  renderTemplate,
} from '../import-export/engine.js';
import type { SheetDb, UploadedSheet } from '../import-export/types.js';
import { ImportUploadExceptionFilter, importFileInterceptor } from '../import-export/upload.js';
import { locationImport } from './location-import.js';
import { warehouseImport } from './warehouse-import.js';

function asSheetDb(db: object): SheetDb {
  return db as SheetDb;
}

function download(file: { body: Buffer; contentType: string; filename: string }): StreamableFile {
  return new StreamableFile(file.body, {
    type: file.contentType,
    disposition: `attachment; filename="${file.filename}"`,
  });
}

@ApiTags('warehouses')
@Controller('warehouses')
@UseFilters(ImportUploadExceptionFilter)
export class WarehouseTransferController {
  @Get('export')
  @ApiOperation({ summary: '导出当前筛选的仓库。format 为 csv 或 xlsx，q 为筛选文字。' })
  async export(
    @Db() db: object,
    @Req() request: RequestWithAuth,
    @Query('format') format: string | undefined,
    @Query('q') query: string | undefined,
  ): Promise<StreamableFile> {
    requireFacilityReader(request);
    return download(await renderExport(warehouseImport, asSheetDb(db), format, query));
  }

  @Get('import/template')
  @ApiOperation({ summary: '下载仓库导入模板（中文表头和一行示例）' })
  async template(
    @Req() request: RequestWithAuth,
    @Query('format') format: string | undefined,
  ): Promise<StreamableFile> {
    requireFacilityAdmin(request);
    return download(await renderTemplate(warehouseImport, format));
  }

  @Post('import/preview')
  @UseInterceptors(importFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '预览仓库导入，不写数据库' })
  preview(
    @Db() db: object,
    @Req() request: RequestWithAuth,
    @UploadedFile() file: UploadedSheet | undefined,
  ) {
    requireFacilityAdmin(request);
    return previewImport(warehouseImport, asSheetDb(db), file);
  }

  @Post('import/commit')
  @UseInterceptors(importFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '确认导入仓库。有任何错误则整批不写入。' })
  commit(
    @Db() db: object,
    @Req() request: RequestWithAuth,
    @UploadedFile() file: UploadedSheet | undefined,
  ) {
    const auth = requireFacilityAdmin(request);
    return commitImport(warehouseImport, asSheetDb(db), file, auth.tenantId);
  }
}

@ApiTags('locations')
@Controller('locations')
@UseFilters(ImportUploadExceptionFilter)
export class LocationTransferController {
  @Get('export')
  @ApiOperation({ summary: '导出当前筛选的库位。format 为 csv 或 xlsx，q 为筛选文字。' })
  async export(
    @Db() db: object,
    @Req() request: RequestWithAuth,
    @Query('format') format: string | undefined,
    @Query('q') query: string | undefined,
  ): Promise<StreamableFile> {
    requireFacilityReader(request);
    return download(await renderExport(locationImport, asSheetDb(db), format, query));
  }

  @Get('import/template')
  @ApiOperation({ summary: '下载库位导入模板（中文表头和一行示例）' })
  async template(
    @Req() request: RequestWithAuth,
    @Query('format') format: string | undefined,
  ): Promise<StreamableFile> {
    requireFacilityAdmin(request);
    return download(await renderTemplate(locationImport, format));
  }

  @Post('import/preview')
  @UseInterceptors(importFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '预览库位导入，不写数据库' })
  preview(
    @Db() db: object,
    @Req() request: RequestWithAuth,
    @UploadedFile() file: UploadedSheet | undefined,
  ) {
    requireFacilityAdmin(request);
    return previewImport(locationImport, asSheetDb(db), file);
  }

  @Post('import/commit')
  @UseInterceptors(importFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '确认导入库位。有任何错误则整批不写入。' })
  commit(
    @Db() db: object,
    @Req() request: RequestWithAuth,
    @UploadedFile() file: UploadedSheet | undefined,
  ) {
    const auth = requireFacilityAdmin(request);
    return commitImport(locationImport, asSheetDb(db), file, auth.tenantId);
  }
}
