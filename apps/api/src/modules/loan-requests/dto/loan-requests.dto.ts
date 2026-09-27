import {
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

export class CreateLoanRequestDto {
  @IsString()
  lenderId!: string; // tenant id, from GET /clients/me/lenders

  @IsNumber()
  @IsPositive()
  amount!: number; // kwacha

  @IsInt()
  @Min(1)
  @Max(12, { message: 'Repayment term must be 1–12 months' })
  termCount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  purpose!: string;
}

export class ApproveRequestDto {
  @IsInt()
  @Min(100, { message: 'Rate must be at least 1%' })
  @Max(10000)
  rateBps!: number;

  @IsOptional()
  @IsString()
  productId?: string;

  /** Optional schedule-shape override (defaults to the product's). */
  @IsOptional()
  @IsIn(['monthly', 'weekly', 'fortnightly'])
  frequency?: string;
}

export class RejectRequestDto {
  @IsString()
  @MinLength(10, {
    message: 'Feedback must be at least 10 characters — the client will read it',
  })
  @MaxLength(500)
  feedback!: string;
}
