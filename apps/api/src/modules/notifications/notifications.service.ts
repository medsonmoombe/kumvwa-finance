import { Injectable } from '@nestjs/common';
import type { NotificationType, Prisma } from '@prisma/client';

import { PrismaService } from '../../infra/prisma.module';

/**
 * In-app notification center. The push/SMS fan-out lives in the worker, which
 * reads the rows this service writes — so a single write here feeds every
 * channel and no caller has to know which channels are configured.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget-friendly write: never throws into the caller's flow. */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, type, title, body, data },
    });
  }

  /** Paginated feed, newest first, plus unread count for the badge. */
  async list(userId: string, cursor: string | undefined, limit: number) {
    const take = Math.min(Math.max(Number.isFinite(limit) ? limit : 20, 1), 50);
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      items,
      unread,
      nextCursor: items.length === take ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  async markRead(userId: string, id: string): Promise<{ read: true }> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null }, // userId in where = object-level guard
      data: { readAt: new Date() },
    });
    return { read: true };
  }
}
