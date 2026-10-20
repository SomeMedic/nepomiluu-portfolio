import 'reflect-metadata';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';
import { CONFIG, readConfig, type ApiConfig } from './config.js';
import { Database } from './database.js';
import { AuthService, AdminGuard, InternalGuard } from './auth.js';
import { MutationGate } from './mutation-gate.js';
import { Revalidation } from './revalidation.js';
import { MediaService } from './media.js';
import { ContentService } from './content.js';
import { AdminController, BackupController, HealthController, MediaController, PublicController } from './controllers.js';
export async function createApp(config: ApiConfig = readConfig(), logging = true): Promise<INestApplication> {
  @Module({ providers: [{ provide: CONFIG, useValue: config }, Database, AuthService, MutationGate, Revalidation, MediaService, ContentService, InternalGuard, AdminGuard], controllers: [AdminController, PublicController, MediaController, BackupController, HealthController] })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { logger: logging ? ['log', 'warn', 'error'] : false, bodyParser: false });
  const server = app.getHttpAdapter().getInstance();
  server.disable('x-powered-by');
  server.set('trust proxy', config.production ? 1 : false);
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store'); next(); });
  await app.get(Database).ready();
  await app.init();
  app.enableShutdownHooks();
  return app;
}

