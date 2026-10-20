import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import mongoose, { Schema, type Connection, type Model } from 'mongoose';
import { CONFIG, type ApiConfig } from './config.js';
import type { ProjectContent } from '@portfolio/contracts';
export interface ProjectRow { _id: string; slug: string; revision: number; draft: ProjectContent; publishedSnapshot: ProjectContent | null; firstPublishedAt: Date | null; publishedAt: Date | null; updatedAt: Date }
export interface OwnerRow { _id: string; email: string; passwordHash: string; updatedAt: Date }
export interface SessionRow { _id: string; email: string; csrfToken: string; expiresAt: Date }
export interface HomeRow { _id: string; first: string | null; second: string | null }
export interface MediaRow { _id: string; width: number; height: number; mime: string; bytes: number; hash: string; originalName: string; createdAt: Date }
@Injectable()
export class Database implements OnModuleDestroy {
  readonly connection: Connection;
  readonly projects: Model<ProjectRow>;
  readonly owners: Model<OwnerRow>;
  readonly sessions: Model<SessionRow>;
  readonly home: Model<HomeRow>;
  readonly media: Model<MediaRow>;
  constructor(@Inject(CONFIG) config: ApiConfig) {
    this.connection = mongoose.createConnection(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
    this.projects = this.connection.model('Project', new Schema<ProjectRow>({ _id: String, slug: { type: String, required: true, unique: true }, revision: { type: Number, required: true }, draft: { type: Schema.Types.Mixed, required: true }, publishedSnapshot: { type: Schema.Types.Mixed, default: null }, firstPublishedAt: { type: Date, default: null }, publishedAt: { type: Date, default: null }, updatedAt: { type: Date, required: true } }, { versionKey: false }));
    this.owners = this.connection.model('Owner', new Schema<OwnerRow>({ _id: String, email: { type: String, required: true }, passwordHash: { type: String, required: true }, updatedAt: Date }, { versionKey: false }));
    this.sessions = this.connection.model('Session', new Schema<SessionRow>({ _id: String, email: String, csrfToken: String, expiresAt: { type: Date, index: { expires: 0 } } }, { versionKey: false }));
    this.home = this.connection.model('Home', new Schema<HomeRow>({ _id: String, first: { type: String, default: null }, second: { type: String, default: null } }, { versionKey: false }));
    this.media = this.connection.model('Media', new Schema<MediaRow>({ _id: String, width: Number, height: Number, mime: String, bytes: Number, hash: String, originalName: String, createdAt: Date }, { versionKey: false }));
  }
  async ready() { await this.connection.asPromise(); await Promise.all([this.projects.init(), this.sessions.init()]); }
  async onModuleDestroy() { await this.connection.close(); }
}
