import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors, SetMetadata } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { revisionSchema } from '@portfolio/contracts';
import { AuthService, AdminGuard, InternalGuard, type AuthRequest } from './auth.js';
import { ContentService, validate } from './content.js';
import { MAX_UPLOAD, MediaService } from './media.js';
import { MutationGate } from './mutation-gate.js';
@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(ContentService) private readonly content: ContentService, @Inject(MediaService) private readonly media: MediaService, @Inject(MutationGate) private readonly gate: MutationGate) {}
  @Post('login') @SetMetadata('portfolio:public-login', true) @HttpCode(200) login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.login(body, req, res); }
  @Post('logout') @HttpCode(200) logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) { return this.auth.logout(req, res); }
  @Get('session') session(@Req() req: AuthRequest) { return { email: req.ownerSession!.email, csrfToken: req.ownerSession!.csrfToken }; }
  @Get('projects') list() { return this.content.list(); }
  @Post('projects') create(@Body() body: unknown) { return this.content.create(body); }
  @Get('projects/:id') get(@Param('id') id: string) { return this.content.get(id); }
  @Patch('projects/:id') save(@Param('id') id: string, @Body() body: unknown) { return this.content.save(id, body); }
  @Delete('projects/:id') remove(@Param('id') id: string, @Query('revision') revision: string) { return this.content.remove(id, validate(z.coerce.number().int().nonnegative(), revision)); }
  @Post('projects/:id/publish') @HttpCode(200) publish(@Param('id') id: string, @Body() body: unknown) { return this.content.publish(id, validate(revisionSchema, body).revision); }
  @Post('projects/:id/unpublish') @HttpCode(200) unpublish(@Param('id') id: string, @Body() body: unknown) { return this.content.unpublish(id, validate(revisionSchema, body).revision); }
  @Get('projects/:id/preview') preview(@Param('id') id: string) { return this.content.preview(id); }
  @Get('home') home() { return this.content.selection(); }
  @Put('home') setHome(@Body() body: unknown) { return this.content.setHome(body); }
  @Get('media') mediaList() { return this.media.list(); }
  @Post('media')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD, files: 1, fields: 0, parts: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File) { return this.gate.mutate(() => this.media.upload(file)); }
}
@Controller('api/public')
export class PublicController {
  constructor(@Inject(ContentService) private readonly content: ContentService) {}
  @Get('home') home() { return this.content.publicHome(); }
  @Get('projects/:slug') project(@Param('slug') slug: string) { return this.content.publicProject(slug); }
  @Get('routes') routes() { return this.content.publicRoutes(); }
}
@Controller('api/media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService, @Inject(AuthService) private readonly auth: AuthService) {}
  @Get(':id/:variant') async file(@Param('id') id: string, @Param('variant') variant: string, @Req() req: Request, @Res() res: Response) {
    const path = await this.media.file(id, variant, !!await this.auth.session(req));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(path, { dotfiles: 'deny' }, error => { if (error && !res.headersSent) res.status(404).json({ message: 'Media not found' }); });
  }
}
@Controller('api/internal/backup')
@UseGuards(InternalGuard)
export class BackupController {
  constructor(@Inject(MutationGate) private readonly gate: MutationGate) {}
  @Get('status') status() { return this.gate.status(); }
  @Post('lock') @HttpCode(200) lock(@Body() body: unknown) { const input = validate(z.object({ ttlSeconds: z.number().int().min(30).max(900).optional() }), body || {}); return this.gate.acquire(input.ttlSeconds); }
  @Post('unlock') @HttpCode(200) unlock(@Body() body: unknown) { return this.gate.release(validate(z.object({ token: z.string().uuid() }), body).token); }
}
@Controller('api')
export class HealthController { @Get('health') health() { return { ok: true }; } }

