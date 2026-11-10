import { ArgumentsHost, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_IMPORT_BYTES } from './types.js';

type JsonResponse = {
  status(code: number): { json(body: unknown): void };
};

export const importFileInterceptor = FileInterceptor('file', {
  limits: { fileSize: MAX_IMPORT_BYTES },
});

@Catch(PayloadTooLargeException)
export class ImportUploadExceptionFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<JsonResponse>();
    response.status(400).json({
      statusCode: 400,
      message: '文件太大，请小于 5MB',
      error: 'Bad Request',
    });
  }
}
