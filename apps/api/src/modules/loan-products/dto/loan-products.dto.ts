import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLoanProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  /** Lender's own product code (e.g. PL-001). Display only. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  /** Internal note for staff — clients never see this. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  /** Basis points — 15% = 1500. */
  @IsInt()
  @Min(0)
  @Max(10000, { message: 'Rate cannot exceed 100%' })
  rateBps!: number;

  /** Kwacha at the API edge; stored as ngwee. */
  @IsNumber()
  @Min(1)
  minAmount!: number;

  @IsNumber()
  @Min(1)
  maxAmount!: number;

  @IsInt()
  @Min(1)
  @Max(60)
  minTerm!: number;

  @IsInt()
  @Min(1)
  @Max(60)
  maxTerm!: number;

  // ── M4 money-maturity knobs ──
  /** Installment spacing. */
  @IsOptional()
  @IsIn(['monthly', 'weekly', 'fortnightly'])
  frequency?: string;

  /** One-off origination fee, bps of principal (0 = no fee, max 20%). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  originationFeeBps?: number;

  /** 'add' pays out full principal; 'deduct' nets the fee off the payout. */
  @IsOptional()
  @IsIn(['add', 'deduct'])
  feeTreatment?: string;

  /** Daily penalty rate on the unpaid portion, bps (0 = penalties off). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  penaltyBpsPerDay?: number;

  /** Accumulated-penalty cap, bps of the installment amount. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  penaltyCapBps?: number;

  /** M5 structure: 'bullet' (one lump at maturity) is the platform default;
   *  'installments' reproduces the classic amortizing schedule. */
  @IsOptional()
  @IsIn(['bullet', 'installments'])
  repaymentStructure?: string;

  /** Active on creation — defaults to true if omitted. */
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/**
 * C2: partial edit. Every field is optional — the service merges the patch
 * over the stored product and re-validates the cross-field rules
 * (min ≤ max amount, min ≤ max term) itself.
 */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBps?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  minTerm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  maxTerm?: number;

  @IsOptional()
  @IsIn(['monthly', 'weekly', 'fortnightly'])
  frequency?: string;

  @IsOptional()
  @IsIn(['bullet', 'installments'])
  repaymentStructure?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  originationFeeBps?: number;

  @IsOptional()
  @IsIn(['add', 'deduct'])
  feeTreatment?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  penaltyBpsPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  penaltyCapBps?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

