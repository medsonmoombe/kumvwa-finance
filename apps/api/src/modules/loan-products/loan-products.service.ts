import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { LoanProduct } from '@prisma/client';
import { kwachaToMinor, minorToKwacha } from '@kumvwa/core';

import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { CreateLoanProductDto, UpdateProductDto } from './dto/loan-products.dto';

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        tenantId,
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        description: dto.description?.trim() || null,
        rateBps: dto.rateBps,
        minAmount: kwachaToMinor(dto.minAmount),
        maxAmount: kwachaToMinor(dto.maxAmount),
        minTerm: dto.minTerm,
        maxTerm: dto.maxTerm,
        frequency: dto.frequency ?? 'monthly',
        originationFeeBps: dto.originationFeeBps ?? 0,
        feeTreatment: dto.feeTreatment ?? 'add',
        penaltyBpsPerDay: dto.penaltyBpsPerDay ?? 0,
        penaltyCapBps: dto.penaltyCapBps ?? 2000,
        repaymentStructure: dto.repaymentStructure ?? 'bullet',
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      } as any,
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

  /** C2: the console's edit form reads one product with its raw Knob fields. */
  async detail(tenantId: string, id: string) {
    const product = await this.prisma.loanProduct.findUnique({ where: { id } });
    if (!product || product.tenantId !== tenantId) {
      throw new NotFoundException('Product not found');
    }
    return this.toJson(product);
  }

  /**
   * C2: partial edit. The patch is merged over the stored row and the
   * cross-field rules are re-checked against the *merged* values, so a
   * min-only or max-only edit can never leave the product inconsistent.
   */
  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateProductDto,
  ) {
    const product = await this.prisma.loanProduct.findUnique({ where: { id } });
    if (!product || product.tenantId !== tenantId) {
      throw new NotFoundException('Product not found');
    }

    const minAmount =
      dto.minAmount !== undefined ? kwachaToMinor(dto.minAmount) : product.minAmount;
    const maxAmount =
      dto.maxAmount !== undefined ? kwachaToMinor(dto.maxAmount) : product.maxAmount;
    const minTerm = dto.minTerm ?? product.minTerm;
    const maxTerm = dto.maxTerm ?? product.maxTerm;
    if (minAmount > maxAmount) {
      throw new BadRequestException(
        'Maximum amount must be greater than or equal to the minimum',
      );
    }
    if (minTerm > maxTerm) {
      throw new BadRequestException(
        'Maximum term must be greater than or equal to the minimum',
      );
    }

    const updated = await this.prisma.loanProduct.update({
      where: { id: product.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() || null } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.rateBps !== undefined ? { rateBps: dto.rateBps } : {}),
        ...(dto.minAmount !== undefined ? { minAmount } : {}),
        ...(dto.maxAmount !== undefined ? { maxAmount } : {}),
        ...(dto.minTerm !== undefined ? { minTerm } : {}),
        ...(dto.maxTerm !== undefined ? { maxTerm } : {}),
        ...(dto.frequency !== undefined ? { frequency: dto.frequency } : {}),
        ...(dto.repaymentStructure !== undefined
          ? { repaymentStructure: dto.repaymentStructure }
          : {}),
        ...(dto.originationFeeBps !== undefined
          ? { originationFeeBps: dto.originationFeeBps }
          : {}),
        ...(dto.feeTreatment !== undefined
          ? { feeTreatment: dto.feeTreatment }
          : {}),
        ...(dto.penaltyBpsPerDay !== undefined
          ? { penaltyBpsPerDay: dto.penaltyBpsPerDay }
          : {}),
        ...(dto.penaltyCapBps !== undefined
          ? { penaltyCapBps: dto.penaltyCapBps }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      } as any,
    });

    await this.audit.record({
      actorId,
      action: 'loan_product.update',
      entity: 'LoanProduct',
      entityId: product.id,
      tenantId,
      diff: dto as object,
    });

    return this.toJson(updated);
  }

  private toJson(p: LoanProduct & { code?: string | null; description?: string | null }) {
    return {
      id: p.id,
      name: p.name,
      code: p.code ?? null,
      description: p.description ?? null,
      rateBps: p.rateBps,
      ratePct: p.rateBps / 100,
      minAmount: minorToKwacha(p.minAmount),
      minAmountMinor: p.minAmount.toString(),
      maxAmount: minorToKwacha(p.maxAmount),
      maxAmountMinor: p.maxAmount.toString(),
      minTerm: p.minTerm,
      maxTerm: p.maxTerm,
      frequency: p.frequency,
      originationFeeBps: p.originationFeeBps,
      feeTreatment: p.feeTreatment,
      penaltyBpsPerDay: p.penaltyBpsPerDay,
      penaltyCapBps: p.penaltyCapBps,
      repaymentStructure: p.repaymentStructure,
      active: p.active,
      createdAt: p.createdAt,
    };
  }
}
