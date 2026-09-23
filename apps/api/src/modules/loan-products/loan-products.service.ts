import { BadRequestException, Injectable } from '@nestjs/common';
import type { LoanProduct } from '@prisma/client';
import { kwachaToMinor, minorToKwacha } from '@kumvwa/core';

import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { CreateLoanProductDto } from './dto/loan-products.dto';

/**
 * Lender-defined loan products. These are the rate/amount/term guard-rails a
 * lender works within when approving requests — they are configuration, not
 * enforcement points (each approval still carries its own rate).
 */
@Injectable()
export class LoanProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    const rows = await this.prisma.loanProduct.findMany({
      where: { tenantId },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });
    return { items: rows.map((p) => this.toJson(p)) };
  }

  async create(tenantId: string, actorId: string, dto: CreateLoanProductDto) {
    if (dto.maxAmount < dto.minAmount) {
      throw new BadRequestException(
        'Maximum amount must be greater than or equal to the minimum',
      );
    }
    if (dto.maxTerm < dto.minTerm) {
      throw new BadRequestException(
        'Maximum term must be greater than or equal to the minimum',
      );
    }

    const product = await this.prisma.loanProduct.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        rateBps: dto.rateBps,
        minAmount: kwachaToMinor(dto.minAmount),
        maxAmount: kwachaToMinor(dto.maxAmount),
        minTerm: dto.minTerm,
        maxTerm: dto.maxTerm,
      },
    });

    await this.audit.record({
      actorId,
      action: 'loan_product.create',
      entity: 'LoanProduct',
      entityId: product.id,
      tenantId,
      diff: {
        name: product.name,
        rateBps: product.rateBps,
        minAmountMinor: product.minAmount.toString(),
        maxAmountMinor: product.maxAmount.toString(),
        termRange: `${product.minTerm}-${product.maxTerm}`,
      },
    });

    return this.toJson(product);
  }

  private toJson(p: LoanProduct) {
    return {
      id: p.id,
      name: p.name,
      rateBps: p.rateBps,
      ratePct: p.rateBps / 100,
      minAmount: minorToKwacha(p.minAmount),
      minAmountMinor: p.minAmount.toString(),
      maxAmount: minorToKwacha(p.maxAmount),
      maxAmountMinor: p.maxAmount.toString(),
      minTerm: p.minTerm,
      maxTerm: p.maxTerm,
      active: p.active,
      createdAt: p.createdAt,
    };
  }
}
