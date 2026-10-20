import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { CONFIG, type ApiConfig } from './config.js';
import { Database, type SessionRow } from './database.js';
export interface AuthRequest extends Request { ownerSession?: SessionRow }
export const COOKIE = 'portfolio_session';
export function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function sameSecret(value: unknown, expected: string) { if (typeof value !== 'string' || !expected) return false; const left = Buffer.from(value); const right = Buffer.from(expected); return left.length === right.length && timingSafeEqual(left, right); }
export const passwordOptions = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  private readonly dummyHash = argon2.hash(randomBytes(32).toString('hex'), passwordOptions);
  constructor(@Inject(Database) private readonly db: Database, @Inject(CONFIG) private readonly config: ApiConfig) {}
  private cookieOptions() { return { httpOnly: true, secure: this.config.production, sameSite: 'strict' as const, path: '/', maxAge: this.config.sessionHours * 3600000 }; }
  checkOrigin(req: Request) { const origin = req.get('origin'); if (origin && origin !== new URL(this.config.publicOrigin).origin) throw new ForbiddenException('Origin is not allowed'); }
  async session(req: Request): Promise<SessionRow | null> {
    const token = req.cookies?.[COOKIE];
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    return this.db.sessions.findOne({ _id: digest(token), expiresAt: { $gt: new Date() } }).lean();
  }
  async login(body: unknown, req: Request, res: Response) {
    this.checkOrigin(req);
    const input = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(1024) }).safeParse(body);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    if (this.attempts.size >= 10000) for (const [key, item] of this.attempts) if (item.until <= now) this.attempts.delete(key);
    const attempt = this.attempts.get(ip);
    if (!attempt && this.attempts.size >= 10000) throw new HttpException('Login rate limit is busy; retry later', HttpStatus.TOO_MANY_REQUESTS);
    if (attempt && attempt.until > now && attempt.count >= 5) throw new HttpException('Too many login attempts; retry in 15 minutes', HttpStatus.TOO_MANY_REQUESTS);
    this.attempts.set(ip, { count: attempt && attempt.until > now ? attempt.count + 1 : 1, until: attempt && attempt.until > now ? attempt.until : now + 900000 });
    const owner = input.success ? await this.db.owners.findById('owner').lean() : null;
    const hash = owner?.passwordHash || await this.dummyHash;
    const valid = await argon2.verify(hash, input.success ? input.data.password : 'invalid');
    if (!input.success || !owner || !valid || owner.email !== input.data.email.toLowerCase()) throw new UnauthorizedException('Invalid email or password');
    this.attempts.delete(ip);
    const oldToken = req.cookies?.[COOKIE];
    if (typeof oldToken === 'string') await this.db.sessions.deleteOne({ _id: digest(oldToken) });
    const token = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    await this.db.sessions.create({ _id: digest(token), email: owner.email, csrfToken, expiresAt: new Date(now + this.config.sessionHours * 3600000) });
    res.cookie(COOKIE, token, this.cookieOptions());
    return { email: owner.email, csrfToken };
  }
  async logout(req: AuthRequest, res: Response) {
    if (req.ownerSession) await this.db.sessions.deleteOne({ _id: req.ownerSession._id });
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    res.clearCookie(COOKIE, options);
    return { ok: true };
  }
}
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (Reflect.getMetadata('portfolio:public-login', context.getHandler())) return true;
    const session = await this.auth.session(req);
    if (!session) throw new UnauthorizedException('Sign in required');
    req.ownerSession = session;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      this.auth.checkOrigin(req);
      if (!sameSecret(req.get('x-csrf-token'), session.csrfToken)) throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
@Injectable()
export class InternalGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: ApiConfig) {}
  canActivate(context: ExecutionContext) {
    if (!sameSecret(context.switchToHttp().getRequest<Request>().get('x-internal-secret'), this.config.internalSecret)) throw new UnauthorizedException('Invalid internal secret');
    return true;
  }
}

