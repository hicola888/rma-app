import './load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error(
      '缺少 CLERK_SECRET_KEY。请把它写到 apps/api/.env（可参考 apps/api/.env.example），然后重新启动 API。',
    );
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  const config = new DocumentBuilder()
    .setTitle('RMA API')
    .setDescription('多租户 3PL 退货管理 API。除 /health 外，请求需要 Clerk 登录令牌。')
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
