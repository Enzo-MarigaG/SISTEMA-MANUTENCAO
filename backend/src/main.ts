import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Railway/Render colocam o app atrás de um proxy reverso. Sem isto, o Express
  // vê o IP do proxy (não o do cliente), quebrando o rate limit por IP e a
  // detecção de HTTPS por trás do TLS terminado no proxy.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ limit: '1mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api');

  // Health check — Railway/Render usam para verificar se o serviço está no ar
  app.getHttpAdapter().get('/health', (_req: unknown, res: any) => {
    res.status(200).json({ status: 'ok' });
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Servidor rodando em http://localhost:${port}`);
}
void bootstrap();
