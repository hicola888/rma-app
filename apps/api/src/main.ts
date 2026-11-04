import './load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });

  const config = new DocumentBuilder()
    .setTitle('RMA API')
    .setDescription('多租户 3PL 退货管理 API。当前为项目骨架，仅提供健康检查。')
    .setVersion('0.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Swagger UI at http://localhost:${port}/docs`);
}

await bootstrap();
