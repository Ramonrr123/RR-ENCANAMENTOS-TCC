import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (process.env.API_GLOBAL_PREFIX) {
    app.setGlobalPrefix(process.env.API_GLOBAL_PREFIX);
  }

  app.set('trust proxy', 1);
  app.use(helmet());
  app.useBodyParser('json', { limit: '4mb' });
  app.useBodyParser('urlencoded', { limit: '4mb', extended: true });

  // O código anterior usava origin: true e refletia qualquer site.
  // Não há URL de produção configurada: o front publicado chama a API no mesmo host.
  const origens = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  app.enableCors({
    origin: origens,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Empresa-Codigo'],
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`ERP API em http://localhost:${port}`);
}

void bootstrap();
