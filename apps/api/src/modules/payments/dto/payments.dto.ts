import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_PURPOSES,
  type PaymentMethod,
  type PaymentProvider,
  type PaymentPurpose,
} from '@kumvwa/core';

/**
 * Create a payment intent. The server owns the amount for `client_slots`
 * (computed from the plan), so `amount` is only read for loan purposes.
 */
export class CreateIntentDto {
  @IsIn([...PAYMENT_PURPOSES])
  purpose!: PaymentPurpose;

  /** Kwacha, as entered — ignored for `client_slots` (server-computed). */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  /** Required for `loan_repayment`. */
  @IsOptional()
  @IsString()
  loanId?: string;

  /** MoMo number to push to; defaults to the payer's registered number. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /** Explicit rail; otherwise inferred from the phone (or card via method). */
  @IsOptional()
  @IsIn([...PAYMENT_PROVIDERS])
  provider?: PaymentProvider;

  @IsOptional()
  @IsIn([...PAYMENT_METHODS])
  method?: PaymentMethod;

  /** For `client_slots`: how many extra client slots to buy. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  slotCount?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/** Lender-initiated disbursement of an approved loan to the borrower. */
export class DisburseDto {
  @IsString()
  loanId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsIn([...PAYMENT_PROVIDERS])
  provider?: PaymentProvider;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
