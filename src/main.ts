import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { openAPIRouter } from './api-docs/openAPIRouter';
import * as fs from 'node:fs';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Enable global validation: strip unknown props and optionally reject them
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use(cookieParser());

  app.enableCors({
    // Allow localhost on any port in dev (e.g., 5173, 5174, 3000, etc.)
    origin: [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      process.env.CORS_ORIGIN ?? '',
      'http://localhost:5173/react-app',
      'http://localhost:5173/',
    ].filter(Boolean) as any,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type'],
  });

  const config = new DocumentBuilder()
    .setTitle('Sgroup Advanced Backend')
    .setDescription('API documentation')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/docs', app, document);

  if (process.env.BUILD_OPENAPI === 'true') {
    fs.mkdirSync('dist', { recursive: true });
    fs.writeFileSync('dist/openapi.json', JSON.stringify(document, null, 2));
    await app.close();
    process.exit(0);
  }

  await app.listen(process.env.PORT ?? 3000);
  console.log(`http://localhost:${process.env.PORT ?? 3000}/docs`);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/api-docs', openAPIRouter);
}
bootstrap();
